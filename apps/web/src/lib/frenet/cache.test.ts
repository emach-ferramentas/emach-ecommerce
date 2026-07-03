import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getRedis → null força o caminho in-memory, determinístico mesmo se o .env
// local tiver Upstash configurado (nunca tocar Redis real em teste).
vi.mock("@emach/redis", () => ({ getRedis: vi.fn(() => null) }));
vi.mock("@/lib/evlog", () => ({ log: { error: vi.fn(), warn: vi.fn() } }));

import type { Redis } from "@emach/redis";
import { getRedis } from "@emach/redis";
import { log } from "@/lib/evlog";
import {
	buildQuoteCacheKey,
	getCachedQuote,
	setCachedQuote,
	TTL_SECONDS,
} from "./cache";

const QUOTE = {
	negotiate: false,
	options: [
		{
			carrierId: "COR-40010",
			name: "Correios — Sedex",
			priceCents: 3171,
			deliveryDays: 2,
		},
	],
};

beforeEach(() => {
	vi.mocked(getRedis).mockReturnValue(null);
	vi.mocked(log.error).mockClear();
});

describe("buildQuoteCacheKey", () => {
	const base = {
		sellerCep: "01310100",
		destinationCep: "14270000",
		declaredValueCents: 32_068,
	};
	const pkgA = { lengthCm: 40, widthCm: 30, heightCm: 20, weightKg: 3.5 };
	const pkgB = { lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 8 };

	it("é estável e insensível à ordem dos pacotes", () => {
		expect(buildQuoteCacheKey({ ...base, packages: [pkgA, pkgB] })).toBe(
			buildQuoteCacheKey({ ...base, packages: [pkgB, pkgA] })
		);
	});

	it("muda quando destino, valor declarado ou pacote muda", () => {
		const key = buildQuoteCacheKey({ ...base, packages: [pkgA] });
		expect(key).not.toBe(
			buildQuoteCacheKey({
				...base,
				destinationCep: "01001000",
				packages: [pkgA],
			})
		);
		expect(key).not.toBe(
			buildQuoteCacheKey({ ...base, declaredValueCents: 1, packages: [pkgA] })
		);
		expect(key).not.toBe(buildQuoteCacheKey({ ...base, packages: [pkgB] }));
	});
});

describe("cache in-memory (sem Upstash)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("roundtrip set→get, e expira após o TTL de 30min", async () => {
		const key = "frenet:quote:test-roundtrip";
		await setCachedQuote(key, QUOTE);
		await expect(getCachedQuote(key)).resolves.toEqual(QUOTE);

		vi.advanceTimersByTime(31 * 60 * 1000);
		await expect(getCachedQuote(key)).resolves.toBeNull();
	});

	it("miss retorna null", async () => {
		await expect(
			getCachedQuote("frenet:quote:inexistente")
		).resolves.toBeNull();
	});
});

describe("cache com Redis (Upstash mockado)", () => {
	function fakeRedis(overrides: {
		get?: ReturnType<typeof vi.fn>;
		set?: ReturnType<typeof vi.fn>;
	}) {
		const fake = {
			get: overrides.get ?? vi.fn().mockResolvedValue(null),
			set: overrides.set ?? vi.fn().mockResolvedValue("OK"),
		};
		vi.mocked(getRedis).mockReturnValue(fake as unknown as Redis);
		return fake;
	}

	it("get delega ao Redis e retorna o valor", async () => {
		const fake = fakeRedis({ get: vi.fn().mockResolvedValue(QUOTE) });
		await expect(getCachedQuote("frenet:quote:k1")).resolves.toEqual(QUOTE);
		expect(fake.get).toHaveBeenCalledWith("frenet:quote:k1");
	});

	it("set delega ao Redis com TTL de 30min", async () => {
		const fake = fakeRedis({});
		await setCachedQuote("frenet:quote:k2", QUOTE);
		expect(fake.set).toHaveBeenCalledWith("frenet:quote:k2", QUOTE, {
			ex: TTL_SECONDS,
		});
	});

	it("falha de leitura no Redis → null + log.error (fail-open)", async () => {
		fakeRedis({ get: vi.fn().mockRejectedValue(new Error("redis down")) });
		await expect(getCachedQuote("frenet:quote:k3")).resolves.toBeNull();
		expect(log.error).toHaveBeenCalledWith(
			expect.objectContaining({ action: "frenet_cache_read_failed" })
		);
	});

	it("falha de escrita no Redis → não lança + log.error (fail-open)", async () => {
		fakeRedis({ set: vi.fn().mockRejectedValue(new Error("redis down")) });
		await expect(
			setCachedQuote("frenet:quote:k4", QUOTE)
		).resolves.toBeUndefined();
		expect(log.error).toHaveBeenCalledWith(
			expect.objectContaining({ action: "frenet_cache_write_failed" })
		);
	});
});
