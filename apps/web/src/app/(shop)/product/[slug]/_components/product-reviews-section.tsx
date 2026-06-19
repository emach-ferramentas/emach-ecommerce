import { db } from "@emach/db";
import { getReviews, type ReviewStats } from "@emach/db/queries/reviews";

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
// avaliações, não renderiza nada (mesmo comportamento de antes).
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
		return null;
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
