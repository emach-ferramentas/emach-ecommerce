"use server";

import { db } from "@emach/db";
import { toolVariant } from "@emach/db/schema/tools";
import { inArray } from "drizzle-orm";
import { z } from "zod";

import { couponCartItemSchema } from "@/app/checkout/_lib/coupon-schema";
import {
	type CouponLine,
	ENUMERABLE_REASONS,
	publicCouponError,
	validateCoupon,
} from "@/lib/coupons/validate-coupon";
import { log } from "@/lib/evlog";
import { numericToCents } from "@/lib/format";
import { couponLimiter, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { hasPrice } from "@/lib/sellable-variant";
import { requireCurrentClient } from "@/lib/session";

const schema = z.object({
	code: z.string().min(1),
	cartItems: z.array(couponCartItemSchema).min(1),
});

export type ApplyCouponResult =
	| { ok: true; discountCents: number }
	| { ok: false; error: string };

export async function applyCouponAction(
	raw: z.infer<typeof schema>
): Promise<ApplyCouponResult> {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { code, cartItems } = parsed.data;

	const { success } = await couponLimiter.limit(`coupon:${clientId}`);
	if (!success) {
		return { ok: false, error: RATE_LIMIT_MESSAGE };
	}

	try {
		const variantIds = cartItems.map((i) => i.variantId);
		const variants = await db
			.select({
				id: toolVariant.id,
				toolId: toolVariant.toolId,
				priceAmount: toolVariant.priceAmount,
				visibleOnSite: toolVariant.visibleOnSite,
			})
			.from(toolVariant)
			.where(inArray(toolVariant.id, variantIds));
		const byId = new Map(variants.map((v) => [v.id, v]));

		const lines: CouponLine[] = [];
		for (const item of cartItems) {
			const variant = byId.get(item.variantId);
			if (!variant || variant.toolId !== item.toolId) {
				return { ok: false, error: "Carrinho inválido" };
			}
			// Variante virou hidden (ou perdeu o preço) depois de adicionada:
			// bloqueia o cupom (mesma barreira que o place-order vai aplicar).
			// Mensagem genérica pra não vazar estado interno.
			if (!(variant.visibleOnSite && hasPrice(variant))) {
				return { ok: false, error: "Item indisponível no carrinho" };
			}
			lines.push({
				toolId: item.toolId,
				quantity: item.quantity,
				basePriceCents: numericToCents(variant.priceAmount),
			});
		}

		const result = await validateCoupon(db, code, lines);
		if (!result.ok) {
			if (ENUMERABLE_REASONS.has(result.reason)) {
				// Anti-enumeração: motivo real só no evlog; usuário vê msg genérica.
				log.warn({ action: "coupon_rejected", reason: result.reason });
			}
			return {
				ok: false,
				error: publicCouponError(result.reason, result.error),
			};
		}
		return { ok: true, discountCents: result.discountCents };
	} catch (err) {
		log.error({
			action: "apply_coupon_failed",
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return { ok: false, error: "Não foi possível validar o cupom" };
	}
}
