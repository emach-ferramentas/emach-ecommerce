import type { PromotionWithTools } from "@emach/db/queries/promotions";
import type { Voltage } from "@emach/db/schema/tools";
import Link from "next/link";
import { emachButtonVariants } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { ProductGrid } from "@/components/product-grid";
import { PromoCountdown } from "@/components/promo-countdown";
import { SectionLabel } from "@/components/section-label";

interface PromoHighlightProps {
	promotion: PromotionWithTools;
	voltagesByTool?: Map<string, Voltage[]>;
}

export function PromoHighlight({
	promotion,
	voltagesByTool,
}: PromoHighlightProps) {
	return (
		<section aria-label="Promoções" className="bg-black text-white">
			<PageContainer className="px-5 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-18">
				<div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
					<div className="flex flex-col gap-3">
						<SectionLabel tone="accent">Ofertas</SectionLabel>
						<h2 className="font-display font-medium text-[clamp(30px,6vw,44px)] text-white leading-[1.02] tracking-[-0.01em]">
							{promotion.title}
						</h2>
					</div>
					{promotion.endsAt && (
						<PromoCountdown endsAt={promotion.endsAt.toISOString()} />
					)}
				</div>

				<div className="pt-10">
					<ProductGrid
						surface="elevated"
						tools={promotion.tools}
						voltagesByTool={voltagesByTool}
					/>
				</div>

				<div className="mt-10 flex justify-center">
					<Link
						className={emachButtonVariants({
							size: "lg",
							variant: "outline-light",
						})}
						href="/catalog?promo=1"
					>
						Ver todas as ofertas
					</Link>
				</div>
			</PageContainer>
		</section>
	);
}
