import type { ToolDetail } from "@emach/db/queries/tools";
import type { Review } from "@emach/db/schema/reviews";
import { cn } from "@emach/ui/lib/utils";
import type { ReactNode } from "react";

import { formatReviewDate } from "./review-date";
import { reviewLayoutMode, stretchLast } from "./review-layout";
import { ReviewList } from "./review-list";
import { ReviewSort, type ReviewSortKey } from "./review-sort";
import { StarRating } from "./star-rating";
import { VerifiedBadge } from "./verified-badge";

interface ProductReviewsProps {
	currentSearchParams: Record<string, string | string[] | undefined>;
	page: number;
	pageSize: number;
	pathname: string;
	reviews: Array<Review & { clientName: string }>;
	sort: ReviewSortKey;
	stats: ToolDetail["reviewStats"];
	total: number;
}

function sumDistribution(
	distribution: ToolDetail["reviewStats"]["distribution"]
) {
	return (
		distribution[1] +
		distribution[2] +
		distribution[3] +
		distribution[4] +
		distribution[5]
	);
}

function recommendPct(distribution: ToolDetail["reviewStats"]["distribution"]) {
	const positive = distribution[4] + distribution[5];
	const total = sumDistribution(distribution);
	if (total === 0) {
		return 0;
	}
	return Math.round((positive / total) * 100);
}

interface SummaryRailProps {
	avg: number;
	count: number;
	// "% recomendam" só no modo grid — com n baixo o percentual mente (spec).
	recommend?: number;
}

function SummaryRail({ avg, count, recommend }: SummaryRailProps) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-border border-b px-4 py-3.5 sm:px-5 md:flex-col md:items-start md:justify-center md:gap-1.5 md:border-r md:border-b-0 md:py-6">
			<div className="flex items-baseline gap-1.5 font-display font-medium text-[42px] tabular-nums leading-none">
				{avg.toFixed(1).replace(".", ",")}
				<span className="text-[15px] text-ink-muted">/ 5</span>
			</div>
			<StarRating rating={avg} size={15} />
			<div className="text-[12.5px] text-ink-muted">
				{count} {count === 1 ? "avaliação" : "avaliações"}
				{recommend !== undefined && (
					<>
						{" · "}
						<strong className="text-ink">{recommend}%</strong> recomendam
					</>
				)}
			</div>
		</div>
	);
}

interface TestimonialCellProps {
	className?: string;
	review: Review & { clientName: string };
	// n=1: sem estrelas na célula — a nota do trilho já é a da única avaliação.
	// n=2–3: estrelas voltam (notas individuais diferem da média do trilho).
	showStars: boolean;
	size: "lg" | "md";
}

function TestimonialCell({
	className,
	review,
	showStars,
	size,
}: TestimonialCellProps) {
	return (
		<article
			className={cn(
				"flex flex-col justify-center px-4 py-6 sm:px-6",
				className
			)}
		>
			{showStars && <StarRating className="mb-2.5" rating={review.rating} />}
			{review.title && (
				<h3
					className={cn(
						"mb-1 font-semibold text-ink",
						size === "lg" ? "text-[16px]" : "text-[14px]"
					)}
				>
					{review.title}
				</h3>
			)}
			<p
				className={cn(
					"text-ink leading-relaxed",
					size === "lg"
						? "max-w-[52ch] font-medium text-[19px]"
						: "max-w-[60ch] text-[15px]"
				)}
			>
				{review.body}
			</p>
			<footer className="mt-3.5 flex flex-wrap items-center gap-3">
				<span className="font-display font-semibold text-[12.5px] text-ink uppercase tracking-[0.1em]">
					{review.clientName}
				</span>
				<VerifiedBadge />
				<time
					className="font-display text-[11px] text-ink-muted uppercase tracking-[0.08em]"
					dateTime={review.createdAt.toISOString()}
				>
					{formatReviewDate(review.createdAt)}
				</time>
			</footer>
		</article>
	);
}

function DistributionBars({
	distribution,
}: {
	distribution: ToolDetail["reviewStats"]["distribution"];
}) {
	const totalReviews = sumDistribution(distribution);
	const bars = ([5, 4, 3, 2, 1] as const).map((star) => ({
		star,
		pct:
			totalReviews > 0
				? Math.round((distribution[star] / totalReviews) * 100)
				: 0,
	}));

	return (
		<div className="flex flex-col justify-center gap-2 px-4 py-4 sm:px-5">
			{bars.map((b) => (
				<div
					aria-label={`${b.star} estrelas: ${b.pct}%`}
					className="flex items-center gap-3 text-[12.5px] text-ink"
					key={b.star}
					role="img"
				>
					<span aria-hidden="true" className="w-8 flex-none font-semibold">
						{b.star} ★
					</span>
					<span aria-hidden="true" className="h-[6px] flex-1 bg-canteiro-2">
						<span
							className="block h-full bg-grafite"
							style={{ width: `${b.pct}%` }}
						/>
					</span>
					<span
						aria-hidden="true"
						className="w-10 text-right text-ink-muted tabular-nums"
					>
						{b.pct}%
					</span>
				</div>
			))}
		</div>
	);
}

export function ProductReviews({
	stats,
	reviews,
	total,
	page,
	pageSize,
	sort,
	pathname,
	currentSearchParams,
}: ProductReviewsProps) {
	const avg = stats.avg ?? 0;
	const mode = reviewLayoutMode(total);
	const firstReview = reviews[0];

	let lowCountContent: ReactNode;
	if (firstReview === undefined) {
		// ?reviewPage fora do alcance com n baixo (URL manipulada).
		lowCountContent = (
			<div className="py-12 text-center text-[14px] text-ink-muted">
				Nenhuma avaliação nesta página.
			</div>
		);
	} else if (mode === "single") {
		lowCountContent = (
			<TestimonialCell review={firstReview} showStars={false} size="lg" />
		);
	} else {
		lowCountContent = (
			<div className="grid md:grid-cols-2">
				{reviews.map((review, index) => (
					<TestimonialCell
						className={cn(
							index % 2 === 0 &&
								index < reviews.length - 1 &&
								"md:border-border md:border-r",
							stretchLast(reviews.length) &&
								index === reviews.length - 1 &&
								"md:col-span-2 md:border-border md:border-t",
							index < reviews.length - 1 &&
								"max-md:border-border max-md:border-b"
						)}
						key={review.id}
						review={review}
						showStars
						size="md"
					/>
				))}
			</div>
		);
	}

	return (
		<section aria-label="Avaliações dos clientes" className="py-14">
			<div className="shop-wrap">
				<div className="mb-5 flex items-center justify-between gap-6">
					<h2 className="font-display font-extrabold text-[clamp(1.9rem,1.3rem+1.6vw,2.75rem)] uppercase leading-[0.98]">
						Avaliações
					</h2>
					{mode === "grid" && <ReviewSort current={sort} />}
				</div>

				<div className="rounded-[5px] border border-line">
					{mode === "grid" ? (
						<>
							<div className="grid grid-cols-1 border-border border-b md:grid-cols-[240px_1fr]">
								<SummaryRail
									avg={avg}
									count={stats.count}
									recommend={recommendPct(stats.distribution)}
								/>
								<DistributionBars distribution={stats.distribution} />
							</div>
							<ReviewList
								currentSearchParams={currentSearchParams}
								page={page}
								pageSize={pageSize}
								pathname={pathname}
								reviews={reviews}
								total={total}
							/>
						</>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
							<SummaryRail avg={avg} count={stats.count} />
							{lowCountContent}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
