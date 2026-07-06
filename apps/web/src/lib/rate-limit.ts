import { getRedis, RATE_LIMIT_WINDOW_SECONDS } from "@emach/redis";
import { Ratelimit } from "@upstash/ratelimit";

import { warnRedisMissingOnce } from "@/lib/redis-monitor";

export interface Limiter {
	limit(key: string): Promise<{ success: boolean }>;
}

/** Janela compartilhada (auth + checkout) — fonte única em `@emach/redis`. */
const WINDOW_MS = RATE_LIMIT_WINDOW_SECONDS * 1000;

/**
 * Fallback in-memory: BEST-EFFORT. Em serverless cada instância (lambda) tem o
 * próprio Map — o contador reseta em cold start e NÃO é compartilhado entre
 * instâncias. Serve para dev local e como degradação graciosa enquanto o
 * Upstash não está provisionado; o modo durável liga sozinho quando
 * `getRedis()` passa a devolver um client (env vars UPSTASH_* presentes).
 */
function memoryLimiter(max: number): Limiter {
	const hits = new Map<string, number[]>();
	let lastSweep = 0;
	return {
		limit(key) {
			const now = Date.now();
			// Limpeza amortizada: no máximo UMA varredura por janela, independente do
			// volume — remove chaves de clientes que não voltaram (evita leak em
			// instância long-lived sem Upstash) sem custo O(n) por request mesmo em
			// burst de chaves únicas.
			if (now - lastSweep >= WINDOW_MS) {
				lastSweep = now;
				for (const [k, ts] of hits) {
					if (now - (ts.at(-1) ?? 0) >= WINDOW_MS) {
						hits.delete(k);
					}
				}
			}
			const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
			recent.push(now);
			hits.set(key, recent);
			return Promise.resolve({ success: recent.length <= max });
		},
	};
}

function createLimiter(max: number): Limiter {
	const redis = getRedis();
	if (redis) {
		return new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(max, `${RATE_LIMIT_WINDOW_SECONDS} s`),
			prefix: "checkout",
		});
	}
	warnRedisMissingOnce();
	return memoryLimiter(max);
}

export const couponLimiter = createLimiter(10);
export const orderLimiter = createLimiter(5);
export const shippingLimiter = createLimiter(20);
export const searchLimiter = createLimiter(30);
/** cart_event é INSERT público sem auth — limitar por IP protege o banco compartilhado. */
export const cartEventLimiter = createLimiter(30);
/** Lookup de CEP repassa pra API Frenet — limitar por IP protege a cota do token. */
export const cepLimiter = createLimiter(30);

export const RATE_LIMIT_MESSAGE = "Muitas tentativas, aguarde um instante";
