import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { clientSchema, serverSchema } from "@emach/env/schemas";
import dotenv from "dotenv";

/**
 * Setup de teste — garante que `@emach/env` (validado no nível do módulo) não
 * aborte a suíte unit quando faltam env vars. Em dev local carrega o `.env`
 * real; no CI (sem `.env`) injeta um dummy nas OBRIGATÓRIAS ausentes.
 *
 * O conjunto de obrigatórias é derivado do próprio Zod via `safeParse(undefined)`
 * — à prova de futuro: env obrigatória nova é coberta sem editar este arquivo.
 * Os testes de integração (que precisam de DB real) ficam fora do CI via
 * `VITEST_UNIT_ONLY=1` (ver `vitest.config.ts`).
 */

const envPath = resolve(import.meta.dirname, ".env");
if (existsSync(envPath)) {
	dotenv.config({ path: envPath, quiet: true });
}

// Valores que satisfazem os validadores das obrigatórias: o genérico (URL longa)
// cobre z.url()/min(N); o numérico cobre padrões estritos (ex.: FRENET_SELLER_CEP
// /^\d{8}$/). Para cada chave, usa o primeiro candidato que o validador aceitar.
const DUMMIES = [`https://test.invalid/${"x".repeat(48)}`, "12345678"];

for (const schema of [serverSchema, clientSchema]) {
	for (const [key, validator] of Object.entries(schema)) {
		const required = !validator.safeParse(undefined).success;
		if (required && process.env[key] == null) {
			process.env[key] =
				DUMMIES.find((d) => validator.safeParse(d).success) ?? DUMMIES[0];
		}
	}
}
