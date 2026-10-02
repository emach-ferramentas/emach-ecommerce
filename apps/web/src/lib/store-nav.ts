/** Navegação da loja (cabeçalho, menu, rodapé). Módulo server-only. */
import { db } from "@emach/db";
import { getCategoryTree } from "@emach/db/queries/categories";
import type { Route } from "next";
import { cacheLife } from "next/cache";

import { splitServiceTree } from "@/lib/service-tree";
import { getServices, type ServiceSummary } from "@/lib/services";

export interface NavCategory {
	href: Route;
	name: string;
	productCount: number;
	slug: string;
}

export interface NavService {
	href: Route;
	imageSrc: string | null;
	name: string;
	productCount: number;
	slug: string;
}

export interface StoreNav {
	categories: NavCategory[];
	services: NavService[];
}

function toNavService(service: ServiceSummary): NavService {
	return {
		href: service.href,
		imageSrc: service.imageSrc,
		name: service.name,
		productCount: service.productCount,
		slug: service.slug,
	};
}

export async function getStoreNav(): Promise<StoreNav> {
	"use cache";
	cacheLife({ revalidate: 600 });

	const [tree, services] = await Promise.all([
		getCategoryTree(db),
		getServices(),
	]);
	const { categories } = splitServiceTree(tree);
	return {
		categories: categories.map((c) => ({
			href: `/catalog/${c.slug}` as Route,
			name: c.name,
			productCount: c.productCount,
			slug: c.slug,
		})),
		services: services.map(toNavService),
	};
}
