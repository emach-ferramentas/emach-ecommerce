import { db } from "@emach/db";
import { getAllToolSlugs } from "@emach/db/queries/tools";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PhotoGallery } from "@/components/buy/photo-gallery";
import { specChips } from "@/lib/attribute-format";
import { buildSlots } from "@/lib/gallery-slots";
import { getProductShell } from "@/lib/product-detail";
import { sellableVariants } from "@/lib/purchase";
import { canonicalFor } from "@/lib/seo/canonical";
import { getServicesForTool } from "@/lib/services";

import { ProductInfo } from "./_components/product-info";
import { BreadcrumbJsonLd, ProductJsonLd } from "./_components/product-json-ld";
import { ProductReviewsSection } from "./_components/product-reviews-section";
import { ProductSpecs } from "./_components/product-specs";
import {
	RelatedProducts,
	RelatedProductsSkeleton,
} from "./_components/related-products";
import { ServiceKit } from "./_components/service-kit";
import { PRODUCT_GRID } from "./_lib/product-layout";

const PRODUCT_SPEC_CHIPS = 4;

interface ProductPageProps {
	params: Promise<{ slug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Prebuilda o shell de cada produto (navegação instantânea). Slugs novos
// resolvem on-demand e cacheiam por janela (getProductShell). Também satisfaz a
// exigência do cacheComponents de ≥1 param para a rota dinâmica validar.
export async function generateStaticParams() {
	const slugs = await getAllToolSlugs(db);
	return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
	params,
}: ProductPageProps): Promise<Metadata> {
	const { slug } = await params;
	const detail = await getProductShell(slug);

	if (!detail) {
		return { title: "Produto não encontrado" };
	}

	const title = detail.tool.name;
	const description = detail.tool.description ?? detail.tool.name;
	const ogImage = detail.images[0]?.url ?? "/images/og-default.png";
	const path = `/product/${detail.tool.slug ?? detail.tool.id}`;
	// `openGraph`/`twitter` no filho SUBSTITUEM o do root (não há merge
	// profundo): repetir imagem, locale e sufixo do título aqui é obrigatório.
	const ogTitle = `${title} · EMACH`;
	return {
		title,
		description,
		alternates: canonicalFor(path),
		openGraph: {
			title: ogTitle,
			description,
			type: "website",
			url: path,
			siteName: "EMACH",
			locale: "pt_BR",
			images: [ogImage],
		},
		twitter: {
			card: "summary_large_image",
			title: ogTitle,
			description,
			images: [ogImage],
		},
	};
}

function ReviewsSkeleton() {
	return (
		<section className="py-14">
			<div className="shop-wrap">
				<div className="h-64 animate-pulse bg-canteiro" />
			</div>
		</section>
	);
}

export default async function ProductPage({
	params,
	searchParams,
}: ProductPageProps) {
	const { slug } = await params;
	const detail = await getProductShell(slug);

	if (!detail) {
		notFound();
	}

	const services = await getServicesForTool(detail.tool.id);
	const attributes = [...detail.attributes].sort(
		(x, y) => x.sortOrder - y.sortOrder
	);
	const video = detail.tool.videoUrl
		? { url: detail.tool.videoUrl, poster: detail.tool.videoPosterUrl ?? null }
		: null;
	const defaultSku = sellableVariants(detail.variants)[0]?.sku ?? null;

	return (
		<>
			<ProductJsonLd detail={detail} />
			<BreadcrumbJsonLd
				category={detail.primaryCategory}
				productName={detail.tool.name}
				slug={detail.tool.slug ?? detail.tool.id}
			/>
			<div className="max-md:pb-[84px]">
				<div className="shop-wrap">
					<div className={PRODUCT_GRID}>
						<div className="max-md:-mx-4">
							<PhotoGallery
								name={detail.tool.name}
								priority
								sizes="(min-width: 1296px) 660px, (min-width: 768px) 55vw, 100vw"
								slots={buildSlots(detail.images, video)}
								thumbs="side"
							/>
						</div>
						<ProductInfo
							activePromotion={detail.activePromotion}
							product={{
								categoryName: detail.primaryCategory?.name ?? null,
								categorySlug: detail.primaryCategory?.slug ?? null,
								imageUrl: detail.images[0]?.url ?? null,
								name: detail.tool.name,
								slug: detail.tool.slug ?? detail.tool.id,
								toolId: detail.tool.id,
							}}
							reviewStats={detail.reviewStats}
							services={services}
							specChips={specChips(attributes, PRODUCT_SPEC_CHIPS)}
							stockByVariant={detail.stockByVariant}
							tool={detail.tool}
							variants={detail.variants}
						/>
					</div>
				</div>

				<ServiceKit services={services} toolId={detail.tool.id} />

				<ProductSpecs
					attributes={detail.attributes}
					sku={defaultSku}
					tool={detail.tool}
				/>

				<Suspense fallback={<ReviewsSkeleton />}>
					<ProductReviewsSection
						pathname={`/product/${slug}`}
						searchParams={searchParams}
						toolId={detail.tool.id}
					/>
				</Suspense>

				<Suspense fallback={<RelatedProductsSkeleton />}>
					<RelatedProducts
						categoryPath={detail.primaryCategory?.path ?? null}
						toolId={detail.tool.id}
					/>
				</Suspense>
			</div>
		</>
	);
}
