import { describe, expect, it } from "vitest";
import { hasPrice } from "./sellable-variant";

describe("hasPrice", () => {
	it("aceita variante com preço", () => {
		expect(hasPrice({ id: "v1", priceAmount: "199.90" })).toBe(true);
	});

	it("rejeita variante sem preço (rascunho do dashboard)", () => {
		expect(hasPrice({ id: "v1", priceAmount: null })).toBe(false);
	});

	it("estreita o tipo no filter", () => {
		const variants = [
			{ id: "a", priceAmount: "10.00" },
			{ id: "b", priceAmount: null },
		];
		const priced = variants.filter(hasPrice);
		expect(priced.map((v) => v.id)).toEqual(["a"]);
		// `priceAmount` é string após o filtro — compila sem `!`.
		expect(priced[0]?.priceAmount.length).toBe(5);
	});
});
