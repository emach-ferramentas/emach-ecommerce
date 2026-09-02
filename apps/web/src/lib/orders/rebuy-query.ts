import { db } from "@emach/db";
import { category, toolCategory } from "@emach/db/schema/categories";
import { stockLevel } from "@emach/db/schema/inventory";
import { order, orderItem } from "@emach/db/schema/orders";
import { tool, toolVariant, type Voltage } from "@emach/db/schema/tools";
import { and, eq, inArray, sql } from "drizzle-orm";

import { hasPrice } from "@/lib/sellable-variant";
import { primaryImageByToolId } from "@/lib/tool-images";

export interface RebuyItem {
	available: boolean;
	categoryName: string | null;
	categorySlug: string | null;
	imageUrl: string | null;
	name: string;
	priceAmount: string;
	quantity: number;
	sku: string;
	slug: string;
	toolId: string;
	variantId: string;
	voltage: Voltage | null;
}

export async function getRebuyItems(
	clientId: string,
	orderId: string
): Promise<RebuyItem[] | null> {
	const [owned] = await db
		.select({ id: order.id })
		.from(order)
		.where(and(eq(order.id, orderId), eq(order.clientId, clientId)))
		.limit(1);
	if (!owned) {
		return null;
	}

	const items = await db
		.select({
			toolId: orderItem.toolId,
			variantId: orderItem.variantId,
			quantity: orderItem.quantity,
		})
		.from(orderItem)
		.where(eq(orderItem.orderId, orderId));
	if (items.length === 0) {
		return [];
	}

	const variantIds = items.map((i) => i.variantId);
	const toolIds = Array.from(new Set(items.map((i) => i.toolId)));

	const [variants, tools, imageByTool, cats, stock] = await Promise.all([
		db
			.select({
				id: toolVariant.id,
				sku: toolVariant.sku,
				voltage: toolVariant.voltage,
				priceAmount: toolVariant.priceAmount,
				visibleOnSite: toolVariant.visibleOnSite,
			})
			.from(toolVariant)
			.where(inArray(toolVariant.id, variantIds)),
		db
			.select({ id: tool.id, name: tool.name, slug: tool.slug })
			.from(tool)
			.where(inArray(tool.id, toolIds)),
		primaryImageByToolId(db, toolIds),
		db
			.select({
				toolId: toolCategory.toolId,
				name: category.name,
				slug: category.slug,
			})
			.from(toolCategory)
			.innerJoin(category, eq(category.id, toolCategory.categoryId))
			.where(inArray(toolCategory.toolId, toolIds)),
		db
			.select({
				variantId: stockLevel.variantId,
				total: sql<number>`COALESCE(SUM(${stockLevel.quantity}), 0)::int`,
			})
			.from(stockLevel)
			.where(inArray(stockLevel.variantId, variantIds))
			.groupBy(stockLevel.variantId),
	]);

	const variantById = new Map(variants.map((v) => [v.id, v]));
	const toolById = new Map(tools.map((t) => [t.id, t]));
	const catByTool = new Map<string, { name: string; slug: string }>();
	for (const c of cats) {
		if (!catByTool.has(c.toolId)) {
			catByTool.set(c.toolId, { name: c.name, slug: c.slug });
		}
	}
	const stockByVariant = new Map(stock.map((s) => [s.variantId, s.total]));

	return items.map((i) => {
		const v = variantById.get(i.variantId);
		const t = toolById.get(i.toolId);
		const cat = catByTool.get(i.toolId) ?? null;
		const total = stockByVariant.get(i.variantId) ?? 0;
		return {
			toolId: i.toolId,
			variantId: i.variantId,
			slug: t?.slug ?? i.toolId,
			name: t?.name ?? "Produto",
			sku: v?.sku ?? "",
			voltage: v?.voltage ?? null,
			priceAmount: v?.priceAmount ?? "0",
			imageUrl: imageByTool.get(i.toolId) ?? null,
			categoryName: cat?.name ?? null,
			categorySlug: cat?.slug ?? null,
			quantity: i.quantity,
			// Variante hidden ou sem preço = bloqueia compra (place-order
			// rejeitará); botão "Comprar de novo" não deve oferecê-la.
			available: v
				? v.visibleOnSite && hasPrice(v) && total >= i.quantity
				: false,
		};
	});
}
