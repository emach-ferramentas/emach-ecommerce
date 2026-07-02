"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-context";

/** Alinhado à animação de saída do `CartItemRow` (prop `leaving`). */
const LEAVE_MS = 220;

/**
 * Remoção de item do carrinho com animação de saída + toast "Desfazer".
 * Compartilhado pelo `CartSheet` (drawer) e pela página `/cart`.
 *
 * `removing` dirige o prop `leaving` do `CartItemRow`. O `pending` (ref) barra
 * double-tap no mesmo item de forma síncrona: sem ele, dois cliques rápidos
 * agendariam dois timeouts → dois toasts → o undo duplicado dobraria a
 * quantidade (`addToCart` faz merge por `variantId`).
 */
export function useRemoveWithUndo() {
	const { items, remove, restore } = useCart();
	const [removing, setRemoving] = useState<string | null>(null);
	const pending = useRef<Set<string>>(new Set());

	function handleRemove(id: string) {
		if (pending.current.has(id)) {
			return;
		}
		pending.current.add(id);
		const item = items.find((i) => i.variantId === id);
		setRemoving(id);
		window.setTimeout(() => {
			remove(id);
			pending.current.delete(id);
			setRemoving((cur) => (cur === id ? null : cur));
			if (item) {
				const { quantity, ...snapshot } = item;
				toast("Item removido do carrinho", {
					action: {
						// `restore` (não `add`): desfazer remoção não é demanda nova — não
						// deve emitir cart_event (#175).
						label: "Desfazer",
						onClick: () => restore(snapshot, quantity),
					},
				});
			}
		}, LEAVE_MS);
	}

	return { removing, handleRemove };
}
