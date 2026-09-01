import { describe, expect, it } from "vitest";
import { parseCatalogSearchParams } from "./parse-search-params";

describe("parseCatalogSearchParams", () => {
	it("defaults com params vazios", () => {
		expect(parseCatalogSearchParams({})).toEqual({
			onlyPromo: false,
			page: 1,
			priceMax: undefined,
			priceMin: undefined,
			q: "",
			search: undefined,
			sort: "relevance",
			voltages: [],
		});
	});
	it("descarta sort e voltagem inválidos, mantém válidos", () => {
		const out = parseCatalogSearchParams({
			sort: "price-asc",
			voltage: "127V,999V,Bivolt",
		});
		expect(out.sort).toBe("price-asc");
		expect(out.voltages).toEqual(["127V", "Bivolt"]);
		expect(parseCatalogSearchParams({ sort: "xyz" }).sort).toBe("relevance");
	});
	it("page mínima é 1; preços negativos ou NaN viram undefined", () => {
		const out = parseCatalogSearchParams({
			page: "0",
			pmin: "-5",
			pmax: "abc",
		});
		expect(out.page).toBe(1);
		expect(out.priceMin).toBeUndefined();
		expect(out.priceMax).toBeUndefined();
		expect(parseCatalogSearchParams({ page: "3", pmin: "100" })).toMatchObject({
			page: 3,
			priceMin: 100,
		});
	});
	it("q vazio ou só espaços não vira search", () => {
		expect(parseCatalogSearchParams({ q: "   " })).toMatchObject({
			q: "   ",
			search: undefined,
		});
		expect(parseCatalogSearchParams({ q: " serra " })).toMatchObject({
			q: " serra ",
			search: "serra",
		});
	});
	it("param repetido (array) usa a primeira ocorrência", () => {
		const out = parseCatalogSearchParams({
			q: ["a", "b"],
			voltage: ["127V", "220V"],
			page: ["3", "9"],
		});
		expect(out.q).toBe("a");
		expect(out.search).toBe("a");
		expect(out.voltages).toEqual(["127V"]);
		expect(out.page).toBe(3);
	});
	it("promo=1 liga onlyPromo", () => {
		expect(parseCatalogSearchParams({ promo: "1" }).onlyPromo).toBe(true);
		expect(parseCatalogSearchParams({ promo: "true" }).onlyPromo).toBe(false);
	});
});
