import type { QuoteItem } from "@emach/db/queries/shipping-quote";

export interface ToolDimRow {
	heightCm: string;
	id: string;
	lengthCm: string;
	packagingWeightKg: string;
	shipsInOwnBox: boolean;
	stackable: boolean;
	weightKg: string;
	widthCm: string;
}

// Linha crua de `tool`: peso/dimensões são anuláveis desde o sync #216
// (rascunho no dashboard). O CHECK `active_requires_shipping_data` só cobre
// `status='active'`; ferramenta `discontinued` (também vendida na loja) pode
// ter dimensões nulas legitimamente — a guarda abaixo é a defesa da loja.
export type ToolDimRowInput = Omit<
	ToolDimRow,
	"heightCm" | "lengthCm" | "weightKg" | "widthCm"
> & {
	heightCm: string | null;
	lengthCm: string | null;
	weightKg: string | null;
	widthCm: string | null;
};

export function hasShippingDims(row: ToolDimRowInput): row is ToolDimRow {
	return (
		row.weightKg !== null &&
		row.lengthCm !== null &&
		row.widthCm !== null &&
		row.heightCm !== null
	);
}

// Monta os QuoteItem do motor a partir das linhas de `tool` (numeric→number)
// e do carrinho. Lança se algum toolId do carrinho não existe.
export function buildQuoteItems(
	toolRows: ToolDimRow[],
	cartItems: { toolId: string; quantity: number }[]
): QuoteItem[] {
	const byId = new Map(toolRows.map((t) => [t.id, t]));
	return cartItems.map((item) => {
		const t = byId.get(item.toolId);
		if (!t) {
			throw new Error(`Ferramenta ${item.toolId} não encontrada`);
		}
		return {
			heightCm: Number(t.heightCm),
			lengthCm: Number(t.lengthCm),
			widthCm: Number(t.widthCm),
			weightKg: Number(t.weightKg),
			packagingWeightKg: Number(t.packagingWeightKg),
			stackable: t.stackable,
			shipsInOwnBox: t.shipsInOwnBox,
			qty: item.quantity,
		};
	});
}
