import { describe, expect, it } from "vitest";
import {
	buildHref,
	deriveActiveFilters,
	type FilterState,
} from "./catalog-filters";

const base: FilterState = {
	currentCategorySlug: null,
	currentCategoryName: null,
	query: "",
	sort: "relevance",
	voltages: [],
	priceMin: null,
	priceMax: null,
	onlyPromo: false,
};

describe("buildHref", () => {
	it("sem filtros devolve a raiz do catálogo", () => {
		expect(buildHref(base, {})).toBe("/catalog");
	});
	it("categoria vai no path, nunca na query", () => {
		expect(
			buildHref(base, { cat: "furadeiras", sort: "relevance", page: 1 })
		).toBe("/catalog/furadeiras");
	});
	it("categoria com page > 1 mantém a página na query", () => {
		expect(buildHref(base, { cat: "serras", page: 3 })).toBe(
			"/catalog/serras?page=3"
		);
	});
	it("mantém a categoria atual ao mudar outro filtro", () => {
		expect(
			buildHref(
				{
					...base,
					currentCategorySlug: "serras",
					currentCategoryName: "Serras",
				},
				{ sort: "price-asc" }
			)
		).toBe("/catalog/serras?sort=price-asc");
	});
	it("cat: null volta pra raiz preservando os demais filtros", () => {
		expect(
			buildHref(
				{
					...base,
					currentCategorySlug: "serras",
					currentCategoryName: "Serras",
				},
				{ cat: null, promo: true }
			)
		).toBe("/catalog?promo=1");
	});
	it("serializa voltagens separadas por vírgula", () => {
		expect(buildHref(base, { voltage: ["127V", "220V"] })).toBe(
			"/catalog?voltage=127V%2C220V"
		);
	});
	it("escapa slug com caractere especial", () => {
		expect(buildHref(base, { cat: "epi/luvas" })).toBe("/catalog/epi%2Fluvas");
	});
});

describe("deriveActiveFilters", () => {
	it("returns empty when nothing is active", () => {
		expect(deriveActiveFilters(base)).toEqual([]);
	});

	it("adds a category chip removable by clearing cat", () => {
		const r = deriveActiveFilters({
			...base,
			currentCategorySlug: "furadeiras",
			currentCategoryName: "Furadeiras",
		});
		expect(r).toHaveLength(1);
		expect(r[0]).toMatchObject({
			kind: "Categoria",
			value: "Furadeiras",
			remove: { cat: null },
		});
	});

	it("adds one chip per voltage, preserving the others on remove", () => {
		const r = deriveActiveFilters({ ...base, voltages: ["127V", "220V"] });
		expect(r).toHaveLength(2);
		expect(r[0].remove).toEqual({ voltage: ["220V"] });
		expect(r[1].remove).toEqual({ voltage: ["127V"] });
	});

	it("adds a single price chip removing both bounds", () => {
		const r = deriveActiveFilters({ ...base, priceMin: 100, priceMax: 500 });
		expect(r).toHaveLength(1);
		expect(r[0]).toMatchObject({
			kind: "Preço",
			remove: { pmin: null, pmax: null },
		});
	});

	it("adds a promo chip and a search chip", () => {
		const r = deriveActiveFilters({ ...base, onlyPromo: true, query: "serra" });
		const ids = r.map((f) => f.id);
		expect(ids).toContain("promo");
		expect(ids).toContain("q");
	});
});
