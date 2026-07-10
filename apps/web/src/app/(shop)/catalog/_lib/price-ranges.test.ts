import { describe, expect, it } from "vitest";
import { matchPriceRange, PRICE_RANGES } from "./price-ranges";

describe("PRICE_RANGES", () => {
	it("tem 4 faixas na ordem de exibição", () => {
		expect(PRICE_RANGES.map((r) => r.key)).toEqual([
			"ate-200",
			"200-500",
			"500-1000",
			"acima-1000",
		]);
	});

	it("labels em BRL sem em-dash", () => {
		expect(PRICE_RANGES.map((r) => r.label)).toEqual([
			"Até R$ 200",
			"R$ 200 – 500",
			"R$ 500 – 1.000",
			"Acima de R$ 1.000",
		]);
	});
});

describe("matchPriceRange", () => {
	it("casa cada preset pelos limites exatos", () => {
		expect(matchPriceRange(null, 200)).toBe("ate-200");
		expect(matchPriceRange(200, 500)).toBe("200-500");
		expect(matchPriceRange(500, 1000)).toBe("500-1000");
		expect(matchPriceRange(1000, null)).toBe("acima-1000");
	});

	it("null quando não há filtro de preço", () => {
		expect(matchPriceRange(null, null)).toBeNull();
	});

	it("null para valores custom que não casam com preset", () => {
		expect(matchPriceRange(150, 900)).toBeNull();
		expect(matchPriceRange(200, null)).toBeNull();
		expect(matchPriceRange(null, 500)).toBeNull();
	});
});
