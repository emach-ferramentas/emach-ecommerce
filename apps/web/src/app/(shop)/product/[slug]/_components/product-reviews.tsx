import type { ToolDetail } from "@emach/db/queries/tools";
import type { Review } from "@emach/db/schema/reviews";
import { SectionLabel } from "@/components/section-label";
import { ReviewList } from "./review-list";
import type { ReviewSortKey } from "./review-sort";
import { StarRating } from "./star-rating";

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

function recommendPct(distribution: ToolDetail["reviewStats"]["distribution"]) {
	const positive = distribution[4] + distribution[5];
	const total =
		distribution[1] +
		distribution[2] +
		distribution[3] +
		distribution[4] +
		distribution[5];
	if (total === 0) {
		return 0;
	}
	return Math.round((positive / total) * 100);
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
	const recommend = recommendPct(stats.distribution);
	const totalReviews =
		stats.distribution[1] +
		stats.distribution[2] +
		stats.distribution[3] +
		stats.distribution[4] +
		stats.distribution[5];
	const bars = ([5, 4, 3, 2, 1] as const).map((star) => ({
		star,
		pct:
			totalReviews > 0
				? Math.round((stats.distribution[star] / totalReviews) * 100)
				: 0,
	}));

	return (
		<section aria-label="Avaliações dos clientes" className="py-14">
			{/* Largura alinhada ao topo (galeria w-1/2 + buy box w-[480px],
			    centrados) — replica 50vw + 480px, com teto p/ telas estreitas. */}
			<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]">
				<div className="mb-5 flex items-baseline justify-between gap-6">
					<SectionLabel tone="accent">O que dizem os clientes</SectionLabel>
					{totalReviews > 0 && (
						<span className="font-display font-semibold text-[11.5px] text-gray-60 uppercase tracking-[0.1em]">
							{recommend}% recomendam
						</span>
					)}
				</div>

				<div className="bg-near-black text-white">
					<div className="grid grid-cols-1 border-white/25 border-b md:grid-cols-[300px_1fr]">
						<div className="flex flex-col justify-center gap-2.5 border-white/25 border-b px-7 py-7 md:border-r md:border-b-0">
							<div className="flex items-baseline gap-2 font-display font-medium text-[56px] tabular-nums leading-none">
								{avg.toFixed(1).replace(".", ",")}
								<span className="text-[20px] text-white/50">/ 5</span>
							</div>
							<StarRating rating={avg} size={16} />
							<div className="text-[13.5px] text-white/70">
								<strong className="text-white">{stats.count}</strong>{" "}
								{stats.count === 1 ? "avaliação" : "avaliações"} ·{" "}
								<strong className="text-white">{recommend}%</strong> recomendam
							</div>
						</div>
						<div className="flex flex-col justify-center gap-2 px-7 py-7">
							{bars.map((b) => (
								<div
									aria-label={`${b.star} estrelas: ${b.pct}%`}
									className="flex items-center gap-3 text-[13px]"
									key={b.star}
									role="img"
								>
									<span
										aria-hidden="true"
										className="w-9 flex-none font-semibold"
									>
										{b.star} ★
									</span>
									<span
										aria-hidden="true"
										className="h-[7px] flex-1 bg-white/10"
									>
										<span
											className="block h-full bg-emach-red"
											style={{ width: `${b.pct}%` }}
										/>
									</span>
									<span
										aria-hidden="true"
										className="w-10 text-right tabular-nums"
									>
										{b.pct}%
									</span>
								</div>
							))}
						</div>
					</div>

					<ReviewList
						currentSearchParams={currentSearchParams}
						page={page}
						pageSize={pageSize}
						pathname={pathname}
						reviews={reviews}
						sort={sort}
						total={total}
					/>
				</div>
			</div>
		</section>
	);
}
