import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shipping/quote", () => ({ quoteShipping: vi.fn() }));

import { quoteShipping } from "@/lib/shipping/quote";
import { assertShippingQuoted } from "./place-order";

const INVALID_SHIPPING_RE = /frete inválido/i;

const OPTIONS = [
	{
		carrierId: "COR-40010",
		name: "Correios — Sedex",
		priceCents: 3596,
		deliveryDays: 1,
	},
	{
		carrierId: "COR-41106",
		name: "Correios — PAC",
		priceCents: 1890,
		deliveryDays: 6,
	},
];

describe("assertShippingQuoted", () => {
	it("aceita shipping que bate com uma opção cotada e devolve o método", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: false,
			options: OPTIONS,
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 3596,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).resolves.toEqual({
			shippingUnverified: false,
			shippingMethod: "Correios — Sedex",
			// #186: código do serviço casado, persistido p/ tracking Frenet.
			shippingServiceCode: "COR-40010",
		});
	});

	it("valida o PAR serviço+preço quando shippingServiceCode vem", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: false,
			options: OPTIONS,
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 1890,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
				shippingServiceCode: "COR-41106",
			})
		).resolves.toEqual({
			shippingUnverified: false,
			shippingMethod: "Correios — PAC",
			shippingServiceCode: "COR-41106",
		});
	});

	it("rejeita preço válido de OUTRO serviço que não o selecionado", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: false,
			options: OPTIONS,
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 1890, // preço do PAC…
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
				shippingServiceCode: "COR-40010", // …mas serviço Sedex
			})
		).rejects.toThrow(INVALID_SHIPPING_RE);
	});

	it("fail-open: API indisponível não bloqueia, marca shippingUnverified (#97)", async () => {
		vi.mocked(quoteShipping).mockRejectedValue(new Error("Frenet 503"));
		await expect(
			assertShippingQuoted({
				shippingCents: 9999,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).resolves.toEqual({
			shippingUnverified: true,
			shippingMethod: null,
			shippingServiceCode: null,
		});
	});

	it("rejeita shipping que não bate com nenhuma opção", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: false,
			options: OPTIONS,
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 0,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).rejects.toThrow();
	});

	it("rejeita quando o frete é a combinar (sem serviço válido)", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: true,
			options: [],
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 1000,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).rejects.toThrow();
	});
});
