import { afterEach, describe, expect, it, vi } from "vitest";

import { FrenetError, fetchFrenetAddress, fetchFrenetQuote } from "./client";
import { mapFrenetResponse } from "./map";
import type { FrenetQuoteRequest } from "./types";

const QUOTE_URL_RE = /\/shipping\/quote$/;
const FORA_DO_FORMATO_RE = /fora do formato/;
const SERVICES_KEY_RE = /ShippingSevicesArray/;

const BODY: FrenetQuoteRequest = {
	SellerCEP: "01310100",
	RecipientCEP: "14270000",
	ShipmentInvoiceValue: 320.68,
	RecipientCountry: "BR",
	ShippingItemArray: [
		{ Height: 20, Length: 40, Quantity: 1, Weight: 3.5, Width: 30 },
	],
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("fetchFrenetQuote", () => {
	it("faz POST /shipping/quote com header token e retorna o JSON", async () => {
		const payload = { ShippingSevicesArray: [] };

		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify(payload), { status: 200 })
			);

		await expect(fetchFrenetQuote(BODY)).resolves.toEqual(payload);

		const [url, init] = spy.mock.calls[0] ?? [];
		expect(String(url)).toMatch(QUOTE_URL_RE);
		expect(init?.method).toBe("POST");
		const headers = init?.headers as Record<string, string>;
		expect(headers.token).toBeTruthy();
		expect(headers["Content-Type"]).toBe("application/json");
		expect(JSON.parse(String(init?.body))).toEqual(BODY);
	});

	it("HTTP não-2xx → FrenetError", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("{}", { status: 500 })
		);
		await expect(fetchFrenetQuote(BODY)).rejects.toBeInstanceOf(FrenetError);
	});

	it("abort/timeout → FrenetError (não vaza DOMException)", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(
			new DOMException("The operation was aborted", "AbortError")
		);
		await expect(fetchFrenetQuote(BODY)).rejects.toBeInstanceOf(FrenetError);
	});

	it("body não-JSON → FrenetError", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("<html>gateway error</html>", { status: 200 })
		);
		await expect(fetchFrenetQuote(BODY)).rejects.toBeInstanceOf(FrenetError);
	});

	it("lista de serviços que não é array → FrenetError com o caminho", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ ShippingSevicesArray: "erro" }), {
				status: 200,
			})
		);
		const result = fetchFrenetQuote(BODY);
		await expect(result).rejects.toBeInstanceOf(FrenetError);
		await expect(result).rejects.toThrow(FORA_DO_FORMATO_RE);
		await expect(result).rejects.toThrow(SERVICES_KEY_RE);
	});

	it("Error 'true' em string chega intacto e lista null vira ausente", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					ShippingSevicesArray: [
						{ Error: "true", Msg: "CEP sem cobertura", ServiceCode: "1" },
					],
				}),
				{ status: 200 }
			)
		);
		const withError = await fetchFrenetQuote(BODY);
		expect(withError.ShippingSevicesArray?.[0]?.Error).toBe("true");
		expect(mapFrenetResponse(withError)).toEqual({
			negotiate: true,
			options: [],
		});

		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ ShippingSevicesArray: null }), {
				status: 200,
			})
		);
		const nullList = await fetchFrenetQuote(BODY);
		expect(nullList.ShippingSevicesArray).toBeUndefined();
	});

	it("serviço malformado cai sozinho; número em campo string é aceito", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					ShippingSevicesArray: [
						// Preço em objeto: só este serviço some no map.ts.
						{ CarrierCode: "JAD", ServiceCode: "3", ShippingPrice: {} },
						// Item que nem é objeto também só derruba a si mesmo.
						null,
						{
							Carrier: "Correios",
							CarrierCode: "COR",
							DeliveryTime: 5,
							ServiceCode: 4014,
							ShippingPrice: 34.52,
						},
					],
					Timeout: "5",
				}),
				{ status: 200 }
			)
		);
		const response = await fetchFrenetQuote(BODY);
		expect(mapFrenetResponse(response)).toEqual({
			negotiate: false,
			options: [
				{
					carrierId: "COR-4014",
					deliveryDays: 5,
					name: "Correios",
					priceCents: 3452,
				},
			],
		});
	});

	it("campo null vira ausente e o resto do serviço passa", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					ShippingSevicesArray: [
						{
							Carrier: "Correios",
							Error: false,
							Msg: null,
							ShippingPrice: "34.52",
						},
					],
				}),
				{ status: 200 }
			)
		);
		const response = await fetchFrenetQuote(BODY);
		const service = response.ShippingSevicesArray?.[0];
		expect(service?.Msg).toBeUndefined();
		expect(service?.ShippingPrice).toBe("34.52");
		expect(service?.Error).toBe(false);
	});
});

describe("fetchFrenetAddress", () => {
	it("JSON fora do formato (UF numérica) → FrenetError", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ CEP: "01310100", UF: 35 }), {
				status: 200,
			})
		);
		await expect(fetchFrenetAddress("01310100")).rejects.toBeInstanceOf(
			FrenetError
		);
	});
});
