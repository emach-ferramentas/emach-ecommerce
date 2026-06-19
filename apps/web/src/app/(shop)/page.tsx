import { db } from "@emach/db";
import { getFeaturedPromotion } from "@emach/db/queries/promotions";
import { getRecentTools } from "@emach/db/queries/tools";
import { banner } from "@emach/db/schema/banner";
import { category } from "@emach/db/schema/categories";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { BranchMapSection } from "@/components/branch-map-section";
import { CategoryGrid } from "@/components/category-grid";
import { HeroCarousel } from "@/components/hero-carousel";
import { PageContainer } from "@/components/page-container";
import { ProductCarousel } from "@/components/product-carousel";
import { PromoHighlight } from "@/components/promo-highlight";
import { SectionHeader } from "@/components/section-header";
import { SiteHeader } from "@/components/site-header";
import { getVoltagesByTool } from "@/lib/variant-voltages";

// Banners ativos do hero. Query inline (não owned-by-dashboard): leitura trivial,
// decisão registrada no #122 (ADR-0009 dispensa virar query sincronizada).
function getActiveBanners() {
	return db
		.select()
		.from(banner)
		.where(eq(banner.isActive, true))
		.orderBy(asc(banner.sortOrder));
}

async function getRootCategories() {
	return db
		.select({
			id: category.id,
			slug: category.slug,
			name: category.name,
			description: category.description,
		})
		.from(category)
		.where(and(isNull(category.parentId), eq(category.isActive, true)))
		.orderBy(asc(category.sortOrder))
		.limit(4);
}

function arrayLiteral<T>(values: T[], castType: string) {
	return sql`ARRAY[${sql.join(
		values.map((v) => sql`${v}`),
		sql`, `
	)}]::${sql.raw(castType)}`;
}

async function getCategoryImages(
	slugs: string[]
): Promise<Map<string, string>> {
	if (slugs.length === 0) {
		return new Map();
	}

	const owned = await db.execute<{ slug: string; url: string }>(sql`
		WITH roots AS (
			SELECT id, slug FROM category WHERE slug = ANY(${arrayLiteral(slugs, "text[]")})
		),
		candidates AS (
			-- Imagem primária (menor sort_order) da 1ª ferramenta ativa
			-- cadastrada na categoria (menor created_at; id desempata).
			SELECT r.slug, ti.url,
			       ROW_NUMBER() OVER (
			         PARTITION BY r.slug
			         ORDER BY t.created_at ASC, t.id ASC, ti.sort_order ASC
			       ) AS rn
			FROM roots r
			JOIN category c
			  ON c.path = '/' || r.slug
			  OR c.path LIKE '/' || r.slug || '/%'
			JOIN tool_category tc ON tc.category_id = c.id
			JOIN tool t ON t.id = tc.tool_id
			JOIN tool_image ti ON ti.tool_id = tc.tool_id
			WHERE t.status = 'active'
		)
		SELECT slug, url FROM candidates WHERE rn = 1
	`);

	const map = new Map<string, string>();
	for (const row of owned.rows) {
		map.set(row.slug, row.url);
	}

	return map;
}

// Dados da home cacheados (ISR 10min, igual ao card de produto na home antes).
// Reads independentes em paralelo: categoryImages e voltagesByTool dependem só
// da 1ª wave, então rodam juntos (corte de uma ida sequencial ao banco).
async function loadHome() {
	"use cache";
	cacheLife({ revalidate: 600 });

	const [rootCategories, featuredPromotion, recentTools, banners] =
		await Promise.all([
			getRootCategories(),
			getFeaturedPromotion(db),
			getRecentTools(db, 8),
			getActiveBanners(),
		]);

	const [categoryImages, voltagesByTool] = await Promise.all([
		getCategoryImages(rootCategories.map((c) => c.slug)),
		getVoltagesByTool([
			...recentTools.map((t) => t.id),
			...(featuredPromotion?.tools.map((t) => t.id) ?? []),
		]),
	]);

	return {
		banners,
		categoryImages,
		featuredPromotion,
		recentTools,
		rootCategories,
		voltagesByTool,
	};
}

export default async function HomePage() {
	const {
		banners,
		categoryImages,
		featuredPromotion,
		recentTools,
		rootCategories,
		voltagesByTool,
	} = await loadHome();

	const rootCategoriesWithImages = rootCategories.map((c) => ({
		...c,
		imageUrl: categoryImages.get(c.slug) ?? null,
	}));

	return (
		<>
			<SiteHeader overlay />

			<main id="main-content">
				<HeroCarousel banners={banners} />

				{rootCategories.length > 0 && (
					<section aria-label="Categorias" className="bg-gray-10">
						<PageContainer className="px-5 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-18">
							<SectionHeader
								label="Categorias"
								link={{
									href: "/catalog",
									label: "Ver todas",
									variant: "arrow",
								}}
								title="Explorar por categoria"
							/>
							<CategoryGrid categories={rootCategoriesWithImages} />
						</PageContainer>
					</section>
				)}

				{featuredPromotion && (
					<PromoHighlight
						promotion={featuredPromotion}
						voltagesByTool={voltagesByTool}
					/>
				)}

				{recentTools.length > 0 && (
					<section
						aria-label="Novidades"
						className="bg-gray-10 px-5 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-18"
					>
						<PageContainer>
							<ProductCarousel
								label="Novidades"
								title="Recém-chegadas"
								tools={recentTools}
								voltagesByTool={voltagesByTool}
							/>
						</PageContainer>
					</section>
				)}

				<BranchMapSection />
			</main>
		</>
	);
}
