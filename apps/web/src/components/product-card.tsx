import type { ToolListItem } from "@emach/db/queries/tools";
import type { Voltage } from "@emach/db/schema/tools";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { QuickAddButton } from "@/components/quick-add-button";
import { SectionLabel } from "@/components/section-label";
import type { CartItemSnapshot } from "@/lib/cart-store";
import { fmtNumericBRL } from "@/lib/format";

interface ProductCardProps {
	/** "dark" sobre fundo claro (default); "elevated" (#242424) sobre fundo escuro (promoções). */
	surface?: "dark" | "elevated";
	tool: ToolListItem;
	/** Voltagens das variantes (selos na imagem). Vazio/ausente = sem variação. */
	voltages?: Voltage[];
}

function discountPercent(
	price: string,
	discounted: string | null
): number | null {
	if (discounted == null) {
		return null;
	}
	const p = Number(price);
	const d = Number(discounted);
	if (!(p > 0 && d >= 0) || d >= p) {
		return null;
	}
	return Math.round((1 - d / p) * 100);
}

export function ProductCard({
	surface = "dark",
	tool,
	voltages,
}: ProductCardProps) {
	const categorySlug = tool.primaryCategory?.slug ?? "";
	const categoryName = tool.primaryCategory?.name ?? "";
	const hasDiscount = tool.defaultVariant.discountedAmount != null;
	const discount = discountPercent(
		tool.defaultVariant.priceAmount,
		tool.defaultVariant.discountedAmount
	);
	const surfaceBg =
		surface === "elevated" ? "bg-surface-elevated" : "bg-near-black";

	const snapshot: CartItemSnapshot = {
		categoryName: tool.primaryCategory?.name ?? null,
		categorySlug: tool.primaryCategory?.slug ?? null,
		imageUrl: tool.primaryImage?.url ?? null,
		name: tool.name,
		priceAmount:
			tool.defaultVariant.discountedAmount ?? tool.defaultVariant.priceAmount,
		sku: tool.defaultVariant.sku,
		slug: tool.slug,
		toolId: tool.id,
		variantId: tool.defaultVariant.id,
		voltage: tool.defaultVariant.voltage,
	};

	return (
		<div
			className={`group relative flex h-full flex-col overflow-hidden rounded-[2px] border border-white/14 ${surfaceBg} transition-[transform,border-color] duration-[var(--card-dur)] ease-[var(--card-ease)] hover:-translate-y-1 hover:border-white/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
		>
			<div className="relative aspect-square shrink-0 overflow-hidden bg-image-bg">
				<ProductImage
					alt={tool.name}
					categorySlug={categorySlug}
					sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
					src={tool.primaryImage?.url}
					zoom
				/>

				{discount != null && (
					<span className="absolute top-0 right-0 z-10 inline-flex items-center bg-emach-red px-2.5 py-1 font-bold font-display text-lg text-white uppercase tracking-[0.06em]">
						-{discount}%
					</span>
				)}

				{voltages && voltages.length > 0 && (
					<div className="absolute bottom-2 left-2 z-[2] flex flex-wrap gap-1.5">
						{voltages.map((v) => (
							<span
								className="rounded-[2px] bg-near-black/85 px-2 py-0.5 font-bold font-display text-[11px] text-white uppercase tracking-[0.06em]"
								key={v}
							>
								{v}
							</span>
						))}
					</div>
				)}

				{tool.inStock ? (
					<QuickAddButton
						className="absolute inset-x-0 bottom-0 z-[3] flex translate-y-full items-center justify-center gap-2 bg-emach-red py-2.5 font-bold font-display text-[13px] text-white uppercase tracking-[0.1em] transition-transform duration-[var(--card-dur)] ease-[var(--card-ease)] hover:bg-emach-red-hover group-hover:translate-y-0 motion-reduce:transition-none"
						item={snapshot}
					/>
				) : (
					<div className="absolute inset-0 z-10 flex items-center justify-center bg-near-black/60">
						<span className="font-display font-semibold text-[12px] text-white uppercase tracking-[0.14em]">
							Esgotado
						</span>
					</div>
				)}
			</div>

			<div className="flex flex-1 flex-col gap-1 px-3 py-3.5">
				<SectionLabel tone="light">{categoryName}</SectionLabel>
				<p className="mt-1 font-medium text-[14px] text-white leading-tight">
					{tool.name}
				</p>
				<div className="mt-auto pt-2">
					<div className="flex items-baseline gap-2">
						<span className="font-bold text-[15px] text-white tabular-nums">
							{fmtNumericBRL(
								hasDiscount
									? tool.defaultVariant.discountedAmount
									: tool.defaultVariant.priceAmount
							)}
						</span>
						{hasDiscount && (
							<span className="text-[11px] text-white/60 tabular-nums line-through">
								{fmtNumericBRL(tool.defaultVariant.priceAmount)}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Stretched link: cobre o card pra navegação, fica abaixo do quick-add (z-[3]). */}
			<Link className="absolute inset-0 z-[1]" href={`/product/${tool.slug}`}>
				<span className="sr-only">{tool.name}</span>
			</Link>
		</div>
	);
}
