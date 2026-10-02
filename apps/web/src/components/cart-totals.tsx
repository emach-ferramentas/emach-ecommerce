"use client";

import { Truck } from "lucide-react";
import type { Route } from "next";

import { EmachLinkButton } from "@/components/emach-button";
import { useCart } from "@/lib/cart-context";
import { fmtBRL } from "@/lib/format";
import { installmentLabel } from "@/lib/installments";

export function itemCountLabel(count: number): string {
	return `${count} ${count === 1 ? "item" : "itens"}`;
}

const SECONDARY_LINK = {
	drawer: { href: "/cart", label: "Ver página do carrinho" },
	page: { href: "/catalog", label: "Continuar comprando" },
} as const satisfies Record<string, { href: Route; label: string }>;

interface CartTotalsProps {
	context: keyof typeof SECONDARY_LINK;
	onNavigate?: () => void;
}

export function CartTotals({ context, onNavigate }: CartTotalsProps) {
	const { subtotalCents, totalCount } = useCart();
	const installments = installmentLabel(subtotalCents);
	const secondary = SECONDARY_LINK[context];

	return (
		<div className="grid gap-2.5">
			<div className="flex items-baseline justify-between gap-3 font-semibold text-[15px] text-ink">
				<span>Subtotal ({itemCountLabel(totalCount)})</span>
				<strong className="font-extrabold text-[25px] tabular-nums">
					{fmtBRL(subtotalCents)}
				</strong>
			</div>
			<p className="-mt-1.5 text-[14px] text-ink-2 tabular-nums">
				{installments
					? `ou ${installments} sem juros no cartão`
					: "À vista no Pix, boleto ou cartão"}
			</p>
			<p className="flex items-center gap-2 text-[14px] text-ink-muted">
				<Truck aria-hidden="true" className="size-[18px] shrink-0" />
				Frete calculado na finalização
			</p>
			<div className="grid gap-2">
				<EmachLinkButton
					full
					href="/checkout"
					onClick={onNavigate}
					size="lg"
					variant="cta"
				>
					Finalizar compra
				</EmachLinkButton>
				<EmachLinkButton
					full
					href={secondary.href}
					onClick={onNavigate}
					variant="line"
				>
					{secondary.label}
				</EmachLinkButton>
			</div>
		</div>
	);
}
