/**
 * Ofícios da loja (navegação por serviço). Módulo server-only: importa `db`.
 * As regras puras da subárvore vivem em `service-tree.ts`.
 */
import { db } from "@emach/db";
import { getCategoryTree } from "@emach/db/queries/categories";
import { getTools, type ToolListItem } from "@emach/db/queries/tools";
import { category, toolCategory } from "@emach/db/schema/categories";
import { and, asc, eq, like } from "drizzle-orm";
import type { Route } from "next";
import { cacheLife } from "next/cache";

import { listPriceCents, sortInStockFirst } from "@/lib/list-price";
import { SERVICES_ROOT_SLUG, splitServiceTree } from "@/lib/service-tree";

/** Foto de cada ofício, por slug. Ofício sem foto cai na 1ª foto de produto. */
export const SERVICE_IMAGES: Record<string, string> = {
	demolicao: "/images/oficios/demolicao.webp",
	"furar-e-parafusar": "/images/oficios/furar-e-parafusar.webp",
	"mistura-de-argamassa": "/images/oficios/mistura-de-argamassa.webp",
	"reboco-e-acabamento": "/images/oficios/reboco-e-acabamento.webp",
};

/** Teto de produtos lidos por ofício. Ofício é recorte curto do catálogo. */
const SERVICE_TOOLS_LIMIT = 60;

export interface ServiceSummary {
	fromPriceCents: number | null;
	href: Route;
	id: string;
	imageSrc: string | null;
	inStockCount: number;
	name: string;
	/** Todos os produtos do ofício (até o teto), em estoque primeiro. */
	preview: ToolListItem[];
	productCount: number;
	slug: string;
}

export function serviceHref(slug: string): Route {
	return `/catalog/${slug}` as Route;
}

export async function getServices(): Promise<ServiceSummary[]> {
	"use cache";
	cacheLife({ revalidate: 600 });

	const { services } = splitServiceTree(await getCategoryTree(db));
	return await Promise.all(
		services.map(async (service) => {
			const { tools, total } = await getTools(db, {
				categoryId: service.id,
				limit: SERVICE_TOOLS_LIMIT,
			});
			const preview = sortInStockFirst(tools);
			const inStock = preview.filter((t) => t.inStock);
			const prices = inStock
				.map(listPriceCents)
				.filter((cents): cents is number => cents !== null);
			return {
				fromPriceCents: prices.length > 0 ? Math.min(...prices) : null,
				href: serviceHref(service.slug),
				id: service.id,
				imageSrc:
					SERVICE_IMAGES[service.slug] ?? preview[0]?.primaryImage?.url ?? null,
				inStockCount: inStock.length,
				name: service.name,
				preview,
				productCount: total,
				slug: service.slug,
			};
		})
	);
}

export interface ToolService {
	href: Route;
	id: string;
	name: string;
	slug: string;
}

/** Ofícios ligados a um produto (pílulas da página de produto). */
export async function getServicesForTool(
	toolId: string
): Promise<ToolService[]> {
	"use cache";
	cacheLife({ revalidate: 600 });

	const rows = await db
		.select({ id: category.id, name: category.name, slug: category.slug })
		.from(toolCategory)
		.innerJoin(category, eq(category.id, toolCategory.categoryId))
		.where(
			and(
				eq(toolCategory.toolId, toolId),
				eq(category.isActive, true),
				like(category.path, `/${SERVICES_ROOT_SLUG}/%`)
			)
		)
		.orderBy(asc(category.sortOrder), asc(category.name));

	return rows.map((row) => ({ ...row, href: serviceHref(row.slug) }));
}
