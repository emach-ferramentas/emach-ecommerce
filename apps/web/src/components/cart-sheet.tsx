"use client";

import { ShoppingBag, X } from "lucide-react";
import Link from "next/link";

import { CartItemRow } from "@/components/cart-item-row";
import { emachButtonVariants } from "@/components/emach-button";
import { useCart } from "@/lib/cart-context";
import { fmtBRL, numericToCents } from "@/lib/format";
import { useOverlay } from "@/lib/use-overlay";
import { useRemoveWithUndo } from "@/lib/use-remove-with-undo";

interface CartSheetProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
	const { items, setQty } = useCart();
	const { removing, handleRemove } = useRemoveWithUndo();
	const close = () => onOpenChange(false);
	// Overlay próprio (não Base UI Sheet): a transição/unmount da Base UI conflita
	// com o React Compiler — o sheet abria em opacity:0 sem desmontar, capturando
	// cliques invisíveis na direita da tela. Mesmo padrão de mobile-menu/filter.
	const panelRef = useOverlay(open, close);

	const totalItems = items.reduce((s, i) => s + i.quantity, 0);
	const subtotal = items.reduce(
		(s, i) => s + numericToCents(i.priceAmount) * i.quantity,
		0
	);

	if (!open) {
		return null;
	}

	return (
		<div className="fade-in fixed inset-0 z-50 animate-in duration-150">
			<button
				aria-label="Fechar carrinho"
				className="absolute inset-0 cursor-default border-none bg-black/50"
				onClick={close}
				type="button"
			/>
			<div
				aria-label="Carrinho"
				aria-modal="true"
				className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-popover text-popover-foreground"
				ref={panelRef}
				role="dialog"
			>
				{/* Header escuro com régua vermelha — assinatura do chiaroscuro EMACH */}
				<div className="gap-0 border-emach-red border-b-2 bg-near-black px-5 py-4">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2 font-bold font-display text-[15px] text-white uppercase tracking-[0.14em]">
							Carrinho
							{totalItems > 0 && (
								<span className="font-medium text-[13px] text-white/55 tracking-[0.08em]">
									· {totalItems} {totalItems === 1 ? "item" : "itens"}
								</span>
							)}
						</div>
						<button
							aria-label="Fechar carrinho"
							className="-mr-3 flex size-11 cursor-pointer items-center justify-center text-white/60 transition-colors hover:text-white active:text-white/80"
							onClick={close}
							type="button"
						>
							<X size={18} />
						</button>
					</div>
				</div>

				{items.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
						<div className="mb-4 flex size-16 items-center justify-center rounded-full bg-gray-10">
							<ShoppingBag className="text-gray-50" size={28} />
						</div>
						<h2 className="font-display font-semibold text-[24px]">
							Carrinho vazio
						</h2>
						<p className="mt-2 max-w-[260px] text-[13px] text-gray-60">
							Explore nosso catálogo e encontre as ferramentas certas para o seu
							trabalho.
						</p>
						<Link
							className={emachButtonVariants({
								className: "mt-6 w-full max-w-[220px]",
								size: "md",
								variant: "primary",
							})}
							href="/catalog"
							onClick={close}
						>
							Ver catálogo
						</Link>
					</div>
				) : (
					<>
						<div className="flex-1 overflow-y-auto px-5">
							{items.map((item) => (
								<CartItemRow
									item={item}
									key={item.variantId}
									leaving={removing === item.variantId}
									onLinkClick={close}
									onQuantityChange={(next) =>
										next < 1
											? handleRemove(item.variantId)
											: setQty(item.variantId, next)
									}
									onRemove={() => handleRemove(item.variantId)}
									variant="compact"
								/>
							))}
						</div>

						{/* Footer escuro — fecha a drawer com o CTA vermelho em destaque */}
						<div className="bg-near-black px-5 pt-4 pb-5 text-white">
							<div className="mb-4 flex items-baseline justify-between">
								<span className="font-bold font-display text-[13px] uppercase tracking-[0.12em]">
									Subtotal
								</span>
								<span className="font-bold font-display text-[24px] tabular-nums">
									{fmtBRL(subtotal)}
								</span>
							</div>

							{/* Link estilizado com as variantes, não <Link><button> —
							    botão dentro de âncora é markup inválido e o leitor de
							    tela anuncia dois controles. */}
							<Link
								className={emachButtonVariants({
									className: "mb-2",
									full: true,
									size: "lg",
									variant: "primary",
								})}
								href="/checkout"
								onClick={close}
							>
								Finalizar compra
							</Link>
							<Link
								className={emachButtonVariants({
									full: true,
									size: "md",
									variant: "ghost-light",
								})}
								href="/cart"
								onClick={close}
							>
								Ver carrinho
							</Link>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
