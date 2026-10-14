import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type CartItem,
	cartSubtotalCents,
	loadCart,
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

describe("loadCart", () => {
	const stored = new Map<string, string>();

	beforeEach(() => {
		stored.clear();
		vi.stubGlobal("window", {});
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => stored.get(key) ?? null,
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const save = (value: unknown) => {
		stored.set("emach:cart:v2", JSON.stringify(value));
	};

	const valid = { ...item("v1", "899.90"), voltage: "220V" };

	it("mantém o item válido", () => {
		save([valid]);

		expect(loadCart()).toStrictEqual([valid]);
	});

	it("tira o item corrompido e mantém os válidos", () => {
		const { sku: _sku, ...semSku } = item("v4", "10.00");

		save([
			{ ...item("v2", "10.00"), quantity: 0 },
			valid,
			{ ...item("v3", "10.00"), voltage: "110V" },
			semSku,
			null,
		]);

		expect(loadCart()).toStrictEqual([valid]);
	});

	it("JSON que não é array vira carrinho vazio", () => {
		save({ items: [valid] });

		expect(loadCart()).toStrictEqual([]);
	});

	it("storage com JSON inválido vira carrinho vazio", () => {
		stored.set("emach:cart:v2", "{quebrado");

		expect(loadCart()).toStrictEqual([]);
	});

	it("storage vazio vira carrinho vazio", () => {
		expect(loadCart()).toStrictEqual([]);
	});
});
