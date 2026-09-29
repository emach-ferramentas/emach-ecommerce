"use client";

import { Plus } from "lucide-react";
import { useCartActions } from "@/lib/cart-context";
import type { CartItemSnapshot } from "@/lib/cart-store";

interface QuickAddButtonProps {
	className?: string;
	item: CartItemSnapshot;
}

/**
 * Quick-add do ProductCard. Fica acima do "stretched link" do card (z maior) e
 * para a propagação pra não navegar ao adicionar. Abre a gaveta do carrinho como
 * confirmação, igual ao fluxo da página de produto.
 */
export function QuickAddButton({ className, item }: QuickAddButtonProps) {
	const { add, openSheet } = useCartActions();

	return (
		<button
			className={className}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				add(item, 1);
				openSheet();
			}}
			type="button"
		>
			<Plus aria-hidden="true" size={15} strokeWidth={2.5} />
			Adicionar ao carrinho
		</button>
	);
}
