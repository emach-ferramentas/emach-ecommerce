import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit: `tx` mockado — prova as barreiras de prepareLines sem tocar no banco.
const { selectWhere } = vi.hoisted(() => ({ selectWhere: vi.fn() }));

vi.mock("@/lib/auto-promo", () => ({
	autoPromoToolIdsFromMap: vi.fn(() => new Set<string>()),
	fetchAutoPromosByToolId: vi.fn(async () => new Map()),
}));

import type { db } from "@emach/db";
import { type CreateOrderInput, OrderError, prepareLines } from "./place-order";

const tx = {
	select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectWhere })) })),
} as unknown as typeof db;

const VARIANT = {
	id: "v1",
	toolId: "t1",
	sku: "SKU-1",
	barcode: null,
	voltage: null,
	priceAmount: "199.90" as string | null,
	visibleOnSite: true,
};
const TOOL = {
	id: "t1",
	name: "Furadeira",
	model: null,
	ncm: null,
	cest: null,
	manufacturerName: null,
	weightKg: "1.000",
	lengthCm: "10.00",
	widthCm: "10.00",
	heightCm: "10.00",
};

function input(priceAmount = "199.90"): CreateOrderInput {
	return {
		name: "Cliente Teste",
		email: "cliente@example.com",
		phone: "11999999999",
		document: "52998224725",
		addressId: "addr",
		newAddress: null,
		acceptMarketing: false,
		cartItems: [{ toolId: "t1", variantId: "v1", quantity: 1, priceAmount }],
		shippingAmount: "0.00",
	};
}

beforeEach(() => {
	selectWhere.mockReset();
});

describe("prepareLines", () => {
	it("variante com preço vira linha com o preço do banco", async () => {
		selectWhere.mockResolvedValueOnce([VARIANT]).mockResolvedValueOnce([TOOL]);
		const { lines } = await prepareLines(tx, input());
		expect(lines).toHaveLength(1);
		expect(lines[0]?.finalPriceCents).toBe(19_990);
		expect(lines[0]?.variant.barcode).toBeNull();
	});

	it("variante sem preço (rascunho) derruba o pedido", async () => {
		selectWhere
			.mockResolvedValueOnce([{ ...VARIANT, priceAmount: null }])
			.mockResolvedValueOnce([TOOL]);
		await expect(prepareLines(tx, input("0.00"))).rejects.toThrow(
			new OrderError("Variante indisponível para venda: Furadeira")
		);
	});

	it("variante hidden derruba o pedido com a mesma mensagem", async () => {
		selectWhere
			.mockResolvedValueOnce([{ ...VARIANT, visibleOnSite: false }])
			.mockResolvedValueOnce([TOOL]);
		await expect(prepareLines(tx, input())).rejects.toThrow(
			new OrderError("Variante indisponível para venda: Furadeira")
		);
	});
});
