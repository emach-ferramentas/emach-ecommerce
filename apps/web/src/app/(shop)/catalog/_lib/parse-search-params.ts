import type { SortKey, VoltageKey } from "./catalog-filters";

const VALID_SORTS: readonly SortKey[] = [
	"relevance",
	"price-asc",
	"price-desc",
	"name-asc",
	"newest",
];

const VALID_VOLTAGES: readonly VoltageKey[] = [
	"127V",
	"220V",
	"Bivolt",
	"380V",
];

/**
 * Um param pode chegar repetido (`?q=a&q=b`) — o Next entrega array nesse caso.
 * Tipar como string pura fazia `q.trim()` estourar e derrubar a listagem.
 */
type Param = string | string[] | undefined;

export interface CatalogSearchParams {
	cat?: Param;
	page?: Param;
	pmax?: Param;
	pmin?: Param;
	promo?: Param;
	q?: Param;
	sort?: Param;
	voltage?: Param;
}

/** Primeira ocorrência de um param repetido. */
function first(value: Param): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

export interface ParsedCatalogParams {
	onlyPromo: boolean;
	page: number;
	priceMax?: number;
	priceMin?: number;
	/** Texto cru do input (pra repovoar o campo). */
	q: string;
	/** Texto normalizado usado na query; undefined quando vazio. */
	search?: string;
	sort: SortKey;
	voltages: VoltageKey[];
}

function parseSort(value: string | undefined): SortKey {
	return value && (VALID_SORTS as readonly string[]).includes(value)
		? (value as SortKey)
		: "relevance";
}

function parseVoltages(value: string | undefined): VoltageKey[] {
	if (!value) {
		return [];
	}
	return value
		.split(",")
		.filter((v): v is VoltageKey =>
			(VALID_VOLTAGES as readonly string[]).includes(v)
		);
}

function parsePositiveInt(value: string | undefined): number | undefined {
	if (!value) {
		return;
	}
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseCatalogSearchParams(
	params: CatalogSearchParams
): ParsedCatalogParams {
	const q = first(params.q) ?? "";
	const trimmed = q.trim();
	return {
		onlyPromo: first(params.promo) === "1",
		page: Math.max(1, parsePositiveInt(first(params.page)) ?? 1),
		priceMax: parsePositiveInt(first(params.pmax)),
		priceMin: parsePositiveInt(first(params.pmin)),
		q,
		search: trimmed ? trimmed : undefined,
		sort: parseSort(first(params.sort)),
		voltages: parseVoltages(first(params.voltage)),
	};
}
