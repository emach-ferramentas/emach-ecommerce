"use client";

import { Separator } from "@emach/ui/components/separator";
import { Lock, ShoppingBag } from "lucide-react";

import { CartItemRow } from "@/components/cart-item-row";
import { EmachLinkButton } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { SectionLabel } from "@/components/section-label";
import { useCart } from "@/lib/cart-context";
import { fmtBRL, numericToCents } from "@/lib/format";
import { useRemoveWithUndo } from "@/lib/use-remove-with-undo";

const INSTALLMENTS = 12;

export function CartContent() {
	const { items, setQty } = useCart();
	const { removing, handleRemove } = useRemoveWithUndo();

	const itemCount = items.reduce((s, i) => s + i.quantity, 0);
	const subtotal = items.reduce(
		(s, i) => s + numericToCents(i.priceAmount) * i.quantity,
		0
	);
	// Frete é cotado no checkout (via CEP). Aqui o total não inclui frete.
	const total = subtotal;

	if (items.length === 0) {
		return (
			<PageContainer as="main" className="py-20 text-center" id="main-content">
				<div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-gray-10">
					<ShoppingBag className="text-gray-50" size={32} />
				</div>
				<h1 className="font-display font-medium text-[36px]">
					Seu carrinho está vazio
				</h1>
				<p className="mt-2.5 text-[15px] text-gray-60">
					Explore nosso catálogo e encontre as ferramentas certas para o seu
					trabalho.
				</p>
				<EmachLinkButton
					className="mt-7"
					href="/catalog"
					size="lg"
					variant="primary"
				>
					Ver catálogo
				</EmachLinkButton>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			as="main"
			className="max-w-[1080px] pt-10 pb-20"
			id="main-content"
		>
			<h1 className="mb-2 font-display font-medium text-[40px] tracking-[-0.01em]">
				Carrinho
			</h1>
			<div className="mb-8 text-[14px] text-gray-60">
				{itemCount} {itemCount === 1 ? "item" : "itens"}
			</div>

			<div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_360px]">
				{/* Items */}
				<div>
					{items.map((item) => (
						<CartItemRow
							item={item}
							key={item.variantId}
							leaving={removing === item.variantId}
							onQuantityChange={(next) =>
								next < 1
									? handleRemove(item.variantId)
									: setQty(item.variantId, next)
							}
							onRemove={() => handleRemove(item.variantId)}
						/>
					))}
				</div>

				{/* Summary */}
				<div className="self-start lg:sticky lg:top-24">
					<div className="bg-near-black p-7 text-white">
						<SectionLabel tone="accent">Resumo do pedido</SectionLabel>

						{/* Totals */}
						<div className="mt-5 flex flex-col gap-2.5 text-[14px]">
							<div className="flex justify-between">
								<span>Subtotal</span>
								<span className="tabular-nums">{fmtBRL(subtotal)}</span>
							</div>
							<div className="flex justify-between text-white/60">
								<span>Frete</span>
								<span>Calculado no checkout</span>
							</div>
						</div>

						<Separator className="mt-4 bg-white/25" />
						<div className="mt-4 flex items-baseline justify-between">
							<span className="font-bold font-display text-[14px] uppercase tracking-[0.1em]">
								TOTAL
							</span>
							<span className="font-bold font-display text-[28px] tabular-nums">
								{fmtBRL(total)}
							</span>
						</div>
						<div className="mt-0.5 text-right text-[12px] text-white/55">
							ou {INSTALLMENTS}× de {fmtBRL(total / INSTALLMENTS)} sem juros
						</div>

						<EmachLinkButton
							className="mt-5 flex"
							full
							href="/checkout"
							size="lg"
							variant="primary"
						>
							Finalizar compra
						</EmachLinkButton>
						<EmachLinkButton
							className="mt-2 flex"
							full
							href="/catalog"
							size="md"
							variant="ghost-light"
						>
							Continuar comprando
						</EmachLinkButton>
					</div>

					<div className="mt-5 flex items-center gap-2 text-[12px] text-gray-60">
						<Lock size={14} />
						Pagamento 100% seguro
					</div>
				</div>
			</div>
		</PageContainer>
	);
}
