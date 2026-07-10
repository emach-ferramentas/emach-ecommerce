export type PriceRangeKey = "ate-200" | "200-500" | "500-1000" | "acima-1000";

export interface PriceRange {
	key: PriceRangeKey;
	label: string;
	/** Limites que a faixa aplica em pmin/pmax da URL (null = sem limite). */
	pmax: number | null;
	pmin: number | null;
}

// Faixas estáticas (decisão do spec). O en dash (–) do label é tipográfico
// de intervalo numérico, não em-dash de prosa.
export const PRICE_RANGES: PriceRange[] = [
	{ key: "ate-200", label: "Até R$ 200", pmin: null, pmax: 200 },
	{ key: "200-500", label: "R$ 200 – 500", pmin: 200, pmax: 500 },
	{ key: "500-1000", label: "R$ 500 – 1.000", pmin: 500, pmax: 1000 },
	{ key: "acima-1000", label: "Acima de R$ 1.000", pmin: 1000, pmax: null },
];

/** Preset cujos limites casam EXATAMENTE com pmin/pmax da URL; senão null. */
export function matchPriceRange(
	pmin: number | null,
	pmax: number | null
): PriceRangeKey | null {
	if (pmin === null && pmax === null) {
		return null;
	}
	const found = PRICE_RANGES.find((r) => r.pmin === pmin && r.pmax === pmax);
	return found?.key ?? null;
}
