import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSuperFreteQuote, SuperFreteError } from "./client";

vi.mock("@emach/env/server", () => ({
	env: {
		SUPERFRETE_BASE_URL: "https://sandbox.superfrete.com",
		SUPERFRETE_TOKEN: "tok123",
		SUPERFRETE_USER_AGENT: "Emach Loja v1.0 (test@emach.com)",
	},
}));

afterEach(() => vi.restoreAllMocks());

describe("fetchSuperFreteQuote", () => {
	it("envia headers de auth e retorna o array de serviços", async () => {
		const services = [{ id: 2, name: "SEDEX", price: 35.96, delivery_time: 1 }];
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify(services), { status: 200 })
			);

		const result = await fetchSuperFreteQuote({
			from: { postal_code: "80010000" },
			to: { postal_code: "01310100" },
			services: "1,2,17,3",
			options: { insurance_value: 0, use_insurance_value: false },
			products: [{ height: 10, width: 15, length: 20, weight: 1, quantity: 1 }],
		});

		expect(result).toEqual(services);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://sandbox.superfrete.com/api/v0/calculator");
		expect((init?.headers as Record<string, string>).Authorization).toBe(
			"Bearer tok123"
		);
	});

	it("lança SuperFreteError em status não-ok", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("nope", { status: 401 })
		);
		await expect(
			fetchSuperFreteQuote({
				from: { postal_code: "80010000" },
				to: { postal_code: "01310100" },
				services: "2",
				options: { insurance_value: 0, use_insurance_value: false },
				products: [{ height: 1, width: 1, length: 1, weight: 1, quantity: 1 }],
			})
		).rejects.toBeInstanceOf(SuperFreteError);
	});

	const noOptionBodies = [
		{
			label: "no_result (sem transportadora p/ o pacote)",
			body: {
				errors: {
					"freight.calculator.no_result": [
						"Nenhum frete válido encontrado para esse serviço.",
					],
				},
				message: "Ocorreu um ou mais erros.",
			},
		},
		{
			label: "peso acima do limite dos Correios",
			body: {
				errors: {
					"correios.weight": [
						"(correios.weight) não pode ser maior que 30 kg.",
					],
				},
				message: "Ocorreu um ou mais erros.",
			},
		},
	];

	for (const { label, body } of noOptionBodies) {
		it(`retorna [] em 400 — ${label}`, async () => {
			vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(JSON.stringify(body), { status: 400 })
			);
			const result = await fetchSuperFreteQuote({
				from: { postal_code: "80010000" },
				to: { postal_code: "01310100" },
				services: "3",
				options: { insurance_value: 0, use_insurance_value: false },
				products: [{ height: 1, width: 1, length: 1, weight: 1, quantity: 1 }],
			});
			expect(result).toEqual([]);
		});
	}
});
