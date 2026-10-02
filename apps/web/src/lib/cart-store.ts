"use client";

import type { Voltage } from "@emach/db/schema/tools";
import { numericToCents } from "@/lib/format";

export interface CartItem {
	categoryName: string | null;
	categorySlug: string | null;
	imageUrl: string | null;
	name: string;
	priceAmount: string;
	quantity: number;
	sku: string;
	slug: string;
	toolId: string;
	variantId: string;
	voltage: Voltage | null;
}

export type CartItemSnapshot = Omit<CartItem, "quantity">;

const STORAGE_KEY = "emach:cart:v2";

export function loadCart(): CartItem[] {
	if (typeof window === "undefined") {
		return [];
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as CartItem[]) : [];
	} catch {
		return [];
	}
}

export function saveCart(items: CartItem[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	} catch {
		// Ignore storage errors silently
	}
}

export function addToCart(
	items: CartItem[],
	snapshot: CartItemSnapshot,
	qty = 1
): CartItem[] {
	const existing = items.find((i) => i.variantId === snapshot.variantId);
	const next = existing
		? items.map((i) =>
				i.variantId === snapshot.variantId
					? { ...i, quantity: i.quantity + qty }
					: i
			)
		: [...items, { ...snapshot, quantity: qty }];
	saveCart(next);
	return next;
}

export function updateQty(
	items: CartItem[],
	variantId: string,
	qty: number
): CartItem[] {
	const next =
		qty < 1
			? items.filter((i) => i.variantId !== variantId)
			: items.map((i) =>
					i.variantId === variantId ? { ...i, quantity: qty } : i
				);
	saveCart(next);
	return next;
}

export function removeFromCart(
	items: CartItem[],
	variantId: string
): CartItem[] {
	const next = items.filter((i) => i.variantId !== variantId);
	saveCart(next);
	return next;
}

export function cartSubtotalCents(items: readonly CartItem[]): number {
	return items.reduce(
		(sum, item) => sum + numericToCents(item.priceAmount) * item.quantity,
		0
	);
}

/**
 * Atualiza o `priceAmount` (snapshot) dos itens cujo `variantId` está em
 * `priceByVariantId`. Usado pela revalidação do checkout para alinhar o display
 * e o snapshot ao preço real atual antes do place-order. Retorna a MESMA
 * referência se nada mudou (evita re-render desnecessário no contexto).
 */
export function reconcilePrices(
	items: CartItem[],
	priceByVariantId: Map<string, string>
): CartItem[] {
	let changed = false;
	const next = items.map((i) => {
		const fresh = priceByVariantId.get(i.variantId);
		if (fresh != null && fresh !== i.priceAmount) {
			changed = true;
			return { ...i, priceAmount: fresh };
		}
		return i;
	});
	if (!changed) {
		return items;
	}
	saveCart(next);
	return next;
}
