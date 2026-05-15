import { db } from "@emach/db";
import {
	getCategoryBySlug,
	getCategoryTree,
	getTools,
} from "@emach/db/queries/catalog";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CatalogContent } from "./_components/catalog-content";

const PAGE_SIZE = 24;

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

export async function generateMetadata({
	searchParams,
}: CatalogPageProps): Promise<Metadata> {
	const { cat, q } = await searchParams;
	if (q) {
		return {
			title: `“${q}” — Catálogo EMACH`,
			description: `Resultados de busca para “${q}” no catálogo EMACH.`,
		};
	}
	if (cat) {
		return {
			title: `${cat} — Catálogo EMACH`,
			description: `Explore produtos da categoria ${cat} no catálogo EMACH.`,
		};
	}
	return {
		title: "Catálogo — EMACH",
		description:
			"Explore ferramentas elétricas, manuais, equipamentos de medição e segurança EMACH.",
	};
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
	const params = await searchParams;
	const sort = parseSort(params.sort);
	const voltages = parseVoltages(params.voltage);
	const priceMin = parsePositiveInt(params.pmin);
	const priceMax = parsePositiveInt(params.pmax);
	const onlyPromo = params.promo === "1";
	const page = Math.max(1, parsePositiveInt(params.page) ?? 1);
	const search = params.q?.trim() ? params.q.trim() : undefined;

	const categoryTreePromise = getCategoryTree(db);

	let categoryId: string | undefined;
	let currentCategoryName: string | null = null;
	let currentCategoryDescription: string | null = null;
	if (params.cat) {
		const detail = await getCategoryBySlug(db, params.cat);
		if (detail) {
			categoryId = detail.id;
			currentCategoryName = detail.name;
			currentCategoryDescription = detail.description;
		}
	}

	const [{ tools, total }, categoryTree] = await Promise.all([
		getTools(db, {
			categoryId,
			search,
			voltage: voltages.length > 0 ? voltages : undefined,
			priceMin,
			priceMax,
			onlyPromo,
			sort,
			limit: PAGE_SIZE,
			offset: (page - 1) * PAGE_SIZE,
		}),
		categoryTreePromise,
	]);

	return (
		<>
			<SiteHeader />
			<CatalogContent
				categoryTree={categoryTree}
				currentCategoryDescription={currentCategoryDescription}
				currentCategoryName={currentCategoryName}
				currentCategorySlug={params.cat ?? null}
				onlyPromo={onlyPromo}
				page={page}
				pageSize={PAGE_SIZE}
				priceMax={priceMax ?? null}
				priceMin={priceMin ?? null}
				query={params.q ?? ""}
				sort={sort}
				tools={tools}
				total={total}
				voltages={voltages}
			/>
			<SiteFooter />
		</>
	);
}
