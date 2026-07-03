import { afterEach, describe, expect, it, vi } from "vitest";

import { FrenetError, fetchFrenetQuote } from "./client";
import type { FrenetQuoteRequest } from "./types";

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
		expect(String(url)).toMatch(/\/shipping\/quote$/);
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
});
