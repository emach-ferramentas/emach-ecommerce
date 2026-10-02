import type { SortKey, VoltageKey } from "./catalog-filters";

export interface CatalogViewInput {
	cat?: string;
	onlyPromo: boolean;
	page: number;
	priceMax?: number;
	priceMin?: number;
	search?: string;
	sort: SortKey;
	voltages: VoltageKey[];
}

/**
 * O catálogo sem nenhum recorte abre como vitrine de prateleiras (uma por
 * ofício, ou por categoria sem ofícios). Qualquer recorte (categoria, busca,
 * filtro, ordenação ou página além da 1ª) mostra a grade paginada.
 */
export function catalogView(input: CatalogViewInput): "grid" | "shelves" {
	const narrowed =
		Boolean(input.cat) ||
		Boolean(input.search?.trim()) ||
		input.voltages.length > 0 ||
		input.priceMin !== undefined ||
		input.priceMax !== undefined ||
		input.onlyPromo ||
		input.sort !== "relevance" ||
		input.page > 1;
	return narrowed ? "grid" : "shelves";
}
