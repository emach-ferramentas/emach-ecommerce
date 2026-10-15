import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Testes que batem no Supabase compartilhado: o `vitest.workspace.ts` roda o
// glob em série e o test:ci o deixa de fora. A guarda em vitest.workspace.test.ts
// falha se um teste importa o `db` sem mock e não tem este sufixo.
export const INTEGRATION = ["**/*.integration.test.ts"];

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(import.meta.dirname, "src"),
		},
	},
	css: {
		postcss: {},
	},
	test: {
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
	},
});
