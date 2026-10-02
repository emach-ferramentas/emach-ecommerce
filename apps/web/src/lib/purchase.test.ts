import { describe, expect, it } from "vitest";
import {
	buildCartItem,
	discountedAmount,
	initialVariantId,
	sellableVariants,
	variantPrice,
} from "./purchase";

const percent10 = { discountType: "percent", discountValue: "10" };

describe("sellableVariants", () => {
	it("tira a variante sem preço e põe a default primeiro, depois por sortOrder", () => {
		const list = sellableVariants([
			{ id: "c", isDefault: false, priceAmount: "10.00", sortOrder: 2 },
			{ id: "rascunho", isDefault: false, priceAmount: null, sortOrder: 0 },
			{ id: "b", isDefault: false, priceAmount: "10.00", sortOrder: 1 },
			{ id: "a", isDefault: true, priceAmount: "10.00", sortOrder: 9 },
		]);
		expect(list.map((v) => v.id)).toEqual(["a", "b", "c"]);
	});
});

describe("discountedAmount e variantPrice", () => {
	it("aplica a promoção percentual e calcula o desconto inteiro", () => {
		expect(discountedAmount("536.18", percent10)).toBe("482.56");
		expect(variantPrice("536.18", percent10)).toEqual({
			baseCents: 53_618,
			discountPct: 10,
			finalAmount: "482.56",
			finalCents: 48_256,
			hasDiscount: true,
		});
	});

	it("promoção fixa maior que o preço zera, nunca fica negativa", () => {
		expect(
			discountedAmount("50.00", { discountType: "fixed", discountValue: "80" })
		).toBe("0.00");
	});

	it("sem promoção ou com promoção que não baixa, mantém o preço", () => {
		expect(discountedAmount("99.90", null)).toBeNull();
		expect(
			discountedAmount("99.90", { discountType: "percent", discountValue: "0" })
		).toBeNull();
		expect(variantPrice("99.90", null)).toMatchObject({
			discountPct: 0,
			finalAmount: "99.90",
			hasDiscount: false,
		});
	});
});

describe("initialVariantId", () => {
	it("pré-seleciona só quando há uma variante", () => {
		expect(initialVariantId([{ id: "única" }])).toBe("única");
		expect(initialVariantId([{ id: "127" }, { id: "220" }])).toBeNull();
		expect(initialVariantId([])).toBeNull();
	});
});

describe("buildCartItem", () => {
	it("leva o preço final e a variante escolhida para o carrinho", () => {
		const item = buildCartItem(
			{
				categoryName: "Elétricas",
				categorySlug: "eletricas",
				imageUrl: "https://img/x.webp",
				name: "Lixadeira girafa",
				slug: "lixadeira-girafa",
				toolId: "tool-1",
			},
			{ id: "var-220", sku: "ELT800-BR2", voltage: "220V" },
			"482.56"
		);
		expect(item).toEqual({
			categoryName: "Elétricas",
			categorySlug: "eletricas",
			imageUrl: "https://img/x.webp",
			name: "Lixadeira girafa",
			priceAmount: "482.56",
			sku: "ELT800-BR2",
			slug: "lixadeira-girafa",
			toolId: "tool-1",
			variantId: "var-220",
			voltage: "220V",
		});
	});
});
