import { clientSchema, serverSchema } from "./schemas";

// O genérico (URL longa) cobre z.url()/min(N); o numérico cobre padrões estritos
// (ex.: FRENET_SELLER_CEP /^\d{8}$/). Cada chave recebe o primeiro que o validador aceitar.
const GENERIC = `https://test.invalid/${"x".repeat(48)}`;
const CANDIDATES = [GENERIC, "12345678"];

/**
 * Par [chave, dummy] para cada env OBRIGATÓRIA ausente em `env`, derivado do Zod via
 * `safeParse(undefined)`: env obrigatória nova entra sem editar este arquivo.
 * Usado pelo setup do vitest e pelo build do CI, que rodam sem `.env`.
 */
export function missingRequiredDummies(
	env: Record<string, string | undefined>
) {
	const dummies: [key: string, value: string][] = [];

	for (const schema of [serverSchema, clientSchema]) {
		for (const [key, validator] of Object.entries(schema)) {
			const required = !validator.safeParse(undefined).success;

			// Vazio conta como ausente, como no `emptyStringAsUndefined` do createEnv.
			if (required && !env[key]) {
				dummies.push([
					key,
					CANDIDATES.find((c) => validator.safeParse(c).success) ?? GENERIC,
				]);
			}
		}
	}

	return dummies;
}
