import { beforeEach, describe, expect, it, vi } from "vitest";

// Sem Redis → o limiter cai no fallback in-memory.
vi.mock("@emach/redis", () => ({
	getRedis: () => null,
	RATE_LIMIT_WINDOW_SECONDS: 60,
}));

describe("rate-limit (fallback in-memory)", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("permite até o limite e bloqueia o excedente por chave", async () => {
		const { couponLimiter } = await import("./rate-limit");
		const key = "coupon:cliente-1";
		const results: boolean[] = [];

		for (let i = 0; i < 11; i++) {
			const { success } = await couponLimiter.limit(key);
			results.push(success);
		}

		// 10 permitidos (limite do cupom), o 11º bloqueado
		expect(results.slice(0, 10).every(Boolean)).toBe(true);
		expect(results[10]).toBe(false);
	});

	it("isola contadores por chave", async () => {
		const { orderLimiter } = await import("./rate-limit");

		for (let i = 0; i < 5; i++) {
			await orderLimiter.limit("order:cliente-A");
		}

		const { success } = await orderLimiter.limit("order:cliente-B");
		expect(success).toBe(true);
	});
});
