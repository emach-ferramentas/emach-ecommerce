"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { trackCartEventAction } from "@/lib/actions/track-cart-event";
import {
	addToCart,
	type CartItem,
	type CartItemSnapshot,
	loadCart,
	reconcilePrices,
	removeFromCart,
	saveCart,
	updateQty,
} from "@/lib/cart-store";
import { getVisitorId } from "@/lib/visitor-id";

interface CartState {
	/** `false` até o carrinho ser carregado do localStorage (1º render no client). */
	hydrated: boolean;
	items: CartItem[];
	totalCount: number;
}

interface CartActions {
	add: (item: CartItemSnapshot, qty?: number) => void;
	clear: () => void;
	reconcile: (priceByVariantId: Map<string, string>) => void;
	remove: (variantId: string) => void;
	/** Re-adiciona sem emitir cart_event — só pro undo de remoção (#175). */
	restore: (item: CartItemSnapshot, qty: number) => void;
	setQty: (variantId: string, qty: number) => void;
}

const CartStateContext = createContext<CartState>({
	items: [],
	totalCount: 0,
	hydrated: false,
});

const CartActionsContext = createContext<CartActions>({
	add: () => undefined,
	setQty: () => undefined,
	remove: () => undefined,
	restore: () => undefined,
	clear: () => undefined,
	reconcile: () => undefined,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
	const [items, setItems] = useState<CartItem[]>([]);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		setItems(loadCart());
		setHydrated(true);
	}, []);

	// As ações só dependem de setItems (estável), logo o React Compiler mantém
	// este objeto referencialmente estável. Vivem num contexto SEPARADO do estado
	// p/ que consumidores que só despacham (QuickAddButton em cada card do grid,
	// botões da PDP, recomprar) NÃO re-renderizem quando `items`/`totalCount` muda.
	const actions: CartActions = {
		add: (item, qty = 1) => {
			setItems((prev) => addToCart(prev, item, qty));
			// Métrica de demanda (#175): 1 evento por clique de "adicionar", com a
			// quantidade DESTE clique (item já no carrinho conta o delta). Ajuste de
			// quantidade dentro do carrinho (setQty) e undo (restore) NÃO emitem.
			// Fire-and-forget: a action nunca lança; o catch cobre falha de rede.
			trackCartEventAction({
				toolId: item.toolId,
				variantId: item.variantId,
				sessionId: getVisitorId(),
				quantity: qty,
			}).catch(() => undefined);
		},
		restore: (item, qty) => setItems((prev) => addToCart(prev, item, qty)),
		setQty: (variantId, qty) =>
			setItems((prev) => updateQty(prev, variantId, qty)),
		remove: (variantId) => setItems((prev) => removeFromCart(prev, variantId)),
		clear: () => {
			setItems([]);
			saveCart([]);
		},
		reconcile: (priceByVariantId) =>
			setItems((prev) => reconcilePrices(prev, priceByVariantId)),
	};

	const totalCount = items.reduce((acc, i) => acc + i.quantity, 0);

	return (
		<CartActionsContext.Provider value={actions}>
			<CartStateContext.Provider value={{ items, totalCount, hydrated }}>
				{children}
			</CartStateContext.Provider>
		</CartActionsContext.Provider>
	);
}

/** Estado + ações do carrinho. Re-renderiza quando o carrinho muda. */
export function useCart(): CartState & CartActions {
	return { ...useContext(CartStateContext), ...useContext(CartActionsContext) };
}

/**
 * Só as ações (estáveis) do carrinho. Use em componentes que apenas DESPACHAM
 * (add/remove/etc.) e não leem `items` — não re-renderiza quando o carrinho muda.
 */
export function useCartActions(): CartActions {
	return useContext(CartActionsContext);
}
