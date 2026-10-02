import { cn } from "@emach/ui/lib/utils";
import { Star } from "lucide-react";

interface StarRatingProps {
	className?: string;
	rating: number;
	size?: number;
}

const STARS = [1, 2, 3, 4, 5] as const;

export function StarRating({ rating, className, size = 13 }: StarRatingProps) {
	const filled = Math.round(rating);

	return (
		<div
			aria-label={`${rating.toFixed(1)} de 5 estrelas`}
			className={cn("flex items-center gap-0.5", className)}
			role="img"
		>
			{STARS.map((position) => {
				const isFilled = position <= filled;
				return (
					<Star
						aria-hidden
						className={
							isFilled
								? "fill-grafite text-grafite"
								: "fill-transparent text-gray-20"
						}
						key={position}
						size={size}
						strokeWidth={1.5}
					/>
				);
			})}
		</div>
	);
}
