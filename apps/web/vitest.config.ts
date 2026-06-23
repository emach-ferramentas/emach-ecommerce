import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

// Testes de integração que batem no Supabase compartilhado: precisam de
// DATABASE_URL e são flaky sob concorrência (ver CLAUDE.md). Rodam localmente
// via `bun run --filter=web test`; ficam fora do CI (VITEST_UNIT_ONLY=1) até
// haver um Postgres efêmero no pipeline.
const INTEGRATION = [
	"**/lib/auto-promo.integration.test.ts",
	"**/lib/tool-images.integration.test.ts",
	"**/checkout/_lib/place-order.test.ts",
	"**/checkout/_lib/place-order.shipping.test.ts",
	"**/checkout/_actions/create-order.test.ts",
	"**/checkout/_actions/revalidate-cart.test.ts",
	"**/lib/coupons/validate-coupon.test.ts",
	"**/catalog/_lib/category-tree.test.ts",
];

const unitOnly = process.env.VITEST_UNIT_ONLY === "1";

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
		exclude: unitOnly
			? [...configDefaults.exclude, ...INTEGRATION]
			: configDefaults.exclude,
	},
});
