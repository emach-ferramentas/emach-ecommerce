/**
 * Imprime `CHAVE=valor` para cada env obrigatória ausente, para o build do CI
 * rodar sem segredo: `bun scripts/dummy-env.ts >> "$GITHUB_ENV"`.
 */
import { missingRequiredDummies } from "../packages/env/src/dummies";

for (const [key, value] of missingRequiredDummies(process.env)) {
	console.log(`${key}=${value}`);
}
