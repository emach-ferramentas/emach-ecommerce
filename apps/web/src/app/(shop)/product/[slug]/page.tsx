import { db } from "@emach/db";
import { getAllToolSlugs } from "@emach/db/queries/tools";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SiteHeader } from "@/components/site-header";
import { getProductShell } from "@/lib/product-detail";

import { Breadcrumb } from "./_components/breadcrumb";
import { ProductGallery } from "./_components/product-gallery";
import { ProductInfo } from "./_components/product-info";
import { BreadcrumbJsonLd, ProductJsonLd } from "./_components/product-json-ld";
import { ProductReviewsSection } from "./_components/product-reviews-section";
import { ProductSpecs } from "./_components/product-specs";
import { RelatedProducts } from "./_components/related-products";

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
	const ogImage = detail.images[0]?.url;
	return {
		title,
		description,
		openGraph: {
			title,
			description,
			type: "website",
			url: `/product/${detail.tool.slug ?? detail.tool.id}`,
			siteName: "EMACH",
			...(ogImage ? { images: [ogImage] } : {}),
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			...(ogImage ? { images: [ogImage] } : {}),
		},
	};
}

function ReviewsSkeleton() {
	return (
		<section className="py-14">
			<div className="mx-auto h-64 w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)] animate-pulse bg-near-black/5" />
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

	const primaryImageUrl = detail.images[0]?.url ?? null;
	const primaryCategorySlug = detail.primaryCategory?.slug ?? null;
	const primaryCategoryName = detail.primaryCategory?.name ?? null;
	const video = detail.tool.videoUrl
		? { url: detail.tool.videoUrl, poster: detail.tool.videoPosterUrl ?? null }
		: null;

	return (
		<>
			<ProductJsonLd detail={detail} />
			<BreadcrumbJsonLd
				category={detail.primaryCategory}
				productName={detail.tool.name}
				slug={detail.tool.slug ?? detail.tool.id}
			/>
			<SiteHeader />

			<main id="main-content">
				<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)] pt-6">
					<Breadcrumb
						category={detail.primaryCategory}
						productName={detail.tool.name}
					/>
				</div>

				<div className="flex flex-col items-center gap-8 px-5 pt-4 pb-8 sm:px-8 lg:flex-row lg:items-start lg:justify-center lg:gap-10 lg:px-10">
					<ProductGallery
						categorySlug={primaryCategorySlug ?? ""}
						images={detail.images}
						name={detail.tool.name}
						video={video}
					/>
					<ProductInfo
						activePromotion={detail.activePromotion}
						primaryCategoryName={primaryCategoryName}
						primaryCategorySlug={primaryCategorySlug}
						primaryImageUrl={primaryImageUrl}
						reviewStats={detail.reviewStats}
						stockByVariant={detail.stockByVariant}
						tool={detail.tool}
						variants={detail.variants}
					/>
				</div>

				<ProductSpecs
					attributes={detail.attributes}
					categoryName={primaryCategoryName}
					images={detail.images}
					tool={detail.tool}
					video={video}
				/>

				<Suspense fallback={<ReviewsSkeleton />}>
					<ProductReviewsSection
						pathname={`/product/${slug}`}
						searchParams={searchParams}
						toolId={detail.tool.id}
					/>
				</Suspense>

				<RelatedProducts
					categoryPath={detail.primaryCategory?.path ?? null}
					toolId={detail.tool.id}
				/>
			</main>
		</>
	);
}
