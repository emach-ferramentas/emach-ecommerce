import { db } from "@emach/db";
import { getCategoryTree } from "@emach/db/queries/categories";
import { getTools } from "@emach/db/queries/tools";
import { describe, expect, it } from "vitest";
import {
	CATALOG_PAGE_SIZE,
	type CatalogDataInput,
	fetchCatalogData,
} from "./catalog-data";

const BASE: Omit<CatalogDataInput, "cat"> = {
	onlyPromo: false,
	voltages: [],
	sort: "relevance",
	page: 1,
};

describe("fetchCatalogData (integração read-only: composição do catálogo)", () => {
	it("sem filtros: consistente com getTools e getFacetCounts", async () => {
		const data = await fetchCatalogData({ ...BASE });
		const { total } = await getTools(db, { limit: 1 });

		expect(data.total).toBe(total);
		expect(data.facetCounts.total).toBe(total);
		expect(data.tools.length).toBeLessThanOrEqual(CATALOG_PAGE_SIZE);
		expect(data.currentCategory).toBeNull();
		expect(Array.isArray(data.categoryTree)).toBe(true);

		// voltagesByTool só contém ferramentas da página retornada
		const ids = new Set(data.tools.map((t) => t.id));
		for (const key of data.voltagesByTool.keys()) {
			expect(ids.has(key)).toBe(true);
		}
	});

	it("cat com slug válido filtra e expõe currentCategory", async () => {
		const tree = await getCategoryTree(db);
		const root = tree[0];
		if (!root) {
			return; // banco sem categorias: nada a verificar
		}
		const data = await fetchCatalogData({ ...BASE, cat: root.slug });
		const { total } = await getTools(db, { categoryId: root.id, limit: 1 });

		expect(data.total).toBe(total);
		expect(data.currentCategory?.id).toBe(root.id);
		expect(data.currentCategory?.slug).toBe(root.slug);
	});

	it("cat com slug inexistente é ignorado (sem filtro de categoria)", async () => {
		const data = await fetchCatalogData({
			...BASE,
			cat: "slug-que-nao-existe-xyz",
		});
		const { total } = await getTools(db, { limit: 1 });

		expect(data.total).toBe(total);
		expect(data.currentCategory).toBeNull();
	});
});
