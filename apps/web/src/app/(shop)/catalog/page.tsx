import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { CatalogContent } from "./_components/catalog-content";
import { CatalogSkeleton } from "./_components/catalog-skeleton";
import { CATALOG_PAGE_SIZE, getCatalogData } from "./_lib/catalog-data";

const VALID_SORTS = [
	"relevance",
	"price-asc",
	"price-desc",
	"name-asc",
	"newest",
] as const;
type SortKey = (typeof VALID_SORTS)[number];

const VALID_VOLTAGES = ["127V", "220V", "Bivolt", "380V"] as const;
type VoltageKey = (typeof VALID_VOLTAGES)[number];

interface CatalogPageProps {
	searchParams: Promise<{
		cat?: string;
		q?: string;
		page?: string;
		sort?: string;
		voltage?: string;
		pmin?: string;
		pmax?: string;
		promo?: string;
	}>;
}

function parseSort(value: string | undefined): SortKey {
	if (value && (VALID_SORTS as readonly string[]).includes(value)) {
		return value as SortKey;
	}
	return "relevance";
}

function parseVoltages(value: string | undefined): VoltageKey[] {
	if (!value) {
		return [];
	}
	return value
		.split(",")
		.filter((v): v is VoltageKey =>
			(VALID_VOLTAGES as readonly string[]).includes(v)
		);
}

function parsePositiveInt(value: string | undefined): number | undefined {
	if (!value) {
		return;
	}
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// Metadata estática: sob cacheComponents, ler searchParams em generateMetadata
// bloquearia o prerender do shell. O título/categoria da busca aparece no corpo
// (CatalogContent), não no <title> (a rota tem filtros via query, não path).
export const metadata: Metadata = {
	title: "Catálogo",
	description:
		"Todas as ferramentas da EMACH: elétricas, manuais, medição e EPIs. Filtre por categoria, voltagem e preço.",
};

export default function CatalogPage({ searchParams }: CatalogPageProps) {
	return (
		<>
			<SiteHeader />
			<Suspense fallback={<CatalogSkeleton />}>
				<CatalogResults searchParams={searchParams} />
			</Suspense>
		</>
	);
}

// Buraco dinâmico do catálogo: lê searchParams (filtros/busca/paginação) — por
// isso vive sob Suspense. Os dados vêm de getCatalogData ('use cache' por
// combinação de filtros): hit não toca o Postgres.
async function CatalogResults({ searchParams }: CatalogPageProps) {
	const params = await searchParams;
	const sort = parseSort(params.sort);
	const voltages = parseVoltages(params.voltage);
	const priceMin = parsePositiveInt(params.pmin);
	const priceMax = parsePositiveInt(params.pmax);
	const onlyPromo = params.promo === "1";
	const page = Math.max(1, parsePositiveInt(params.page) ?? 1);
	const search = params.q?.trim() ? params.q.trim() : undefined;

	const {
		categoryTree,
		currentCategory,
		facetCounts,
		tools,
		total,
		voltagesByTool,
	} = await getCatalogData({
		cat: params.cat,
		search,
		voltages,
		priceMin,
		priceMax,
		onlyPromo,
		sort,
		page,
	});

	return (
		<CatalogContent
			categoryTree={categoryTree}
			currentCategoryDescription={currentCategory?.description ?? null}
			currentCategoryName={currentCategory?.name ?? null}
			currentCategorySlug={currentCategory?.slug ?? null}
			facetCounts={facetCounts}
			onlyPromo={onlyPromo}
			page={page}
			pageSize={CATALOG_PAGE_SIZE}
			priceMax={priceMax ?? null}
			priceMin={priceMin ?? null}
			query={params.q ?? ""}
			sort={sort}
			tools={tools}
			total={total}
			voltages={voltages}
			voltagesByTool={voltagesByTool}
		/>
	);
}
