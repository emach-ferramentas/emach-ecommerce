"use client";

import NextImage from "next/image";
import type { ReactNode } from "react";

import { CouponField } from "@/app/checkout/_components/coupon-field";
import { Panel, SummaryRow } from "@/components/panel";
import type { CartItem } from "@/lib/cart-store";
import { fmtBRL, numericToCents } from "@/lib/format";

export interface AppliedCoupon {
	code: string;
	discountCents: number;
}

interface OrderSummaryProps {
	action: ReactNode;
	coupon: AppliedCoupon | null;
	items: CartItem[];
	onCouponApplied: (coupon: AppliedCoupon) => void;
	onCouponRemoved: () => void;
	shippingCents: number | null;
	subtotalCents: number;
}

export function OrderSummary({
	action,
	coupon,
	items,
	onCouponApplied,
	onCouponRemoved,
	shippingCents,
	subtotalCents,
}: OrderSummaryProps) {
	const discount = coupon?.discountCents ?? 0;
	const total = Math.max(0, subtotalCents - discount + (shippingCents ?? 0));

	return (
		<Panel
			as="aside"
			className="lg:sticky lg:top-6 lg:self-start"
			title="Resumo do pedido"
			tone="canteiro"
		>
			<ul className="divide-y divide-line">
				{items.map((item) => (
					<li className="flex gap-3 py-3 first:pt-0" key={item.variantId}>
						<div className="relative size-16 shrink-0 overflow-hidden rounded-[3px] bg-well">
							{item.imageUrl ? (
								<NextImage
									alt={item.name}
									className="object-contain p-1"
									fill
									sizes="64px"
									src={item.imageUrl}
								/>
							) : null}
						</div>
						<div className="min-w-0 flex-1 text-[14.5px]">
							<p className="line-clamp-2 font-semibold text-ink">{item.name}</p>
							<p className="mt-0.5 text-ink-muted">Qtd: {item.quantity}</p>
						</div>
						<span className="font-bold text-[14.5px] text-ink tabular-nums">
							{fmtBRL(numericToCents(item.priceAmount) * item.quantity)}
						</span>
					</li>
				))}
			</ul>

			<div className="mt-4 border-line border-t pt-4">
				<CouponField
					applied={coupon}
					cartItems={items.map((i) => ({
						toolId: i.toolId,
						variantId: i.variantId,
						quantity: i.quantity,
					}))}
					onApplied={onCouponApplied}
					onRemoved={onCouponRemoved}
				/>
			</div>

			<div className="mt-4">
				<SummaryRow label="Subtotal">{fmtBRL(subtotalCents)}</SummaryRow>
				{discount > 0 ? (
					<SummaryRow label="Desconto" tone="discount">
						−{fmtBRL(discount)}
					</SummaryRow>
				) : null}
				<SummaryRow
					label="Frete"
					tone={shippingCents === null ? "muted" : undefined}
				>
					{shippingCents === null ? "A calcular" : fmtBRL(shippingCents)}
				</SummaryRow>
				<SummaryRow
					label="Total"
					tone={shippingCents === null ? "muted" : undefined}
					total
				>
					{shippingCents === null ? "A calcular" : fmtBRL(total)}
				</SummaryRow>
			</div>

			<div className="mt-5">{action}</div>
		</Panel>
	);
}
