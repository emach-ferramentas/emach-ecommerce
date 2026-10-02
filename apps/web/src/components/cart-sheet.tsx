"use client";

import { X } from "lucide-react";

import { CartEmpty } from "@/components/cart-empty";
import { CartItemRow } from "@/components/cart-item-row";
import { CartTotals, itemCountLabel } from "@/components/cart-totals";
import { useCart } from "@/lib/cart-context";
import { useOverlay } from "@/lib/use-overlay";
import { useRemoveWithUndo } from "@/lib/use-remove-with-undo";

interface CartSheetProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
	const { items, setQty, totalCount } = useCart();
	const { removing, handleRemove } = useRemoveWithUndo();
	const close = () => onOpenChange(false);
	// Overlay próprio (não Base UI Sheet): a transição/unmount da Base UI conflita
	// com o React Compiler — o sheet abria em opacity:0 sem desmontar, capturando
	// cliques invisíveis na direita da tela. Mesmo padrão de mobile-menu/filter.
	const panelRef = useOverlay(open, close);

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
				className="slide-in-from-right absolute inset-y-0 right-0 flex w-[min(440px,100vw)] animate-in flex-col bg-paper text-ink shadow-[-8px_0_28px_-10px_rgba(0,0,0,0.4)] duration-300 ease-out-expo motion-reduce:animate-none"
				ref={panelRef}
				role="dialog"
			>
				<div className="flex min-h-16 shrink-0 items-center justify-between gap-2.5 border-line border-b py-2 pr-2 pl-5">
					<div className="flex items-baseline gap-1.5">
						<h2 className="font-display font-extrabold text-[26px] uppercase leading-none">
							Carrinho
						</h2>
						{totalCount > 0 ? (
							<span className="font-semibold text-[14px] text-ink-muted">
								{itemCountLabel(totalCount)}
							</span>
						) : null}
					</div>
					<button
						aria-label="Fechar carrinho"
						className="grid size-11 cursor-pointer place-items-center rounded-[3px] hover:bg-canteiro focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
						onClick={close}
						type="button"
					>
						<X aria-hidden="true" className="size-[22px]" />
					</button>
				</div>

				{items.length === 0 ? (
					<div className="flex-1 overflow-y-auto px-5">
						<CartEmpty onNavigate={close} />
					</div>
				) : (
					<>
						<div className="flex-1 overflow-y-auto overscroll-contain px-5">
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
						<div className="shrink-0 border-line border-t bg-canteiro px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
							<CartTotals context="drawer" onNavigate={close} />
						</div>
					</>
				)}
			</div>
		</div>
	);
}
