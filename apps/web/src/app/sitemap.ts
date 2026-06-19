import { db } from "@emach/db";
import { getAllCategorySlugs } from "@emach/db/queries/categories";
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

	const [toolSlugs, categorySlugs] = await Promise.all([
		getAllToolSlugs(db),
		getAllCategorySlugs(db),
	]);

	const categoryRoutes: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
		url: `${BASE_URL}/catalog?cat=${slug}`,
		lastModified: now,
		priority: 0.8,
	}));

	const productRoutes: MetadataRoute.Sitemap = toolSlugs.map((slug) => ({
		url: `${BASE_URL}/product/${slug}`,
		lastModified: now,
		priority: 0.7,
	}));

	return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
