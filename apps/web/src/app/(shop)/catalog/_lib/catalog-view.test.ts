import { describe, expect, it } from "vitest";
import { type CatalogViewInput, catalogView } from "./catalog-view";

const BASE: CatalogViewInput = {
	onlyPromo: false,
	page: 1,
	sort: "relevance",
	voltages: [],
};

describe("catalogView", () => {
	it("catálogo sem recorte na 1ª página abre em prateleiras", () => {
		expect(catalogView(BASE)).toBe("shelves");
		expect(catalogView({ ...BASE, search: "   " })).toBe("shelves");
	});

	it.each<[string, Partial<CatalogViewInput>]>([
		["categoria ou ofício", { cat: "reboco-e-acabamento" }],
		["busca", { search: "lixadeira" }],
		["voltagem", { voltages: ["220V"] }],
		["preço mínimo", { priceMin: 0 }],
		["preço máximo", { priceMax: 500 }],
		["só promoção", { onlyPromo: true }],
		["ordenação", { sort: "price-asc" }],
		["página 2", { page: 2 }],
	])("com %s mostra a grade", (_label, change) => {
		expect(catalogView({ ...BASE, ...change })).toBe("grid");
	});
});
