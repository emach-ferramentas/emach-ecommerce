import type { ToolListItem } from "@emach/db/queries/tools";

function toCents(amount: string | null): number | null {
	if (amount === null) {
		return null;
	}
	const value = Number(amount);
	return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/**
 * Preço de vitrine em centavos: o com promoção quando houver. `null` para a
 * variante de rascunho sem preço que a query dashboard-owned ainda deixa passar
 * tipada como `string` (CLAUDE.md, "Variante sem preço"): ali a promoção fixa
 * vira `GREATEST(NULL - x, 0) = 0`, então o preço base decide.
 */
export function listPriceCents(
	tool: Pick<ToolListItem, "defaultVariant">
): number | null {
	const { discountedAmount, priceAmount } = tool.defaultVariant as {
		discountedAmount: string | null;
		priceAmount: string | null;
	};
	const base = toCents(priceAmount);
	if (base === null) {
		return null;
	}
	return toCents(discountedAmount) ?? base;
}

/** Em estoque primeiro, preservando a ordem da query dentro de cada grupo. */
export function sortInStockFirst<T extends { inStock: boolean }>(
	items: T[]
): T[] {
	return [
		...items.filter((item) => item.inStock),
		...items.filter((item) => !item.inStock),
	];
}
