import { log } from "@/lib/evlog";

let warned = false;

// UPSTASH_* são `.optional()` no Zod — invisíveis pro `check:env` — e
// `getRedis()` degrada pra in-memory por instância sem lançar. Em produção
// isso enfraquece o cache Frenet (re-quote do anti-fraude vira chamada nova)
// e os rate-limiters (contador por lambda) sem nenhum sintoma; este warn,
// único por processo, é o sinal. Em dev a ausência é esperada — sem ruído.
export function warnRedisMissingOnce(): void {
	if (warned || process.env.NODE_ENV !== "production") {
		return;
	}
	warned = true;
	log.warn({ action: "redis_not_configured" });
}
