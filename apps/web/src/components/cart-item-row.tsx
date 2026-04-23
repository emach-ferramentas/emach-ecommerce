"use client";

import { cn } from "@emach/ui/lib/utils";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { SectionLabel } from "@/components/section-label";
import { fmtBRL } from "@/lib/format";
import type { Product } from "@/lib/mock-data";
import { QuantityPicker } from "./quantity-picker";

interface CartItemRowProps {
	leaving?: boolean;
	onLinkClick?: () => void;
	onQuantityChange: (next: number) => void;
	onRemove: () => void;
	product: Product;
	quantity: number;
	variant?: "full" | "compact";
}

/**
 * Linha de item de carrinho. Usada em `CartSheet` (compact) e `CartContent`
 * (full). A variante compact reduz as dimensões do thumbnail e do título
 * para caber no drawer lateral.
 */
export function CartItemRow({
	product,
	quantity,
	leaving = false,
	variant = "full",
	onQuantityChange,
	onRemove,
	onLinkClick,
}: CartItemRowProps) {
	const isCompact = variant === "compact";

	return (
		<div
			className={cn(
				"emach-cart-item border-gray-10 border-b",
				isCompact
					? "grid grid-cols-[80px_1fr_auto] items-start gap-3.5 py-4"
					: "grid grid-cols-[120px_1fr_auto] items-center gap-5 py-5"
			)}
			data-leaving={leaving ? "true" : undefined}
		>
			<div
				className={cn(
					"relative overflow-hidden bg-image-bg",
					isCompact ? "size-20" : "size-[120px]"
				)}
			>
				<ProductImage
					alt={product.name}
					categorySlug={product.categorySlug}
					sizes={isCompact ? "80px" : "120px"}
					src={product.images[0]}
				/>
			</div>

			<div className="min-w-0">
				<SectionLabel>{product.category}</SectionLabel>
				{isCompact ? (
					<Link
						className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap font-medium text-[14px] hover:underline"
						href={`/product/${product.slug}`}
						onClick={onLinkClick}
						title={product.name}
					>
						{product.name}
					</Link>
				) : (
					<div className="mt-1 font-medium text-[16px]">{product.name}</div>
				)}
				<div
					className={cn(
						"text-gray-60",
						isCompact ? "mt-0.5 text-[11px]" : "mt-1 text-[12px]"
					)}
				>
					SKU {product.sku}
				</div>
				<div
					className={cn(
						"flex",
						isCompact
							? "mt-2 flex-col items-start gap-1"
							: "mt-3 flex-wrap items-center gap-4"
					)}
				>
					<QuantityPicker onChange={onQuantityChange} value={quantity} />
					<button
						className="cursor-pointer border-none bg-transparent text-[12px] text-gray-60 underline hover:text-near-black"
						onClick={onRemove}
						type="button"
					>
						Remover
					</button>
				</div>
			</div>

			<div
				className={cn(
					"font-bold tabular-nums",
					isCompact ? "pt-0.5 text-[14px]" : "text-[16px]"
				)}
			>
				{fmtBRL(product.price * quantity)}
			</div>
		</div>
	);
}
