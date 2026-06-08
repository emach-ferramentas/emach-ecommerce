export type SortKey =
	| "relevance"
	| "price-asc"
	| "price-desc"
	| "name-asc"
	| "newest";
export type VoltageKey = "127V" | "220V" | "Bivolt" | "380V";

export interface FilterState {
	currentCategorySlug: string | null;
	currentCategoryName: string | null;
	query: string;
	sort: SortKey;
	voltages: VoltageKey[];
	priceMin: number | null;
	priceMax: number | null;
	onlyPromo: boolean;
}

export interface FilterUpdate {
	cat?: string | null;
	q?: string | null;
	sort?: SortKey | null;
	voltage?: VoltageKey[] | null;
	pmin?: number | null;
	pmax?: number | null;
	promo?: boolean | null;
	page?: number | null;
}

export interface ActiveFilter {
	id: string;
	/** Rótulo do tipo do filtro (vazio quando o valor já é autoexplicativo). */
	kind: string;
	value: string;
	remove: FilterUpdate;
}

export function buildHref(current: FilterState, updates: FilterUpdate): string {
	const params = new URLSearchParams();
	const cat = "cat" in updates ? updates.cat : current.currentCategorySlug;
	const q = "q" in updates ? updates.q : current.query;
	const sort = "sort" in updates ? updates.sort : current.sort;
	const voltage = "voltage" in updates ? updates.voltage : current.voltages;
	const pmin = "pmin" in updates ? updates.pmin : current.priceMin;
	const pmax = "pmax" in updates ? updates.pmax : current.priceMax;
	const promo = "promo" in updates ? updates.promo : current.onlyPromo;
	const page = "page" in updates ? updates.page : null;

	if (cat) {
		params.set("cat", cat);
	}
	if (q) {
		params.set("q", q);
	}
	if (sort && sort !== "relevance") {
		params.set("sort", sort);
	}
	if (voltage && voltage.length > 0) {
		params.set("voltage", voltage.join(","));
	}
	if (pmin != null) {
		params.set("pmin", String(pmin));
	}
	if (pmax != null) {
		params.set("pmax", String(pmax));
	}
	if (promo) {
		params.set("promo", "1");
	}
	if (page && page > 1) {
		params.set("page", String(page));
	}

	const qs = params.toString();
	return qs ? `?${qs}` : "";
}

export function deriveActiveFilters(state: FilterState): ActiveFilter[] {
	const out: ActiveFilter[] = [];

	if (state.currentCategorySlug && state.currentCategoryName) {
		out.push({
			id: "cat",
			kind: "Categoria",
			value: state.currentCategoryName,
			remove: { cat: null },
		});
	}

	if (state.query.trim()) {
		out.push({
			id: "q",
			kind: "Busca",
			value: `“${state.query.trim()}”`,
			remove: { q: null },
		});
	}

	for (const v of state.voltages) {
		const rest = state.voltages.filter((x) => x !== v);
		out.push({
			id: `voltage-${v}`,
			kind: "Voltagem",
			value: v,
			remove: { voltage: rest.length > 0 ? rest : null },
		});
	}

	if (state.priceMin != null || state.priceMax != null) {
		const min = state.priceMin != null ? `R$ ${state.priceMin}` : "—";
		const max = state.priceMax != null ? `R$ ${state.priceMax}` : "—";
		out.push({
			id: "price",
			kind: "Preço",
			value: `${min} – ${max}`,
			remove: { pmin: null, pmax: null },
		});
	}

	if (state.onlyPromo) {
		out.push({
			id: "promo",
			kind: "",
			value: "Em promoção",
			remove: { promo: null },
		});
	}

	return out;
}
