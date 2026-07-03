import { createHash } from "node:crypto";

import { getRedis } from "@emach/redis";

import { log } from "@/lib/evlog";
import type { ShippingOption } from "@/lib/shipping/types";

export interface CachedQuote {
	negotiate: boolean;
	options: ShippingOption[];
}

// TTL curto: cobre a janela "cliente vê opções → submete → re-quote do
// assertShippingQuoted", que assim reutiliza EXATAMENTE a cotação exibida
// (anti-fraude determinístico + 1 chamada Frenet por checkout).
export const TTL_SECONDS = 30 * 60;
const MEMORY_MAX_KEYS = 500;

const memory = new Map<string, { expiresAt: number; value: CachedQuote }>();

export function buildQuoteCacheKey(parts: {
	declaredValueCents: number;
	destinationCep: string;
	packages: Array<{
		heightCm: number;
		lengthCm: number;
		weightKg: number;
		widthCm: number;
	}>;
	sellerCep: string;
}): string {
	const packSig = parts.packages
		.map((p) => `${p.lengthCm}x${p.widthCm}x${p.heightCm}:${p.weightKg}`)
		.sort()
		.join("|");
	const raw = `${parts.sellerCep}|${parts.destinationCep}|${parts.declaredValueCents}|${packSig}`;
	return `frenet:quote:${createHash("sha256").update(raw).digest("hex")}`;
}

// Falha de cache NUNCA derruba a cotação — loga e degrada pra chamada direta.
export async function getCachedQuote(key: string): Promise<CachedQuote | null> {
	const redis = getRedis();
	if (redis) {
		try {
			return await redis.get<CachedQuote>(key);
		} catch (err) {
			log.error({
				action: "frenet_cache_read_failed",
				error: err instanceof Error ? err.message : "erro inesperado",
			});
			return null;
		}
	}
	const hit = memory.get(key);
	if (hit && hit.expiresAt > Date.now()) {
		return hit.value;
	}
	memory.delete(key);
	return null;
}

export async function setCachedQuote(
	key: string,
	value: CachedQuote
): Promise<void> {
	const redis = getRedis();
	if (redis) {
		try {
			await redis.set(key, value, { ex: TTL_SECONDS });
		} catch (err) {
			log.error({
				action: "frenet_cache_write_failed",
				error: err instanceof Error ? err.message : "erro inesperado",
			});
		}
		return;
	}
	// Fallback in-memory (dev/local — mesmo espírito do rate-limit): poda
	// preguiçosa das expiradas só quando o Map cresce, sem varredura por request.
	if (memory.size >= MEMORY_MAX_KEYS) {
		const now = Date.now();
		for (const [k, v] of memory) {
			if (v.expiresAt <= now) {
				memory.delete(k);
			}
		}
	}
	memory.set(key, { expiresAt: Date.now() + TTL_SECONDS * 1000, value });
}
