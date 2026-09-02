"use server";

import { db } from "@emach/db";
import { toolVariant } from "@emach/db/schema/tools";
import { inArray } from "drizzle-orm";
import { z } from "zod";

import { fetchAutoPromosByToolId } from "@/lib/auto-promo";
import { log } from "@/lib/evlog";
import { numericToCents } from "@/lib/format";
import { effectiveAutoDiscountCents } from "@/lib/promotions";
import { hasPrice } from "@/lib/sellable-variant";
import { requireCurrentClient } from "@/lib/session";

const schema = z.object({
	cartItems: z
		.array(
			z.object({
				toolId: z.string().min(1),
				variantId: z.string().min(1),
			})
		)
		.min(1),
});

export interface RevalidatedPrice {
	finalPriceCents: number;
	variantId: string;
}

export type RevalidateCartResult =
	| { ok: true; prices: RevalidatedPrice[] }
	| { ok: false; error: string };

/**
 * Re-busca o preço real atual de cada variante e aplica a auto-promo vigente
 * (reusa o helper canônico de lib/auto-promo). Exportada à parte do action para
 * ser testável sem o guard de sessão.
 */
export async function computeFinalPrices(
	database: typeof db,
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
		// Variante removida, hidden ou sem preço: pula daqui. O preço antigo do
		// snapshot segue exibido no carrinho, mas place-order vai rejeitar com
		// OrderError específica — barreira final de bloqueio.
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

export async function revalidateCartAction(
	raw: z.infer<typeof schema>
): Promise<RevalidateCartResult> {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	await requireCurrentClient();
	try {
		const prices = await computeFinalPrices(db, parsed.data.cartItems);
		return { ok: true, prices };
	} catch (err) {
		log.error({
			action: "revalidate_cart_failed",
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return { ok: false, error: "Não foi possível atualizar os preços" };
	}
}
