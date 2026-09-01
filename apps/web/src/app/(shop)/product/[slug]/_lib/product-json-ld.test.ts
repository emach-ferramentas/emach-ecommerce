import { describe, expect, it } from "vitest";
import {
	buildBreadcrumbJsonLd,
	buildProductJsonLd,
	type ProductJsonLd,
	type ProductJsonLdInput,
	priceValidUntil,
} from "./product-json-ld";

const BASE = "https://www.emachferramentas.com.br";
const NOW = new Date("2026-09-01T12:00:00Z");

const v1 = {
	barcode: "7891234567895",
	id: "v1",
	priceAmount: "899.00" as string | null,
	sku: "FX-127",
};
const v2 = {
	barcode: "ABC",
	id: "v2",
	priceAmount: "899.00" as string | null,
	sku: "FX-220",
};

const input: ProductJsonLdInput = {
	activePromotion: null,
	images: [{ url: "https://cdn/img1.jpg" }, { url: "https://cdn/img2.jpg" }],
	reviewStats: { avg: 4.456, count: 3 },
	stockByVariant: { v1: true, v2: false },
	tool: {
		description: "Furadeira de impacto <b>profissional</b>",
		id: "t1",
		manufacturerName: "Bosch",
		name: "Furadeira X",
		slug: "furadeira-x",
	},
	variants: [v1, v2],
};

/** `buildProductJsonLd` pode devolver null; nos casos válidos falha alto. */
function buildOk(
	data: ProductJsonLdInput,
	opts: { baseUrl: string; now: Date }
): ProductJsonLd {
	const out = buildProductJsonLd(data, opts);
	if (out === null) {
		throw new Error("esperava um Product JSON-LD, veio null");
	}
	return out;
}

describe("priceValidUntil", () => {
	it("usa o fim da promoção quando existe", () => {
		expect(
			priceValidUntil({ endsAt: new Date("2026-10-15T03:00:00Z") }, NOW)
		).toBe("2026-10-15");
	});
	it("sem promoção (ou sem fim) vale um ano a partir de agora", () => {
		expect(priceValidUntil(null, NOW)).toBe("2027-09-01");
		expect(priceValidUntil({ endsAt: null }, NOW)).toBe("2027-09-01");
	});
	it("promoção já vencida (cache stale) cai no +1 ano", () => {
		expect(
			priceValidUntil({ endsAt: new Date("2026-08-01T00:00:00Z") }, NOW)
		).toBe("2027-09-01");
	});
});

describe("buildProductJsonLd", () => {
	it("monta uma Offer por variante com condição, validade e disponibilidade", () => {
		const data = buildOk(input, { baseUrl: BASE, now: NOW });
		expect(data).toMatchObject({
			"@context": "https://schema.org",
			"@type": "Product",
			aggregateRating: {
				"@type": "AggregateRating",
				ratingValue: 4.46,
				reviewCount: 3,
			},
			brand: { "@type": "Brand", name: "Bosch" },
			image: ["https://cdn/img1.jpg", "https://cdn/img2.jpg"],
			name: "Furadeira X",
			sku: "FX-127",
		});
		expect(data.offers).toEqual([
			{
				"@id": `${BASE}/product/furadeira-x#offer-FX-127`,
				"@type": "Offer",
				availability: "https://schema.org/InStock",
				gtin: "7891234567895",
				itemCondition: "https://schema.org/NewCondition",
				price: "899.00",
				priceCurrency: "BRL",
				priceValidUntil: "2027-09-01",
				sku: "FX-127",
				url: `${BASE}/product/furadeira-x`,
			},
			{
				"@id": `${BASE}/product/furadeira-x#offer-FX-220`,
				"@type": "Offer",
				availability: "https://schema.org/OutOfStock",
				itemCondition: "https://schema.org/NewCondition",
				price: "899.00",
				priceCurrency: "BRL",
				priceValidUntil: "2027-09-01",
				sku: "FX-220",
				url: `${BASE}/product/furadeira-x`,
			},
		]);
		expect(data).not.toHaveProperty("hasMerchantReturnPolicy");
	});

	it("aplica a promoção ao preço e ao priceValidUntil", () => {
		const data = buildOk(
			{
				...input,
				activePromotion: {
					discountType: "percent",
					discountValue: "10.00",
					endsAt: new Date("2026-09-30T03:00:00Z"),
				},
				variants: [v1],
			},
			{ baseUrl: BASE, now: NOW }
		);
		// uma variante só → offers é objeto, não array
		expect(data.offers).toMatchObject({
			price: "809.10",
			priceValidUntil: "2026-09-30",
		});
	});

	it("omite rating sem avaliações e usa id quando não há slug", () => {
		const data = buildOk(
			{
				...input,
				reviewStats: { avg: null, count: 0 },
				tool: { ...input.tool, slug: null },
			},
			{ baseUrl: BASE, now: NOW }
		);
		expect(data).not.toHaveProperty("aggregateRating");
		const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
		expect(offers[0]?.url).toBe(`${BASE}/product/t1`);
	});

	it("escapa caracteres do sku no @id da Offer", () => {
		const data = buildOk(
			{ ...input, variants: [{ ...v1, sku: "FX 127#a" }] },
			{ baseUrl: BASE, now: NOW }
		);
		expect(data.offers).toMatchObject({
			"@id": `${BASE}/product/furadeira-x#offer-FX%20127%23a`,
		});
	});

	it("variante sem preço não gera Offer", () => {
		const one = buildOk(
			{ ...input, variants: [{ ...v1, priceAmount: null }, v2] },
			{ baseUrl: BASE, now: NOW }
		);
		expect(one.offers).toMatchObject({ sku: "FX-220" }); // sobrou uma → objeto
		expect(one.sku).toBe("FX-127");
	});

	it("sem nenhuma Offer e sem rating não emite JSON-LD", () => {
		const none = buildProductJsonLd(
			{
				...input,
				reviewStats: { avg: null, count: 0 },
				variants: input.variants.map((v) => ({ ...v, priceAmount: null })),
			},
			{ baseUrl: BASE, now: NOW }
		);
		expect(none).toBeNull();
	});

	it("sem Offer mas com rating, o Product sai sem offers", () => {
		const data = buildOk(
			{
				...input,
				reviewStats: { avg: 4.5, count: 2 },
				variants: input.variants.map((v) => ({ ...v, priceAmount: null })),
			},
			{ baseUrl: BASE, now: NOW }
		);
		expect(data).not.toHaveProperty("offers");
		expect(data.aggregateRating).toMatchObject({
			ratingValue: 4.5,
			reviewCount: 2,
		});
	});

	it("gtin só com 8/12/13/14 dígitos", () => {
		const data = buildOk(
			{
				...input,
				variants: [
					{ barcode: "12345678", id: "a", priceAmount: "10.00", sku: "A" },
					{ barcode: "1234567", id: "b", priceAmount: "10.00", sku: "B" },
					{
						barcode: " 123456789012 ",
						id: "c",
						priceAmount: "10.00",
						sku: "C",
					},
					{ barcode: null, id: "d", priceAmount: "10.00", sku: "D" },
				],
			},
			{ baseUrl: BASE, now: NOW }
		);
		const offers = Array.isArray(data.offers) ? data.offers : [];
		expect(offers.map((o) => o.gtin)).toEqual([
			"12345678",
			undefined,
			"123456789012",
			undefined,
		]);
	});
});

describe("buildBreadcrumbJsonLd", () => {
	it("inclui a categoria quando existe", () => {
		const data = buildBreadcrumbJsonLd({
			baseUrl: BASE,
			category: { name: "Furadeiras", slug: "furadeiras" },
			productName: "Furadeira X",
			slug: "furadeira-x",
		});
		expect(data.itemListElement.map((i) => i.name)).toEqual([
			"Início",
			"Catálogo",
			"Furadeiras",
			"Furadeira X",
		]);
		expect(data.itemListElement[2]?.item).toBe(
			`${BASE}/catalog?cat=furadeiras`
		);
	});

	it("sem categoria fica com 3 itens em sequência", () => {
		const data = buildBreadcrumbJsonLd({
			baseUrl: BASE,
			category: null,
			productName: "Furadeira X",
			slug: "furadeira-x",
		});
		expect(data.itemListElement.map((i) => i.name)).toEqual([
			"Início",
			"Catálogo",
			"Furadeira X",
		]);
		expect(data.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
	});
});
