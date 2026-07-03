import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectWhere } = vi.hoisted(() => ({ selectWhere: vi.fn() }));

vi.mock("@emach/db", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({ where: selectWhere })),
		})),
	},
}));
vi.mock("@emach/db/queries/shipping", () => ({ getActiveBoxes: vi.fn() }));
vi.mock("@/lib/frenet/client", () => ({ fetchFrenetQuote: vi.fn() }));
vi.mock("@/lib/frenet/cache", () => ({
	buildQuoteCacheKey: vi.fn(() => "cache-key"),
	getCachedQuote: vi.fn(),
	setCachedQuote: vi.fn(),
}));

import { getActiveBoxes } from "@emach/db/queries/shipping";
import { env } from "@emach/env/server";
import { getCachedQuote, setCachedQuote } from "@/lib/frenet/cache";
import { fetchFrenetQuote } from "@/lib/frenet/client";
import { quoteShipping } from "./quote";

// Ferramenta 30×20×10cm, 1.2kg + 0.3kg embalagem, empilhável.
const TOOL_ROW = {
	id: "t1",
	weightKg: "1.200",
	lengthCm: "30.00",
	widthCm: "20.00",
	heightCm: "10.00",
	packagingWeightKg: "0.300",
	stackable: true,
	shipsInOwnBox: false,
};

// Caixa 40×30×20cm interna, 20kg máx, 0.5kg de tara.
const BOX = {
	id: "box-m",
	internalLengthCm: 40,
	internalWidthCm: 30,
	internalHeightCm: 20,
	maxWeightKg: 20,
	tareWeightKg: 0.5,
};

const FRENET_OK = {
	ShippingSevicesArray: [
		{
			Carrier: "Correios",
			CarrierCode: "COR",
			ServiceCode: "40010",
			ServiceDescription: "Sedex",
			ShippingPrice: "31.71",
			DeliveryTime: "5",
			Error: false,
		},
	],
};

beforeEach(() => {
	vi.mocked(getActiveBoxes).mockResolvedValue([BOX]);
	selectWhere.mockResolvedValue([TOOL_ROW]);
	vi.mocked(getCachedQuote).mockResolvedValue(null);
	vi.mocked(setCachedQuote).mockResolvedValue(undefined);
	vi.mocked(fetchFrenetQuote).mockReset();
});

describe("quoteShipping (adapter Frenet)", () => {
	it("empacota o carrinho e envia as CAIXAS como ShippingItemArray", async () => {
		vi.mocked(fetchFrenetQuote).mockResolvedValue(FRENET_OK);

		const result = await quoteShipping({
			destinationCep: "14270-000",
			items: [{ toolId: "t1", quantity: 2 }],
			declaredValueCents: 32_068,
		});

		expect(result.negotiate).toBe(false);
		expect(result.options).toEqual([
			{
				carrierId: "COR-40010",
				name: "Correios — Sedex",
				priceCents: 3171,
				deliveryDays: 5,
			},
		]);

		const body = vi.mocked(fetchFrenetQuote).mock.calls[0]?.[0];
		expect(body?.SellerCEP).toBe(env.FRENET_SELLER_CEP);
		expect(body?.RecipientCEP).toBe("14270000"); // normalizado (só dígitos)
		expect(body?.ShipmentInvoiceValue).toBeCloseTo(320.68);
		// 2 unidades consolidadas em UMA caixa real pelo packItems:
		// peso = 2×(1.2+0.3) + 0.5 tara = 3.5kg; dims = internas da caixa.
		expect(body?.ShippingItemArray).toEqual([
			{ Weight: 3.5, Length: 40, Height: 20, Width: 30, Quantity: 1 },
		]);
		expect(setCachedQuote).toHaveBeenCalledWith("cache-key", result);
	});

	it("item sem caixa no catálogo → negotiate SEM gastar chamada Frenet", async () => {
		vi.mocked(getActiveBoxes).mockResolvedValue([]);

		const result = await quoteShipping({
			destinationCep: "14270000",
			items: [{ toolId: "t1", quantity: 1 }],
		});

		expect(result).toEqual({ negotiate: true, options: [] });
		expect(fetchFrenetQuote).not.toHaveBeenCalled();
	});

	it("cache hit → retorna a cotação cacheada sem chamar a Frenet", async () => {
		const cached = {
			negotiate: false,
			options: [
				{
					carrierId: "COR-40010",
					name: "Correios — Sedex",
					priceCents: 3171,
					deliveryDays: 5,
				},
			],
		};
		vi.mocked(getCachedQuote).mockResolvedValue(cached);

		const result = await quoteShipping({
			destinationCep: "14270000",
			items: [{ toolId: "t1", quantity: 1 }],
			declaredValueCents: 1000,
		});

		expect(result).toEqual(cached);
		expect(fetchFrenetQuote).not.toHaveBeenCalled();
	});
});
