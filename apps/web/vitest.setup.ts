import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { missingRequiredDummies } from "@emach/env/dummies";
import dotenv from "dotenv";

/**
 * Setup de teste: garante que `@emach/env` (validado no nível do módulo) não
 * aborte a suíte quando faltam env vars, injetando um dummy nas obrigatórias
 * ausentes. O `.env` real só entra na suíte completa, que roda a integração. O
 * `test:ci` (`VITEST_UNIT_ONLY=1`) roda só com dummies, local ou no CI: teste
 * unit que tocar o banco falha em vez de escrever no Supabase compartilhado.
 */

const envPath = resolve(import.meta.dirname, ".env");

if (process.env.VITEST_UNIT_ONLY !== "1" && existsSync(envPath)) {
	dotenv.config({ path: envPath, quiet: true });
}

Object.assign(
	process.env,
	Object.fromEntries(missingRequiredDummies(process.env))
);
