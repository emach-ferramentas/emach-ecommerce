"use client";

import { cn } from "@emach/ui/lib/utils";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { SectionLabel } from "@/components/section-label";
import type { CartItem } from "@/lib/cart-store";
import { fmtNumericBRL, numericToCents } from "@/lib/format";
import { QuantityPicker } from "./quantity-picker";

interface CartItemRowProps {
	item: CartItem;
	leaving?: boolean;
	onLinkClick?: () => void;
	onQuantityChange: (next: number) => void;
	onRemove: () => void;
	variant?: "full" | "compact";
}

export function CartItemRow({
	item,
	leaving = false,
	variant = "full",
	onQuantityChange,
	onRemove,
	onLinkClick,
}: CartItemRowProps) {
	const isCompact = variant === "compact";
	const lineTotalCents = numericToCents(item.priceAmount) * item.quantity;
	// Label: categoria, ou a voltagem como fallback p/ produtos sem categoria.
	// A voltagem só aparece na linha meta quando NÃO é o próprio label (evita
	// duplicar quando o produto não tem categoria).
	const labelText = item.categoryName ?? item.voltage ?? "";
	const showVoltageMeta = item.categoryName != null && item.voltage != null;
	const priceLabel = fmtNumericBRL((lineTotalCents / 100).toFixed(2));

	return (
		<div
			className={cn(
				"emach-cart-item border-border border-b last:border-b-0",
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
					alt={item.name}
					categorySlug={item.categorySlug ?? ""}
					sizes={isCompact ? "80px" : "120px"}
					src={item.imageUrl ?? undefined}
				/>
			</div>

			<div className="min-w-0">
				{labelText && (
					<SectionLabel className={isCompact ? "block truncate" : undefined}>
						{labelText}
					</SectionLabel>
				)}
				{isCompact ? (
					<Link
						className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap font-medium text-[14px] hover:underline"
						href={`/product/${item.slug}`}
						onClick={onLinkClick}
						title={item.name}
					>
						{item.name}
					</Link>
				) : (
					<Link
						className="mt-1 block font-medium text-[16px] hover:underline"
						href={`/product/${item.slug}`}
						onClick={onLinkClick}
					>
						{item.name}
					</Link>
				)}
				{showVoltageMeta && (
					<div
						className={cn(
							"text-gray-60",
							isCompact ? "mt-0.5 text-[11px]" : "mt-1 text-[12px]"
						)}
					>
						{item.voltage}
					</div>
				)}
				{!isCompact && (
					<div className="mt-3 flex flex-wrap items-center gap-4">
						<QuantityPicker onChange={onQuantityChange} value={item.quantity} />
						<button
							aria-label={`Remover ${item.name} do carrinho`}
							className="inline-flex min-h-11 cursor-pointer items-center border-none bg-transparent text-[12px] text-gray-60 underline transition-colors hover:text-near-black active:text-near-black"
							onClick={onRemove}
							type="button"
						>
							Remover
						</button>
					</div>
				)}
			</div>

			{isCompact ? (
				<div className="flex flex-col items-end gap-2.5">
					<div className="font-bold text-[14px] tabular-nums">{priceLabel}</div>
					<QuantityPicker
						min={0}
						onChange={onQuantityChange}
						value={item.quantity}
					/>
				</div>
			) : (
				<div className="font-bold text-[16px] tabular-nums">{priceLabel}</div>
			)}
		</div>
	);
}
