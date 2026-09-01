import { db } from "@emach/db";
import { getAllToolSlugs } from "@emach/db/queries/tools";
import { env } from "@emach/env/web";
import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";

const BASE_URL = env.NEXT_PUBLIC_SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	"use cache";
	cacheLife({ revalidate: 86_400 });
	// Sob `use cache`, `new Date()` congela no momento da geração do cache
	// (lastModified refresca a cada ~24h). Aceitável para um sitemap.
	const now = new Date();
	const staticRoutes: MetadataRoute.Sitemap = [
		{ url: `${BASE_URL}/`, lastModified: now, priority: 1 },
		{ url: `${BASE_URL}/catalog`, lastModified: now, priority: 0.9 },
		{ url: `${BASE_URL}/sobre`, lastModified: now, priority: 0.5 },
	];

	// Categorias voltam ao sitemap como /catalog/[slug] (Track 2); com query + canonical estático seriam duplicatas.
	const toolSlugs = await getAllToolSlugs(db);

	const productRoutes: MetadataRoute.Sitemap = toolSlugs.map((slug) => ({
		url: `${BASE_URL}/product/${slug}`,
		lastModified: now,
		priority: 0.7,
	}));

	return [...staticRoutes, ...productRoutes];
}
