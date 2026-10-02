import { describe, expect, it } from "vitest";
import {
	type CartItem,
	cartSubtotalCents,
	reconcilePrices,
} from "./cart-store";

const item = (variantId: string, priceAmount: string): CartItem => ({
	variantId,
	priceAmount,
	toolId: "t",
	sku: "s",
	name: "n",
	slug: "sl",
	quantity: 1,
	categoryName: null,
	categorySlug: null,
	imageUrl: null,
	voltage: null,
});

describe("reconcilePrices", () => {
	it("atualiza o preço dos itens presentes no map", () => {
		const items = [item("v1", "100.00"), item("v2", "50.00")];
		const next = reconcilePrices(items, new Map([["v1", "85.00"]]));
		expect(next.find((i) => i.variantId === "v1")?.priceAmount).toBe("85.00");
		expect(next.find((i) => i.variantId === "v2")?.priceAmount).toBe("50.00");
	});

	it("retorna a MESMA referência quando nada muda (evita re-render)", () => {
		const items = [item("v1", "100.00")];
		const next = reconcilePrices(items, new Map([["v1", "100.00"]]));
		expect(next).toBe(items);
	});
});

describe("cartSubtotalCents", () => {
	it("soma preço vezes quantidade em centavos", () => {
		const items = [
			{ ...item("v1", "899.90"), quantity: 2 },
			{ ...item("v2", "0.10"), quantity: 3 },
		];
		expect(cartSubtotalCents(items)).toBe(180_010);
	});

	it("carrinho vazio vale 0", () => {
		expect(cartSubtotalCents([])).toBe(0);
	});
});
