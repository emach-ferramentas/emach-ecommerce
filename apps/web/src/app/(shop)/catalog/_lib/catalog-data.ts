import { db } from "@emach/db";
import {
	type CategoryNode,
	getCategoryBySlug,
	getCategoryTree,
} from "@emach/db/queries/categories";
import { getTools } from "@emach/db/queries/tools";
import type { Route } from "next";
import { cacheLife } from "next/cache";
import { type CardExtrasByTool, getCardExtras } from "@/lib/card-data";
import { isServicePath, splitServiceTree } from "@/lib/service-tree";
import { serviceHref } from "@/lib/services";
import type { SortKey, VoltageKey } from "./catalog-filters";
import { ancestorsOf, type CatalogCrumb } from "./category-crumbs";
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
	/** Categorias acima da atual, da raiz para baixo (sem a mãe dos ofícios). */
	ancestors: CatalogCrumb[];
	description: string | null;
	id: string;
	/** A categoria atual é um ofício (filha de `servicos`). */
	isService: boolean;
	name: string;
	slug: string;
}

export interface CatalogService {
	href: Route;
	name: string;
	productCount: number;
	slug: string;
}

type ToolsResult = Awaited<ReturnType<typeof getTools>>;

export interface CatalogData {
	cardExtras: CardExtrasByTool;
	categoryTree: CategoryNode[];
	currentCategory: CatalogCurrentCategory | null;
	facetCounts: FacetCounts;
	services: CatalogService[];
	tools: ToolsResult["tools"];
	total: number;
}

// Composição plana e testável (integração read-only em catalog-data.test.ts).
// A árvore não depende da categoria ativa, então parte antes do lookup de slug;
// getCardExtras precisa dos ids retornados por getTools (serial inerente).
export async function fetchCatalogData(
	input: CatalogDataInput
): Promise<CatalogData> {
	const treePromise = getCategoryTree(db);

	let currentCategory: CatalogCurrentCategory | null = null;
	if (input.cat) {
		const [detail, fullTree] = await Promise.all([
			getCategoryBySlug(db, input.cat),
			treePromise,
		]);
		if (detail) {
			currentCategory = {
				ancestors: ancestorsOf(fullTree, detail.path),
				description: detail.description,
				id: detail.id,
				isService: isServicePath(detail.path),
				name: detail.name,
				slug: input.cat,
			};
		}
	}
	const categoryId = currentCategory?.id;

	const [{ tools, total }, fullTree, facetCounts] = await Promise.all([
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

	const cardExtras = await getCardExtras(tools.map((t) => t.id));
	const { categories, services } = splitServiceTree(fullTree);

	return {
		categoryTree: categories,
		currentCategory,
		facetCounts,
		services: services.map((s) => ({
			href: serviceHref(s.slug),
			name: s.name,
			productCount: s.productCount,
			slug: s.slug,
		})),
		tools,
		total,
		cardExtras,
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
