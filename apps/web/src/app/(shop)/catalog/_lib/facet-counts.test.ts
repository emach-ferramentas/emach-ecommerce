import { db } from "@emach/db";
import {
	type CategoryNode,
	getCategoryTree,
} from "@emach/db/queries/categories";
import { getTools } from "@emach/db/queries/tools";
import { describe, expect, it } from "vitest";
import { getFacetCounts } from "./facet-counts";
import { PRICE_RANGES } from "./price-ranges";

const NO_FILTERS = { onlyPromo: false, voltages: [] as never[] };

function collectIds(nodes: CategoryNode[]): string[] {
	return nodes.flatMap((n) => [n.id, ...collectIds(n.children)]);
}

describe("getFacetCounts (integração read-only: consistência com getTools)", () => {
	it("byVoltage bate com getTools filtrado pela mesma voltagem", async () => {
		const counts = await getFacetCounts(NO_FILTERS);
		for (const v of ["127V", "220V", "Bivolt", "380V"] as const) {
			const { total } = await getTools(db, { voltage: [v], limit: 1 });
			expect(counts.byVoltage[v] ?? 0).toBe(total);
		}
	});

	it("byPriceRange bate com getTools pmin/pmax de cada faixa", async () => {
		const counts = await getFacetCounts(NO_FILTERS);
		for (const r of PRICE_RANGES) {
			const { total } = await getTools(db, {
				priceMin: r.pmin ?? undefined,
				priceMax: r.pmax ?? undefined,
				limit: 1,
			});
			expect(counts.byPriceRange[r.key]).toBe(total);
		}
	});

	it("promo bate com getTools onlyPromo", async () => {
		const counts = await getFacetCounts(NO_FILTERS);
		const { total } = await getTools(db, { onlyPromo: true, limit: 1 });
		expect(counts.promo).toBe(total);
	});

	it("byCategory de uma raiz bate com getTools categoryId", async () => {
		const [counts, tree] = await Promise.all([
			getFacetCounts(NO_FILTERS),
			getCategoryTree(db),
		]);
		const root = tree[0];
		if (!root) {
			return; // banco sem categorias: nada a verificar
		}
		const { total } = await getTools(db, { categoryId: root.id, limit: 1 });
		expect(counts.byCategory[root.id]).toBe(total);

		for (const id of collectIds(tree)) {
			expect(counts.byCategory[id]).toBeTypeOf("number");
		}
	});

	it("cross-filtro: byVoltage respeita categoria ativa", async () => {
		const tree = await getCategoryTree(db);
		const root = tree[0];
		if (!root) {
			return;
		}
		const counts = await getFacetCounts({ ...NO_FILTERS, categoryId: root.id });
		const { total } = await getTools(db, {
			categoryId: root.id,
			voltage: ["220V"],
			limit: 1,
		});
		expect(counts.byVoltage["220V"] ?? 0).toBe(total);
	});

	it("total (sem categoria) bate com getTools sem filtros", async () => {
		const counts = await getFacetCounts(NO_FILTERS);
		const { total } = await getTools(db, { limit: 1 });
		expect(counts.total).toBe(total);
	});
});
