/** Prateleiras da vitrine (home e catálogo). Módulo server-only: importa `db`. */
import { db } from "@emach/db";
import { getCategoryTree } from "@emach/db/queries/categories";
import { getTools, type ToolListItem } from "@emach/db/queries/tools";
import type { Route } from "next";
import { cacheLife } from "next/cache";

import { sortInStockFirst } from "@/lib/list-price";
import { splitServiceTree } from "@/lib/service-tree";
import { getServices } from "@/lib/services";

/** Produtos por prateleira; o resto fica a um clique, em "Ver todos". */
export const SHELF_LIMIT = 12;

export interface Shelf {
	href: Route;
	imageSrc: string | null;
	/** Em estoque no total da prateleira; `null` quando só a amostra foi lida. */
	inStockCount: number | null;
	items: ToolListItem[];
	key: string;
	productCount: number;
	title: string;
}

export interface Shelves {
	/** `service`: uma prateleira por ofício; `category`: por categoria-raiz. */
	by: "category" | "service";
	shelves: Shelf[];
}

export async function getShelves(): Promise<Shelves> {
	"use cache";
	cacheLife({ revalidate: 600 });

	const services = await getServices();
	if (services.length > 0) {
		return {
			by: "service",
			shelves: services
				.filter((s) => s.preview.length > 0)
				.map((s) => ({
					href: s.href,
					imageSrc: s.imageSrc,
					inStockCount: s.inStockCount,
					items: s.preview.slice(0, SHELF_LIMIT),
					key: s.slug,
					productCount: s.productCount,
					title: s.name,
				})),
		};
	}

	// Sem ofícios cadastrados, a vitrine cai para as categorias-raiz.
	const { categories } = splitServiceTree(await getCategoryTree(db));
	const shelves = await Promise.all(
		categories.map(async (category): Promise<Shelf> => {
			const { tools, total } = await getTools(db, {
				categoryId: category.id,
				limit: SHELF_LIMIT,
			});
			const items = sortInStockFirst(tools);
			return {
				href: `/catalog/${category.slug}` as Route,
				imageSrc: items[0]?.primaryImage?.url ?? null,
				inStockCount: null,
				items,
				key: category.slug,
				productCount: total,
				title: category.name,
			};
		})
	);
	return {
		by: "category",
		shelves: shelves.filter((s) => s.items.length > 0),
	};
}
