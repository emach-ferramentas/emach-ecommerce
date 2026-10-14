"use client";

import type { Voltage } from "@emach/db/schema/tools";
import { z } from "zod";
import { numericToCents } from "@/lib/format";

// Cópia de `voltageEnum` (packages/db/src/schema/tools.ts): importar o enum em
// runtime puxaria o Drizzle para o bundle do cliente. O `satisfies` exige uma
// chave para cada `Voltage`, então voltagem nova vinda do sync quebra o tsc aqui.
const VOLTAGES = {
	"127V": "127V",
	"220V": "220V",
	Bivolt: "Bivolt",
	"380V": "380V",
} as const satisfies { [V in Voltage]: V };

const cartItemSchema: z.ZodType<CartItem> = z.object({
	categoryName: z.string().nullable(),
	categorySlug: z.string().nullable(),
	imageUrl: z.string().nullable(),
	name: z.string(),
	priceAmount: z.string(),
	quantity: z.number().int().positive(),
	sku: z.string(),
	slug: z.string(),
	toolId: z.string(),
	variantId: z.string(),
	voltage: z.enum(VOLTAGES).nullable(),
});

const cartListSchema = z.array(z.unknown()).catch([]);

/** Itens válidos do storage. Item com forma antiga ou corrompida sai do carrinho. */
function parseCartItems(stored: string): CartItem[] {
	return cartListSchema.parse(JSON.parse(stored)).flatMap((item) => {
		const parsed = cartItemSchema.safeParse(item);

		return parsed.success ? [parsed.data] : [];
	});
}

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

		return raw ? parseCartItems(raw) : [];
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
