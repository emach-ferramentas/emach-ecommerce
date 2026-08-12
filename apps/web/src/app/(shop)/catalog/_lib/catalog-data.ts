import { db } from "@emach/db";
import {
	type CategoryNode,
	getCategoryBySlug,
	getCategoryTree,
} from "@emach/db/queries/categories";
import { getTools } from "@emach/db/queries/tools";
import type { Voltage } from "@emach/db/schema/tools";
import { cacheLife } from "next/cache";
import { getVoltagesByTool } from "@/lib/variant-voltages";
import type { SortKey, VoltageKey } from "./catalog-filters";
import { type FacetCounts, getFacetCounts } from "./facet-counts";

export const CATALOG_PAGE_SIZE = 24;

export interface CatalogDataInput {
	cat?: string;
	onlyPromo: boolean;
	page: number;
	priceMax?: number;
	priceMin?: number;
	search?: string;
	sort: SortKey;
	voltages: VoltageKey[];
}

export interface CatalogCurrentCategory {
	description: string | null;
	id: string;
	name: string;
	slug: string;
}

type ToolsResult = Awaited<ReturnType<typeof getTools>>;

export interface CatalogData {
	categoryTree: CategoryNode[];
	currentCategory: CatalogCurrentCategory | null;
	facetCounts: FacetCounts;
	tools: ToolsResult["tools"];
	total: number;
	voltagesByTool: Map<string, Voltage[]>;
}

// Composição plana e testável (integração read-only em catalog-data.test.ts).
// A árvore não depende da categoria ativa, então parte antes do lookup de slug;
// getVoltagesByTool precisa dos ids retornados por getTools (serial inerente).
export async function fetchCatalogData(
	input: CatalogDataInput
): Promise<CatalogData> {
	const treePromise = getCategoryTree(db);

	let currentCategory: CatalogCurrentCategory | null = null;
	if (input.cat) {
		const detail = await getCategoryBySlug(db, input.cat);
		if (detail) {
			currentCategory = {
				description: detail.description,
				id: detail.id,
				name: detail.name,
				slug: input.cat,
			};
		}
	}
	const categoryId = currentCategory?.id;

	const [{ tools, total }, categoryTree, facetCounts] = await Promise.all([
		getTools(db, {
			categoryId,
			search: input.search,
			voltage: input.voltages.length > 0 ? input.voltages : undefined,
			priceMin: input.priceMin,
			priceMax: input.priceMax,
			onlyPromo: input.onlyPromo,
			sort: input.sort,
			limit: CATALOG_PAGE_SIZE,
			offset: (input.page - 1) * CATALOG_PAGE_SIZE,
		}),
		treePromise,
		getFacetCounts({
			categoryId,
			search: input.search,
			voltages: input.voltages,
			priceMin: input.priceMin,
			priceMax: input.priceMax,
			onlyPromo: input.onlyPromo,
		}),
	]);

	const voltagesByTool = await getVoltagesByTool(tools.map((t) => t.id));

	return {
		categoryTree,
		currentCategory,
		facetCounts,
		tools,
		total,
		voltagesByTool,
	};
}

// Unidade de cache do catálogo: a chave inclui todos os filtros parseados, então
// cada combinação tem a própria entrada e um hit custa zero idas ao Postgres.
// Mesmo TTL da home e da PDP (staleness de listagem já aceito no projeto).
export async function getCatalogData(
	input: CatalogDataInput
): Promise<CatalogData> {
	"use cache";
	cacheLife({ revalidate: 600 });
	return await fetchCatalogData(input);
}
