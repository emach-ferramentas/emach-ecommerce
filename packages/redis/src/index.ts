import { env } from "@emach/env/server";
import { Redis } from "@upstash/redis";

let cached: Redis | null | undefined;

/**
 * Janela (segundos) compartilhada por todos os rate limits do monorepo — auth
 * (Better Auth customStorage, #91) e checkout (@upstash/ratelimit, #94). Fonte
 * ÚNICA para as duas pontas não divergirem ao ajustar a janela.
 */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * Cliente Upstash Redis compartilhado (REST/HTTP — serverless-native).
 *
 * Fonte única do client para todo o monorepo: rate limit do Better Auth
 * (#91, via `@emach/auth`) e rate limit do checkout (#94, via `apps/web`).
 * Lê as credenciais de `@emach/env/server` — não há ciclo, pois quem o
 * consome já depende de `@emach/env`.
 *
 * Retorna `null` quando as env vars do Upstash não estão configuradas, para
 * que os callers caiam em fallback (in-memory) sem quebrar dev/local. As envs
 * são `.optional()` no schema justamente por isso.
 */
export function getRedis(): Redis | null {
	if (cached !== undefined) {
		return cached;
	}

	const url = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;

	if (!(url && token)) {
		cached = null;
		return cached;
	}

	// `retry` enxuto de propósito: os dois consumidores (rate limit do auth e do
	// checkout) são fail-open e ficam no hot-path da request. O default do SDK
	// (3 retries com backoff exponencial ≈ 1,5s no pior caso) seguraria o
	// login/checkout antes de cair no fallback. 1 retry cobre blip transitório
	// sem penalizar latência quando o Redis está realmente indisponível.
	//
	// `signal` como FACTORY (não AbortSignal estático — expiraria uma vez e
	// abortaria todas as chamadas seguintes): sem timeout próprio, um hang de
	// rede do Upstash segura a server action inteira até o limite da function.
	// 2s é folgado pro REST do Upstash e curto o bastante pro hot-path fail-open.
	cached = new Redis({
		url,
		token,
		retry: { retries: 1 },
		signal: () => AbortSignal.timeout(2000),
	});
	return cached;
}

export type { Redis } from "@upstash/redis";
