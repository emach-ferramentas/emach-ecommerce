"use client";

import { cn } from "@emach/ui/lib/utils";
import { Trash2 } from "lucide-react";
import Link from "next/link";

import { QtyStepper } from "@/components/buy/qty-stepper";
import { ProductImage } from "@/components/product-image";
import type { CartItem } from "@/lib/cart-store";
import { fmtBRL, numericToCents } from "@/lib/format";
import { voltageLabel } from "@/lib/purchase";

const MAX_LINE_QTY = 99;

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
	const unitCents = numericToCents(item.priceAmount);
	const href = `/product/${item.slug}` as const;

	return (
		<div
			className={cn(
				"emach-cart-item grid grid-cols-[72px_minmax(0,1fr)] gap-x-3.5 gap-y-2 border-line border-b py-4",
				!isCompact && "md:grid-cols-[96px_minmax(0,1fr)]"
			)}
			data-leaving={leaving ? "true" : undefined}
		>
			<Link
				aria-hidden="true"
				className={cn(
					"relative row-span-2 size-[72px] overflow-hidden rounded-[3px] bg-well",
					!isCompact && "md:size-24"
				)}
				href={href}
				onClick={onLinkClick}
				tabIndex={-1}
			>
				<ProductImage
					categorySlug={item.categorySlug ?? ""}
					sizes={isCompact ? "72px" : "96px"}
					src={item.imageUrl ?? undefined}
				/>
			</Link>

			<div className="min-w-0">
				<Link
					className="font-bold text-[15px] text-ink leading-[1.3] no-underline hover:underline"
					href={href}
					onClick={onLinkClick}
				>
					{item.name}
				</Link>
				<span className="mt-[3px] block text-[13px] text-ink-muted tabular-nums">
					{item.voltage ? (
						<>
							Voltagem{" "}
							<b className="font-bold text-ink">
								{voltageLabel(item.voltage).name}
							</b>{" "}
							·{" "}
						</>
					) : null}
					{fmtBRL(unitCents)} cada · Cód. {item.sku}
				</span>
			</div>

			<div className="col-start-2 flex flex-wrap items-center gap-x-2 gap-y-1">
				<QtyStepper
					label={`Quantidade de ${item.name}`}
					max={MAX_LINE_QTY}
					min={isCompact ? 0 : 1}
					onChange={onQuantityChange}
					size="md"
					value={item.quantity}
				/>
				<button
					aria-label={`Remover ${item.name} do carrinho`}
					className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[3px] px-2 font-semibold text-[13.5px] text-ink-muted underline-offset-[3px] hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
					onClick={onRemove}
					type="button"
				>
					<Trash2 aria-hidden="true" className="size-[17px]" />
					Remover
				</button>
				<span className="ml-auto font-extrabold text-[16.5px] text-ink tabular-nums">
					{fmtBRL(unitCents * item.quantity)}
				</span>
			</div>
		</div>
	);
}
