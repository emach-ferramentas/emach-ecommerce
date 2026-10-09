import type { PromotionWithTools } from "@emach/db/queries/promotions";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CountChip } from "@/components/count-chip";
import { ProductCard } from "@/components/product-card";
import { PromoCountdown } from "@/components/promo-countdown";
import type { CardExtrasByTool } from "@/lib/card-data";

interface PromoHighlightProps {
	extrasByTool?: CardExtrasByTool;
	promotion: PromotionWithTools;
}

/** Faixa da promoção em destaque, com os mesmos cards da vitrine. */
export function PromoHighlight({
	extrasByTool,
	promotion,
}: PromoHighlightProps) {
	if (promotion.tools.length === 0) {
		return null;
	}

	return (
		<section
			aria-labelledby="ofertas-titulo"
			className="border-line border-t bg-paper py-10 md:py-14"
		>
			<div className="shop-wrap">
				<div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
					<div>
						<h2
							className="font-display font-extrabold text-[clamp(1.9rem,1.3rem+1.6vw,2.75rem)] uppercase leading-[0.98]"
							id="ofertas-titulo"
						>
							{promotion.title}
						</h2>
						<CountChip className="mt-2">
							{promotion.tools.length}{" "}
							{promotion.tools.length === 1
								? "produto em oferta"
								: "produtos em oferta"}
						</CountChip>
					</div>
					{promotion.endsAt && (
						<PromoCountdown endsAt={promotion.endsAt.toISOString()} />
					)}
				</div>
				<div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
					{promotion.tools.map((tool) => (
						<ProductCard
							extras={extrasByTool?.[tool.id]}
							key={tool.id}
							size="compact"
							tool={tool}
						/>
					))}
				</div>
				<p className="mt-6">
					<Link
						className="inline-flex min-h-11 items-center gap-1 font-bold text-[15px] text-ink underline underline-offset-[3px]"
						href="/catalog?promo=1"
					>
						Ver todas as ofertas
						<ChevronRight aria-hidden="true" className="size-5" />
					</Link>
				</p>
			</div>
		</section>
	);
}
