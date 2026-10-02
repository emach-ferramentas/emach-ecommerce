import type { Voltage } from "@emach/db/schema/tools";

import type { CartItemSnapshot } from "@/lib/cart-store";
import { numericToCents } from "@/lib/format";
import { effectiveAutoDiscountCents } from "@/lib/promotions";
import { hasPrice, type PricedVariant } from "@/lib/sellable-variant";

/**
 * Regras de compra compartilhadas pela página de produto e pelo "Ver rápido":
 * quais variantes vendem, o preço com a promoção ativa e o item do carrinho.
 */

export interface PromotionDiscount {
	discountType: string;
	discountValue: string;
}

interface OrderableVariant {
	isDefault: boolean;
	priceAmount: string | null;
	sortOrder: number;
}

/** Variantes vendáveis (com preço), a default primeiro e depois por `sortOrder`. */
export function sellableVariants<T extends OrderableVariant>(
	variants: T[]
): PricedVariant<T>[] {
	return variants.filter(hasPrice).sort((a, b) => {
		if (a.isDefault !== b.isDefault) {
			return a.isDefault ? -1 : 1;
		}
		return a.sortOrder - b.sortOrder;
	});
}

/** Preço com a promoção, em reais com 2 casas; `null` quando ela não baixa nada. */
export function discountedAmount(
	priceAmount: string,
	promotion: PromotionDiscount | null
): string | null {
	if (!promotion) {
		return null;
	}
	const baseCents = numericToCents(priceAmount);
	const discountedCents = effectiveAutoDiscountCents(
		baseCents,
		promotion.discountType,
		promotion.discountValue
	);
	if (discountedCents >= baseCents) {
		return null;
	}
	return (discountedCents / 100).toFixed(2);
}

export interface VariantPrice {
	baseCents: number;
	/** Percentual inteiro de desconto; 0 sem promoção. */
	discountPct: number;
	finalAmount: string;
	finalCents: number;
	hasDiscount: boolean;
}

export function variantPrice(
	priceAmount: string,
	promotion: PromotionDiscount | null
): VariantPrice {
	const discounted = discountedAmount(priceAmount, promotion);
	const finalAmount = discounted ?? priceAmount;
	const baseCents = numericToCents(priceAmount);
	const finalCents = numericToCents(finalAmount);
	return {
		baseCents,
		discountPct:
			discounted !== null && baseCents > 0
				? Math.round((1 - finalCents / baseCents) * 100)
				: 0,
		finalAmount,
		finalCents,
		hasDiscount: discounted !== null,
	};
}

/**
 * Variante escolhida ao abrir a compra. Com uma só, ela; com várias, nenhuma:
 * o cliente escolhe a voltagem da tomada antes de adicionar.
 */
export function initialVariantId(variants: { id: string }[]): string | null {
	return variants.length === 1 ? (variants[0]?.id ?? null) : null;
}

export interface CartItemSource {
	categoryName: string | null;
	categorySlug: string | null;
	imageUrl: string | null;
	name: string;
	slug: string;
	toolId: string;
}

export function buildCartItem(
	product: CartItemSource,
	variant: { id: string; sku: string; voltage: Voltage | null },
	finalAmount: string
): CartItemSnapshot {
	return {
		categoryName: product.categoryName,
		categorySlug: product.categorySlug,
		imageUrl: product.imageUrl,
		name: product.name,
		priceAmount: finalAmount,
		sku: variant.sku,
		slug: product.slug,
		toolId: product.toolId,
		variantId: variant.id,
		voltage: variant.voltage,
	};
}

/** Rótulo do botão de voltagem e da tomada que ele atende. */
export function voltageLabel(voltage: Voltage | null): {
	name: string;
	hint: string | null;
} {
	switch (voltage) {
		case "127V":
			return { name: "127 V", hint: "Tomada 110 a 127 V" };
		case "220V":
			return { name: "220 V", hint: "Tomada 220 V" };
		case "380V":
			return { name: "380 V", hint: "Rede trifásica 380 V" };
		case "Bivolt":
			return { name: "Bivolt", hint: "127 V e 220 V" };
		default:
			return { name: "Padrão", hint: null };
	}
}
