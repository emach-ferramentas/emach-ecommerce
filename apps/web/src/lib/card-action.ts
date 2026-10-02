import type { ToolListItem } from "@emach/db/queries/tools";
import type { Voltage } from "@emach/db/schema/tools";

import type { CartItemSnapshot } from "@/lib/cart-store";
import { listPriceCents } from "@/lib/list-price";
import { voltageLabel } from "@/lib/purchase";

/**
 * O que o botão do card faz:
 * - `notify`: esgotado, leva à página do produto ("Avise-me quando chegar");
 * - `choose-voltage`: mais de uma voltagem, abre o "Ver rápido" para escolher;
 * - `add`: uma variante vendável, adiciona direto ao carrinho;
 * - `view`: sem preço de vitrine, só leva à página do produto.
 */
export type CardAction = "add" | "choose-voltage" | "notify" | "view";

export function cardAction(
	tool: Pick<ToolListItem, "defaultVariant" | "inStock">,
	voltages: Voltage[]
): CardAction {
	if (!tool.inStock) {
		return "notify";
	}
	if (listPriceCents(tool) === null) {
		return "view";
	}
	return voltages.length > 1 ? "choose-voltage" : "add";
}

/** "127 V ou 220 V"; `null` sem voltagem cadastrada. */
export function voltageSummary(voltages: Voltage[]): string | null {
	if (voltages.length === 0) {
		return null;
	}
	return voltages.map((v) => voltageLabel(v).name).join(" ou ");
}

/** Item de carrinho da variante default de um produto de vitrine. */
export function listItemSnapshot(tool: ToolListItem): CartItemSnapshot {
	return {
		categoryName: tool.primaryCategory?.name ?? null,
		categorySlug: tool.primaryCategory?.slug ?? null,
		imageUrl: tool.primaryImage?.url ?? null,
		name: tool.name,
		priceAmount:
			tool.defaultVariant.discountedAmount ?? tool.defaultVariant.priceAmount,
		sku: tool.defaultVariant.sku,
		slug: tool.slug,
		toolId: tool.id,
		variantId: tool.defaultVariant.id,
		voltage: tool.defaultVariant.voltage,
	};
}
