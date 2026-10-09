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
	const input = {
		cat,
		search: parsed.search,
		voltages: parsed.voltages,
		priceMin: parsed.priceMin,
		priceMax: parsed.priceMax,
		onlyPromo: parsed.onlyPromo,
		sort: parsed.sort,
		page: parsed.page,
	};

	const data = await getCatalogData(input);

	return (
		<CatalogContent
			cardExtras={data.cardExtras}
			categoryTree={data.categoryTree}
			currentCategory={data.currentCategory}
			facetCounts={data.facetCounts}
			onlyPromo={parsed.onlyPromo}
			page={parsed.page}
			pageSize={CATALOG_PAGE_SIZE}
			priceMax={parsed.priceMax ?? null}
			priceMin={parsed.priceMin ?? null}
			query={parsed.q}
			services={data.services}
			sort={parsed.sort}
			tools={data.tools}
			total={data.total}
			voltages={parsed.voltages}
		/>
	);
}
