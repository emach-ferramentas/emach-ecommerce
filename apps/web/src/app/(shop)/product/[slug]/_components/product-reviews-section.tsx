import { db } from "@emach/db";
import { getReviewStats, getReviews } from "@emach/db/queries/reviews";

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
	searchParams: Promise<Record<string, string | string[] | undefined>>;
	toolId: string;
}

// Buraco dinâmico da página de produto: lê `searchParams` (paginação/ordenação
// das avaliações) — por isso vive sob Suspense, fora do shell cacheado. Sem
// avaliações, renderiza a faixa escura de confiança (spec 2026-07-03 §3.5).
// As stats vêm de query live (NÃO do shell cacheado 600s): o modo da placa é
// decidido pelo total live, e trilho/barras precisam da MESMA fonte — senão a
// placa entra em grid com N cards ao lado de "1 avaliação" stale (code-review
// pós-#195, finding verificado 85/100).
export async function ProductReviewsSection({
	pathname,
	searchParams,
	toolId,
}: ProductReviewsSectionProps) {
	const sp = await searchParams;
	const reviewPage = parseReviewPage(sp.reviewPage);
	const reviewSort = parseReviewSort(sp.reviewSort);

	const [reviewsResult, reviewStats] = await Promise.all([
		getReviews(db, {
			toolId,
			page: reviewPage,
			limit: REVIEWS_PER_PAGE,
			sort: reviewSort,
		}),
		getReviewStats(db, toolId),
	]);

	if (reviewsResult.total === 0) {
		return (
			<section aria-label="Avaliações do produto" className="py-14">
				<div className="shop-wrap">
					<div className="flex flex-col gap-4 rounded-[5px] border border-line bg-canteiro px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
						<div>
							<h2 className="font-display font-extrabold text-[30px] uppercase leading-none">
								Avaliações
							</h2>
							<p className="mt-2 text-[15px] text-ink-2">
								Este produto ainda não recebeu avaliações. Avaliações vêm de
								compradores verificados.
							</p>
						</div>
						<div
							aria-hidden="true"
							className="shrink-0 text-[18px] text-line-strong tracking-[4px]"
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
