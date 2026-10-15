import { toolVariant } from "@emach/db/schema/tools";
import { inArray } from "drizzle-orm";

import { fetchAutoPromosByToolId } from "@/lib/auto-promo";
import type { DbExecutor } from "@/lib/db-executor";
import { numericToCents } from "@/lib/format";
import { effectiveAutoDiscountCents } from "@/lib/promotions";
import { hasPrice } from "@/lib/sellable-variant";

export interface RevalidatedPrice {
	finalPriceCents: number;
	variantId: string;
}

/**
 * Re-busca o preço real atual de cada variante e aplica a auto-promo vigente
 * (reusa o helper canônico de lib/auto-promo). Fica fora do arquivo "use
 * server" para não virar endpoint público sem guarda de sessão.
 */
export async function computeFinalPrices(
	database: DbExecutor,
	items: Array<{ toolId: string; variantId: string }>
): Promise<RevalidatedPrice[]> {
	const variantIds = items.map((i) => i.variantId);
	const toolIds = Array.from(new Set(items.map((i) => i.toolId)));

	const [variants, autoPromos] = await Promise.all([
		database
			.select({
				id: toolVariant.id,
				toolId: toolVariant.toolId,
				priceAmount: toolVariant.priceAmount,
				visibleOnSite: toolVariant.visibleOnSite,
			})
			.from(toolVariant)
			.where(inArray(toolVariant.id, variantIds)),
		fetchAutoPromosByToolId(database, toolIds, new Date()),
	]);

	const byId = new Map(variants.map((v) => [v.id, v]));

	const prices: RevalidatedPrice[] = [];

	for (const item of items) {
		const variant = byId.get(item.variantId);

		// Variante removida, hidden ou sem preço: pula daqui. A action devolve
		// esses ids em `unavailable`; place-order segue como barreira final.
		if (
			!variant ||
			variant.toolId !== item.toolId ||
			!variant.visibleOnSite ||
			!hasPrice(variant)
		) {
			continue;
		}

		const base = numericToCents(variant.priceAmount);
		let final = base;

		for (const promo of autoPromos.get(item.toolId) ?? []) {
			const candidate = effectiveAutoDiscountCents(
				base,
				promo.discountType,
				promo.discountValue
			);

			if (candidate < final) {
				final = candidate;
			}
		}

		prices.push({ variantId: item.variantId, finalPriceCents: final });
	}

	return prices;
}
