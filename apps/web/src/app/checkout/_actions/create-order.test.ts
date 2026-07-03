import { beforeEach, describe, expect, it, vi } from "vitest";

// Gate do #93 (verificação de e-mail): a action deve rejeitar pedido de cliente
// não-verificado ANTES de consumir rate limit ou abrir transação. Mockamos as
// dependências pesadas (db/rate-limit/headers) e espionamos placeOrder para
// provar que nada é tocado quando o e-mail não está verificado.

const { requireCurrentClient } = vi.hoisted(() => ({
	requireCurrentClient: vi.fn(),
}));

const { orderLimit } = vi.hoisted(() => ({
	orderLimit: vi.fn().mockResolvedValue({ success: true }),
}));

const { placeOrder, assertShippingQuoted, resolveDestinationCep } = vi.hoisted(
	() => ({
		placeOrder: vi.fn(),
		assertShippingQuoted: vi.fn(),
		resolveDestinationCep: vi.fn().mockResolvedValue(null),
	})
);

vi.mock("@/lib/session", () => ({ requireCurrentClient }));

vi.mock("@/lib/rate-limit", () => ({
	orderLimiter: { limit: orderLimit },
	RATE_LIMIT_MESSAGE: "rate-limited",
}));

vi.mock("@emach/db", () => ({
	db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(() => null) }));

vi.mock("@/lib/evlog", () => ({ log: { error: vi.fn(), warn: vi.fn() } }));

// Mantém inputSchema/OrderError reais; só troca os efeitos colaterais pesados.
vi.mock("../_lib/place-order", async (importActual) => {
	const actual = await importActual<typeof import("../_lib/place-order")>();
	return { ...actual, placeOrder, assertShippingQuoted, resolveDestinationCep };
});

import { createOrderAction } from "./create-order";

const RE_EMAIL_NOT_VERIFIED = /confirme seu e-mail/i;

// CPF válido (dígitos verificadores corretos) para passar o inputSchema real.
const VALID_INPUT = {
	name: "Maria Silva",
	email: "maria@example.com",
	phone: "11999998888",
	document: "52998224725",
	addressId: "addr-1",
	newAddress: null,
	acceptMarketing: false,
	cartItems: [
		{
			toolId: "tool-1",
			variantId: "variant-1",
			quantity: 1,
			priceAmount: "100.00",
		},
	],
	shippingAmount: "20.00",
};

function sessionWith(emailVerified: boolean) {
	return {
		user: { id: "c1", email: "maria@example.com", emailVerified },
		session: { id: "s1" },
	};
}

describe("createOrderAction — gate de verificação de e-mail (#93)", () => {
	beforeEach(() => {
		requireCurrentClient.mockReset();
		orderLimit.mockClear();
		placeOrder.mockReset();
		placeOrder.mockResolvedValue({ orderId: "o1", orderNumber: "2026-000001" });
		// Defesa: se um teste futuro fizer resolveDestinationCep retornar um CEP,
		// assertShippingQuoted precisa resolver para o shape esperado — senão a
		// desestruturação `shippingCheck.shippingUnverified` lança TypeError.
		assertShippingQuoted.mockResolvedValue({
			shippingUnverified: false,
			shippingMethod: null,
		});
	});

	it("rejeita pedido de cliente não-verificado sem consumir rate limit nem tocar placeOrder", async () => {
		requireCurrentClient.mockResolvedValue(sessionWith(false));

		const result = await createOrderAction(VALID_INPUT);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(RE_EMAIL_NOT_VERIFIED);
		}
		expect(orderLimit).not.toHaveBeenCalled();
		expect(placeOrder).not.toHaveBeenCalled();
	});

	it("deixa o pedido seguir quando o cliente está verificado", async () => {
		requireCurrentClient.mockResolvedValue(sessionWith(true));

		const result = await createOrderAction(VALID_INPUT);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.orderNumber).toBe("2026-000001");
		}
		expect(orderLimit).toHaveBeenCalledTimes(1);
		expect(placeOrder).toHaveBeenCalledTimes(1);
	});
});
