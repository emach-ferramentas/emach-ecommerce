import { db } from "@emach/db";
import { getFeaturedPromotion } from "@emach/db/queries/promotions";
import { banner } from "@emach/db/schema/banner";
import { asc, eq } from "drizzle-orm";
import { SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

import { HeroCarousel } from "@/components/hero-carousel";
import { ServicePicker } from "@/components/home/service-picker";
import { ProductCard } from "@/components/product-card";
import { PromoHighlight } from "@/components/promo-highlight";
import { Shelf } from "@/components/shelf";
import { SiteHeader } from "@/components/site-header";
import { getCardExtras } from "@/lib/card-data";
import { canonicalFor } from "@/lib/seo/canonical";
import { getServices } from "@/lib/services";
import { getShelves } from "@/lib/shelves";

export const metadata: Metadata = {
	alternates: canonicalFor("/"),
};

// Banners ativos do hero. Query inline (não owned-by-dashboard): leitura trivial,
// decisão registrada no #122 (ADR-0009 dispensa virar query sincronizada).
function getActiveBanners() {
	return db
		.select()
		.from(banner)
		.where(eq(banner.isActive, true))
		.orderBy(asc(banner.sortOrder));
}

// Dados da home cacheados (ISR 10min, igual às prateleiras e aos ofícios).
async function loadHome() {
	"use cache";
	cacheLife({ revalidate: 600 });

	const [banners, featuredPromotion, services, shelves] = await Promise.all([
		getActiveBanners(),
		getFeaturedPromotion(db),
		getServices(),
		getShelves(),
	]);

	const extrasByTool = await getCardExtras([
		...shelves.shelves.flatMap((s) => s.items.map((t) => t.id)),
		...(featuredPromotion?.tools.map((t) => t.id) ?? []),
	]);

	return { banners, extrasByTool, featuredPromotion, services, shelves };
}

// Fallback do cache-miss (raro: loadHome é 'use cache' 600s). Espelha a caixa
// do hero pra página não pular quando os dados chegam.
function HomeSkeleton() {
	return (
		<main id="main-content">
			<div className="h-[70svh] min-h-[30rem] w-full bg-black lg:h-[calc(100svh-176px)]" />
		</main>
	);
}

export default function HomePage() {
	return (
		<>
			<SiteHeader />
			<Suspense fallback={<HomeSkeleton />}>
				<HomeContent />
			</Suspense>
		</>
	);
}

function distinctCounts(lists: { id: string; inStock: boolean }[][]) {
	const byId = new Map<string, boolean>();
	for (const list of lists) {
		for (const tool of list) {
			byId.set(tool.id, tool.inStock);
		}
	}
	let inStock = 0;
	for (const value of byId.values()) {
		if (value) {
			inStock += 1;
		}
	}
	return { inStock, total: byId.size };
}

async function HomeContent() {
	const { banners, extrasByTool, featuredPromotion, services, shelves } =
		await loadHome();
	const byService = shelves.by === "service";
	const counts = distinctCounts(services.map((s) => s.preview));

	return (
		<main id="main-content">
			<HeroCarousel banners={banners} />

			{services.length > 0 && <ServicePicker services={services} />}

			{shelves.shelves.length > 0 && (
				<section
					aria-labelledby="vitrine-titulo"
					className="border-line border-t bg-canteiro py-9 pb-11 md:py-14 md:pb-16"
				>
					<div className="shop-wrap">
						<div className="mb-[22px] flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-[30px]">
							<div>
								<h2
									className="font-display font-extrabold text-[clamp(1.9rem,1.3rem+1.6vw,2.75rem)] uppercase leading-[0.98]"
									id="vitrine-titulo"
								>
									{byService
										? "A loja inteira, por serviço"
										: "A loja inteira, por categoria"}
								</h2>
								{byService && (
									<p className="mt-2.5 max-w-[60ch] text-[16px] text-ink-2">
										{counts.total} {counts.total === 1 ? "produto" : "produtos"}
										, {counts.inStock} em estoque. O que serve em dois serviços
										aparece nas duas prateleiras.
									</p>
								)}
							</div>
							<Link
								className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border-[1.5px] border-line-strong bg-paper px-[18px] font-bold text-[15px] text-ink no-underline hover:border-ink max-md:w-full"
								href="/catalog"
							>
								<SlidersHorizontal aria-hidden="true" className="size-5" />
								Abrir catálogo com filtros
							</Link>
						</div>
						<div className="grid gap-[34px] md:gap-11">
							{shelves.shelves.map((shelf) => (
								<Shelf
									href={shelf.href}
									imageSrc={shelf.imageSrc}
									inStockCount={shelf.inStockCount}
									itemCount={shelf.items.length}
									key={shelf.key}
									productCount={shelf.productCount}
									title={shelf.title}
								>
									{shelf.items.map((tool) => (
										<ProductCard
											extras={extrasByTool[tool.id]}
											headingLevel={4}
											key={tool.id}
											tool={tool}
										/>
									))}
								</Shelf>
							))}
						</div>
					</div>
				</section>
			)}

			{featuredPromotion && (
				<PromoHighlight
					extrasByTool={extrasByTool}
					promotion={featuredPromotion}
				/>
			)}
		</main>
	);
}
