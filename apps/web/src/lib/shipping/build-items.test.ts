import { describe, expect, it } from "vitest";
import { buildQuoteItems, hasShippingDims } from "./build-items";

const row = {
	id: "t1",
	weightKg: "2.500",
	lengthCm: "30.00",
	widthCm: "20.00",
	heightCm: "10.00",
	packagingWeightKg: "0.300",
	stackable: true,
	shipsInOwnBox: false,
};

describe("buildQuoteItems", () => {
	it("converte numeric (string) para number e propaga qty", () => {
		expect(buildQuoteItems([row], [{ toolId: "t1", quantity: 2 }])).toEqual([
			{
				heightCm: 10,
				lengthCm: 30,
				widthCm: 20,
				weightKg: 2.5,
				packagingWeightKg: 0.3,
				stackable: true,
				shipsInOwnBox: false,
				qty: 2,
			},
		]);
	});

	it("lança quando a ferramenta não existe", () => {
		expect(() => buildQuoteItems([], [{ toolId: "x", quantity: 1 }])).toThrow(
			"Ferramenta x não encontrada"
		);
	});
});

describe("hasShippingDims", () => {
	it("aceita linha com peso e dimensões", () => {
		expect(hasShippingDims(row)).toBe(true);
	});

	it.each([
		"weightKg",
		"lengthCm",
		"widthCm",
		"heightCm",
	] as const)("rejeita linha sem %s", (field) => {
		expect(hasShippingDims({ ...row, [field]: null })).toBe(false);
	});
});
