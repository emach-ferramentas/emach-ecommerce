import { db } from "@emach/db";
import { getReviews, type ReviewStats } from "@emach/db/queries/reviews";

import { SectionLabel } from "@/components/section-label";

import { ProductReviews } from "./product-reviews";
import type { ReviewSortKey } from "./review-sort";

const REVIEWS_PER_PAGE = 10;

function parseReviewSort(value: string | string[] | undefined): ReviewSortKey {
	if (value === "rating-desc") {
		return "rating-desc";
	}
	return "newest";
}

function parseReviewPage(value: string | string[] | undefined): number {
	if (typeof value !== "string") {
		return 1;
	}
	const n = Number(value);
	return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

interface ProductReviewsSectionProps {
	pathname: string;
	reviewStats: ReviewStats;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
	toolId: string;
}

// Buraco dinâmico da página de produto: lê `searchParams` (paginação/ordenação
// das avaliações) — por isso vive sob Suspense, fora do shell cacheado. Sem
// avaliações, renderiza a faixa escura de confiança (spec 2026-07-03 §3.5).
export async function ProductReviewsSection({
	pathname,
	reviewStats,
	searchParams,
	toolId,
}: ProductReviewsSectionProps) {
	const sp = await searchParams;
	const reviewPage = parseReviewPage(sp.reviewPage);
	const reviewSort = parseReviewSort(sp.reviewSort);

	const reviewsResult = await getReviews(db, {
		toolId,
		page: reviewPage,
		limit: REVIEWS_PER_PAGE,
		sort: reviewSort,
	});

	if (reviewsResult.total === 0) {
		return (
			<section aria-label="Avaliações do produto" className="py-14">
				<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]">
					<div className="flex flex-col gap-4 bg-near-black px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-6">
						<div>
							<SectionLabel tone="accent">Avaliações</SectionLabel>
							<p className="mt-2 text-[14px] text-white/75">
								Este produto ainda não recebeu avaliações. Avaliações vêm de
								compradores verificados, com nota fiscal.
							</p>
						</div>
						<div
							aria-hidden="true"
							className="shrink-0 text-[18px] text-white/35 tracking-[4px]"
						>
							☆☆☆☆☆
						</div>
					</div>
				</div>
			</section>
		);
	}

	return (
		<ProductReviews
			currentSearchParams={sp}
			page={reviewPage}
			pageSize={REVIEWS_PER_PAGE}
			pathname={pathname}
			reviews={reviewsResult.reviews}
			sort={reviewSort}
			stats={reviewStats}
			total={reviewsResult.total}
		/>
	);
}
