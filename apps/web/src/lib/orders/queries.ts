import { db } from "@emach/db";
import type { OrderStatus } from "@emach/db/schema/orders";
import { order, orderItem, orderStatusHistory } from "@emach/db/schema/orders";
import { review } from "@emach/db/schema/reviews";
import { toolImage } from "@emach/db/schema/tools";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export interface OrderPreviewItem {
	id: string;
	imageUrl: string | null;
	name: string;
	quantity: number;
	unitPrice: string;
	voltage: string | null;
}

export interface OrderListItem {
	createdAt: Date;
	id: string;
	itemCount: number;
	number: string;
	preview: OrderPreviewItem[];
	shippingAmount: string;
	status: OrderStatus;
	subtotalAmount: string;
	totalAmount: string;
}

/**
 * Colunas de `orderItem` expostas ao cliente. Exclui campos
 * fiscais/dimensionais não exibidos — convenção "sem select *".
 */
const ORDER_ITEM_COLUMNS = {
	id: orderItem.id,
	orderId: orderItem.orderId,
	toolId: orderItem.toolId,
	variantId: orderItem.variantId,
	sku: orderItem.sku,
	name: orderItem.name,
	model: orderItem.model,
	voltage: orderItem.voltage,
	unitPrice: orderItem.unitPrice,
	quantity: orderItem.quantity,
	lineTotal: orderItem.lineTotal,
	discountAmount: orderItem.discountAmount,
	manufacturerName: orderItem.manufacturerName,
} as const;

export interface OrderItemRow {
	discountAmount: string;
	id: string;
	lineTotal: string;
	manufacturerName: string | null;
	model: string | null;
	name: string;
	orderId: string;
	quantity: number;
	sku: string | null;
	toolId: string;
	unitPrice: string;
	variantId: string;
	voltage: string | null;
}

export interface OrderDetailData {
	history: (typeof orderStatusHistory.$inferSelect)[];
	items: (OrderItemRow & { imageUrl: string | null })[];
	order: typeof order.$inferSelect;
	reviewedToolIds: string[];
}

/** Mapa toolId -> URL da imagem primária (menor sortOrder). */
async function primaryImageByToolId(
	toolIds: string[]
): Promise<Map<string, string>> {
	if (toolIds.length === 0) {
		return new Map();
	}
	const rows = await db
		.select({
			toolId: toolImage.toolId,
			url: toolImage.url,
			sortOrder: toolImage.sortOrder,
		})
		.from(toolImage)
		.where(inArray(toolImage.toolId, toolIds))
		.orderBy(asc(toolImage.toolId), asc(toolImage.sortOrder));
	const map = new Map<string, string>();
	for (const r of rows) {
		if (!map.has(r.toolId)) {
			map.set(r.toolId, r.url); // primeira = menor sortOrder
		}
	}
	return map;
}

export async function listClientOrders(
	clientId: string
): Promise<OrderListItem[]> {
	const orders = await db
		.select()
		.from(order)
		.where(eq(order.clientId, clientId))
		.orderBy(desc(order.createdAt));

	if (orders.length === 0) {
		return [];
	}

	const orderIds = orders.map((o) => o.id);
	const items = await db
		.select(ORDER_ITEM_COLUMNS)
		.from(orderItem)
		.where(inArray(orderItem.orderId, orderIds));

	const imageByTool = await primaryImageByToolId(
		Array.from(new Set(items.map((i) => i.toolId)))
	);

	const itemsByOrder = new Map<string, typeof items>();
	for (const it of items) {
		const arr = itemsByOrder.get(it.orderId) ?? [];
		arr.push(it);
		itemsByOrder.set(it.orderId, arr);
	}

	return orders.map((o) => {
		const its = itemsByOrder.get(o.id) ?? [];
		return {
			id: o.id,
			number: o.number,
			status: o.status,
			createdAt: o.createdAt,
			totalAmount: o.totalAmount,
			subtotalAmount: o.subtotalAmount,
			shippingAmount: o.shippingAmount,
			itemCount: its.reduce((s, i) => s + i.quantity, 0),
			preview: its.map((i) => ({
				id: i.id,
				name: i.name,
				voltage: i.voltage,
				quantity: i.quantity,
				unitPrice: i.unitPrice,
				imageUrl: imageByTool.get(i.toolId) ?? null,
			})),
		};
	});
}

export async function getClientOrderDetail(
	clientId: string,
	orderId: string
): Promise<OrderDetailData | null> {
	const [orderRow] = await db
		.select()
		.from(order)
		.where(and(eq(order.id, orderId), eq(order.clientId, clientId)))
		.limit(1);

	if (!orderRow) {
		return null;
	}

	const items = await db
		.select(ORDER_ITEM_COLUMNS)
		.from(orderItem)
		.where(eq(orderItem.orderId, orderId));

	const imageByTool = await primaryImageByToolId(
		Array.from(new Set(items.map((i) => i.toolId)))
	);

	const history = await db
		.select()
		.from(orderStatusHistory)
		.where(eq(orderStatusHistory.orderId, orderId))
		.orderBy(desc(orderStatusHistory.createdAt));

	const reviewed = await db
		.select({ toolId: review.toolId })
		.from(review)
		.where(and(eq(review.orderId, orderId), eq(review.clientId, clientId)));

	return {
		order: orderRow,
		items: items.map((i) => ({
			...i,
			imageUrl: imageByTool.get(i.toolId) ?? null,
		})),
		history,
		reviewedToolIds: reviewed.map((r) => r.toolId),
	};
}
