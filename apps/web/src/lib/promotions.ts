/**
 * Preço unitário (em centavos) após UMA promoção automática.
 * `percent`: base × (1 − valor/100); `fixed`: max(base − valor, 0).
 * Espelha a regra do SQL em packages/db/src/queries/tools.ts.
 */
export function effectiveAutoDiscountCents(
	baseCents: number,
	discountType: string,
	discountValue: string
): number {
	const value = Number(discountValue);
	if (!Number.isFinite(value) || value <= 0) {
		return baseCents;
	}
	if (discountType === "fixed") {
		return Math.max(baseCents - Math.round(value * 100), 0);
	}
	return Math.round(baseCents * (1 - value / 100));
}
