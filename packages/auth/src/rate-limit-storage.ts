import { getRedis, RATE_LIMIT_WINDOW_SECONDS } from "@emach/redis";
import { log } from "evlog";

/**
 * Storage do rate limit do Better Auth (#91), híbrido:
 *
 * - **Produção (Vercel serverless):** Upstash Redis via `@emach/redis`. O
 *   `memory` default do Better Auth não serve em serverless — cada lambda tem
 *   RAM isolada e o cold start zera o contador, então um atacante batendo em
 *   instâncias diferentes nunca seria barrado. O Redis compartilha o contador
 *   entre todas as instâncias.
 * - **Dev/local (sem Upstash):** fallback in-memory. Em `next dev` (processo
 *   único) o contador funciona e permite testar o 429; só não escala para
 *   serverless multi-instância — daí o `log.warn` em produção sem Redis.
 *
 * Chaves prefixadas com `auth:` para não colidir com o rate limit do checkout
 * (#94, que usa o mesmo client Upstash com prefixo `checkout:`).
 */

const RATE_LIMIT_PREFIX = "auth:";

// TTL das chaves no Redis: RATE_LIMIT_WINDOW_SECONDS (fonte canônica em
// `@emach/redis`, compartilhada com o rate limit do checkout #94). O Better
// Auth não passa o `window` ao `customStorage`, mas todos os nossos
// `customRules` usam o mesmo `window`, então um TTL fixo cobre todas as
// regras. A chave é renovada a cada request e expira após esse tempo de
// inatividade — exatamente quando o Better Auth também reseta o contador.
// Consumidores (ecommerce.ts) importam a constante direto de `@emach/redis`.

/** Formato interno do contador do Better Auth (`api/rate-limiter`). */
export interface RateLimitData {
	count: number;
	key: string;
	lastRequest: number;
}

export interface RateLimitStorage {
	get: (key: string) => Promise<RateLimitData | undefined>;
	// O Better Auth passa um 3º arg `update` (insert vs. update). Ignoramos —
	// sempre gravamos o `value` completo (que já vem com o `count` resolvido),
	// então o overwrite é correto. Declarado por fidelidade ao contrato.
	set: (key: string, value: RateLimitData, update?: boolean) => Promise<void>;
}

function createInMemoryStorage(): RateLimitStorage {
	const store = new Map<string, { data: RateLimitData; expiresAt: number }>();

	return {
		get(key) {
			const entry = store.get(key);
			if (!entry) {
				return Promise.resolve(undefined);
			}
			if (Date.now() >= entry.expiresAt) {
				store.delete(key);
				return Promise.resolve(undefined);
			}
			return Promise.resolve(entry.data);
		},
		set(key, value) {
			store.set(key, {
				data: value,
				expiresAt: Date.now() + RATE_LIMIT_WINDOW_SECONDS * 1000,
			});
			return Promise.resolve();
		},
	};
}

function createRedisStorage(
	redis: NonNullable<ReturnType<typeof getRedis>>
): RateLimitStorage {
	return {
		async get(key) {
			try {
				const data = await redis.get<RateLimitData>(RATE_LIMIT_PREFIX + key);
				return data ?? undefined;
			} catch (error) {
				// Fail-open: um blip do Redis não pode derrubar o login. Pior caso,
				// uma janela sem rate limit; melhor que indisponibilidade total.
				log.warn({ action: "rate-limit", msg: "redis get failed", error });
				return;
			}
		},
		async set(key, value) {
			try {
				await redis.set(RATE_LIMIT_PREFIX + key, value, {
					ex: RATE_LIMIT_WINDOW_SECONDS,
				});
			} catch (error) {
				log.warn({ action: "rate-limit", msg: "redis set failed", error });
			}
		},
	};
}

let prodFallbackWarned = false;

/**
 * Monta o storage do rate limit conforme o ambiente. Chamado uma vez na
 * construção do Better Auth.
 */
export function createRateLimitStorage(): RateLimitStorage {
	const redis = getRedis();

	if (redis) {
		return createRedisStorage(redis);
	}

	if (process.env.NODE_ENV === "production" && !prodFallbackWarned) {
		prodFallbackWarned = true;
		log.warn({
			action: "rate-limit",
			msg: "sem Upstash em produção — fallback in-memory é ineficaz em serverless multi-instância. Configure UPSTASH_REDIS_REST_URL/_TOKEN.",
		});
	}

	return createInMemoryStorage();
}
