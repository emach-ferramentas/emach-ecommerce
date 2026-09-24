import { order, orderStatusHistory } from "@emach/db/schema/orders";
import { promotion } from "@emach/db/schema/promotions";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit: a transação é um `tx` falso que registra cada escrita por tabela.
// Prova a guarda de status do UPDATE e a devolução do cupom sem tocar no banco.

const { requireCurrentClient } = vi.hoisted(() => ({
	requireCurrentClient: vi.fn(),
}));

const state = vi.hoisted(() => ({
	selectRows: [] as unknown[],
	orderUpdateRows: [] as unknown[],
	updatedTables: [] as unknown[],
	inserts: [] as Array<{ table: unknown; values: unknown }>,
}));

vi.mock("@emach/db", () => {
	const tx = {
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => state.selectRows }) }),
		}),
		update: (table: unknown) => {
			state.updatedTables.push(table);
			return {
				set: () => ({
					where: () => ({
						returning: async () => state.orderUpdateRows,
						// biome-ignore lint/suspicious/noThenProperty: o UPDATE de promotion é aguardado sem .returning()
						then: (resolve: (v: unknown) => void) => resolve(undefined),
					}),
				}),
			};
		},
		insert: (table: unknown) => ({
			values: (values: unknown) => {
				state.inserts.push({ table, values });
				return Promise.resolve();
			},
		}),
	};
	return {
		db: { transaction: async (cb: (t: typeof tx) => unknown) => cb(tx) },
	};
});

vi.mock("@/lib/session", () => ({ requireCurrentClient }));
vi.mock("@/lib/evlog", () => ({ log: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/orders/rebuy-query", () => ({ getRebuyItems: vi.fn() }));

import { cancelOrderAction } from "./orders";

function promotionUpdates(): number {
	return state.updatedTables.filter((t) => t === promotion).length;
}

beforeEach(() => {
	requireCurrentClient.mockResolvedValue({ user: { id: "c1" } });
	state.selectRows = [];
	state.orderUpdateRows = [{ id: "o1" }];
	state.updatedTables = [];
	state.inserts = [];
});

describe("cancelOrderAction", () => {
	it("pedido com cupom devolve o uso da promoção uma vez", async () => {
		state.selectRows = [
			{ id: "o1", status: "pending_payment", couponId: "promo-1" },
		];

		const result = await cancelOrderAction({ orderId: "o1" });

		expect(result).toEqual({ ok: true, data: undefined });
		expect(promotionUpdates()).toBe(1);
		expect(state.inserts).toEqual([
			{
				table: orderStatusHistory,
				values: expect.objectContaining({
					fromStatus: "pending_payment",
					toStatus: "canceled",
				}),
			},
		]);
	});

	it("status mudou entre o SELECT e o UPDATE: recusa sem tocar promoção nem histórico", async () => {
		state.selectRows = [
			{ id: "o1", status: "pending_payment", couponId: "promo-1" },
		];
		state.orderUpdateRows = [];

		const result = await cancelOrderAction({ orderId: "o1" });

		expect(result).toEqual({
			ok: false,
			error: "O status do pedido mudou. Atualize a página.",
		});
		expect(state.updatedTables).toEqual([order]);
		expect(state.inserts).toEqual([]);
	});

	it("pedido sem cupom não toca a promoção", async () => {
		state.selectRows = [{ id: "o1", status: "payment_failed", couponId: null }];

		const result = await cancelOrderAction({ orderId: "o1" });

		expect(result).toEqual({ ok: true, data: undefined });
		expect(promotionUpdates()).toBe(0);
	});
});
