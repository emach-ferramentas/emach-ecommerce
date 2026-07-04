import type { Review } from "@emach/db/schema/reviews";
import { cn } from "@emach/ui/lib/utils";

import { formatReviewDate } from "./review-date";
import { StarRating } from "./star-rating";
import { VerifiedBadge } from "./verified-badge";

interface ReviewCardProps {
	index: number;
	lastRowStart: number;
	review: Review & { clientName: string };
	stretch: boolean;
	total: number;
}

export function ReviewCard({
	review,
	index,
	total,
	lastRowStart,
	stretch,
}: ReviewCardProps) {
	const isLast = index === total - 1;

	return (
		<article
			className={cn(
				"border-border border-b px-4 py-5 sm:px-5",
				// Sobra ímpar estica full-width; senão, coluna esquerda ganha border-r.
				stretch && isLast ? "md:col-span-2" : index % 2 === 0 && "md:border-r",
				index >= lastRowStart && "md:border-b-0",
				isLast && "max-md:border-b-0"
			)}
		>
			<header className="mb-2.5 flex items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2.5">
					<StarRating rating={review.rating} />
					<span className="font-semibold text-[13px] text-near-black">
						{review.clientName}
					</span>
					<VerifiedBadge />
				</div>
				<time
					className="font-display text-[11px] text-gray-60 uppercase tracking-[0.08em]"
					dateTime={review.createdAt.toISOString()}
				>
					{formatReviewDate(review.createdAt)}
				</time>
			</header>
			{review.title && (
				<h3 className="mb-1 font-semibold text-[14px] text-near-black">
					{review.title}
				</h3>
			)}
			<p className="text-[13.5px] text-near-black/75 leading-relaxed">
				{review.body}
			</p>
		</article>
	);
}
