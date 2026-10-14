import type { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
	autoPromoToolIdsFromMap,
	fetchAutoPromosByToolId,
} from "@/lib/auto-promo";
import { fmtNumericBRL, numericToCents } from "@/lib/format";

export interface CouponLine {
	/** Preço ORIGINAL da variante em centavos (sem auto-promo). */
	basePriceCents: number;
	quantity: number;
	toolId: string;
}

export type CouponFailReason =
	| "empty"
	| "invalid"
	| "expired"
	| "exhausted"
	| "not_eligible"
	| "min_order";

/** Razões que revelam EXISTÊNCIA do código → colapsar em msg genérica (anti-enumeração). */
export const ENUMERABLE_REASONS = new Set<CouponFailReason>([
	"empty",
	"invalid",
	"expired",
	"exhausted",
]);

export type CouponValidation =
	| { ok: true; discountCents: number; promotionId: string }
	| { ok: false; error: string; reason: CouponFailReason };

/**
 * Mensagem de falha de cupom segura para exibir ao cliente.
 *
 * Reasons enumeráveis (existência do código) → mensagem genérica
 * (anti-enumeração). Reasons que dependem do carrinho (`not_eligible`,
 * `min_order`) preservam o `error` original (UX legítima, não revela código).
 *
 * Fonte ÚNICA do colapso — usar em TODO caller que expõe falha de cupom ao
 * cliente (apply-coupon, place-order) para não vazar a mensagem detalhada por
 * um caminho alternativo.
 */
export function publicCouponError(
	reason: CouponFailReason,
	fallbackError: string
): string {
	return ENUMERABLE_REASONS.has(reason)
		? "Cupom inválido ou indisponível"
		: fallbackError;
}

/** Desconto do cupom em centavos, com clamp na base elegível e em zero. */
function couponDiscountCents(
	discountType: string,
	discountValue: string,
	eligibleSubtotalCents: number
): number {
	const value = Number(discountValue);

	const raw =
		discountType === "fixed"
			? Math.round(value * 100)
			: Math.round((eligibleSubtotalCents * value) / 100);

	return Math.max(0, Math.min(raw, eligibleSubtotalCents));
}

export async function validateCoupon(
	tx: typeof db,
	rawCode: string,
	lines: CouponLine[],
	autoPromoToolIds?: Set<string>
): Promise<CouponValidation> {
	const code = rawCode.trim();

	if (!code) {
		return { ok: false, error: "Cupom inválido", reason: "empty" };
	}

	const now = new Date();

	const [promo] = await tx
		.select()
		.from(promotion)
		.where(
			and(
				sql`lower(${promotion.code}) = lower(${code})`,
				eq(promotion.type, "promocode")
			)
		)
		.limit(1);

	if (!promo?.active) {
		return { ok: false, error: "Cupom inválido", reason: "invalid" };
	}

	if (promo.startsAt && promo.startsAt > now) {
		return { ok: false, error: "Cupom inválido", reason: "invalid" };
	}

	if (promo.endsAt && promo.endsAt <= now) {
		return { ok: false, error: "Cupom expirado", reason: "expired" };
	}

	if (
		promo.maxRedemptions !== null &&
		promo.redemptionCount >= promo.maxRedemptions
	) {
		return { ok: false, error: "Cupom esgotado", reason: "exhausted" };
	}

	const toolIds = Array.from(new Set(lines.map((l) => l.toolId)));

	// Escopo: null = vale para todos; senão restringe ao promotion_tool do cupom.
	let scopeToolIds: Set<string> | null = null;

	if (!promo.appliesToAll) {
		const scoped = await tx
			.select({ toolId: promotionTool.toolId })
			.from(promotionTool)
			.where(
				and(
					eq(promotionTool.promotionId, promo.id),
					inArray(promotionTool.toolId, toolIds)
				)
			);

		scopeToolIds = new Set(scoped.map((r) => r.toolId));
	}

	const autoPromoSet =
		autoPromoToolIds ??
		autoPromoToolIdsFromMap(await fetchAutoPromosByToolId(tx, toolIds, now));

	let eligibleSubtotalCents = 0;

	for (const line of lines) {
		const inScope = scopeToolIds === null || scopeToolIds.has(line.toolId);

		if (inScope && !autoPromoSet.has(line.toolId)) {
			eligibleSubtotalCents += line.basePriceCents * line.quantity;
		}
	}

	if (eligibleSubtotalCents === 0) {
		return {
			ok: false,
			error: "Cupom não cobre nenhum item do carrinho",
			reason: "not_eligible",
		};
	}

	// Decisão de produto: o pedido mínimo é avaliado contra o subtotal ELEGÍVEL
	// (itens no escopo e sem auto-promo), não o total do carrinho — mesma base do
	// desconto. O cliente precisa atingir o mínimo nos itens que o cupom cobre.
	if (promo.minOrderAmount !== null) {
		const minCents = numericToCents(promo.minOrderAmount);

		if (eligibleSubtotalCents < minCents) {
			return {
				ok: false,
				error: `Pedido mínimo de ${fmtNumericBRL(promo.minOrderAmount)}`,
				reason: "min_order",
			};
		}
	}

	return {
		ok: true,
		discountCents: couponDiscountCents(
			promo.discountType,
			promo.discountValue,
			eligibleSubtotalCents
		),
		promotionId: promo.id,
	};
}
