import { CATALOG_PAGE_SIZE, getCatalogData } from "../_lib/catalog-data";
import {
	type CatalogSearchParams,
	parseCatalogSearchParams,
} from "../_lib/parse-search-params";
import { CatalogContent } from "./catalog-content";

interface CatalogResultsProps {
	/** Slug vindo do PATH (/catalog/[cat]). A rota raiz passa undefined. */
	cat?: string;
	searchParams: Promise<CatalogSearchParams>;
}

// Buraco dinâmico do catálogo: lê searchParams (filtros/busca/paginação) — por
// isso vive sob Suspense. Os dados vêm de getCatalogData ('use cache' por
// combinação de filtros): hit não toca o Postgres.
export async function CatalogResults({
	cat,
	searchParams,
}: CatalogResultsProps) {
	const params = await searchParams;
	const parsed = parseCatalogSearchParams(params);

	const {
		categoryTree,
		currentCategory,
		facetCounts,
		tools,
		total,
		voltagesByTool,
	} = await getCatalogData({
		cat,
		search: parsed.search,
		voltages: parsed.voltages,
		priceMin: parsed.priceMin,
		priceMax: parsed.priceMax,
		onlyPromo: parsed.onlyPromo,
		sort: parsed.sort,
		page: parsed.page,
	});

	return (
		<CatalogContent
			categoryTree={categoryTree}
			currentCategoryDescription={currentCategory?.description ?? null}
			currentCategoryName={currentCategory?.name ?? null}
			currentCategorySlug={currentCategory?.slug ?? null}
			facetCounts={facetCounts}
			onlyPromo={parsed.onlyPromo}
			page={parsed.page}
			pageSize={CATALOG_PAGE_SIZE}
			priceMax={parsed.priceMax ?? null}
			priceMin={parsed.priceMin ?? null}
			query={parsed.q}
			sort={parsed.sort}
			tools={tools}
			total={total}
			voltages={parsed.voltages}
			voltagesByTool={voltagesByTool}
		/>
	);
}
