import { describe, expect, it } from "vitest";
import { cardAction, voltageSummary } from "./card-action";

function tool(inStock: boolean, priceAmount: string | null) {
	return {
		defaultVariant: {
			discountedAmount: null,
			id: "v1",
			// O tipo diz string; o banco entrega null em variante de rascunho.
			priceAmount: priceAmount as string,
			sku: "S1",
			voltage: null,
		},
		inStock,
	};
}

describe("cardAction", () => {
	it("esgotado leva ao aviso, mesmo com várias voltagens", () => {
		expect(cardAction(tool(false, "100.00"), ["127V", "220V"])).toBe("notify");
	});

	it("duas voltagens pedem escolha antes de adicionar", () => {
		expect(cardAction(tool(true, "100.00"), ["127V", "220V"])).toBe(
			"choose-voltage"
		);
	});

	it("uma variante vendável adiciona direto", () => {
		expect(cardAction(tool(true, "100.00"), ["220V"])).toBe("add");
		expect(cardAction(tool(true, "100.00"), [])).toBe("add");
	});

	it("sem preço de vitrine só leva à página do produto", () => {
		expect(cardAction(tool(true, null), [])).toBe("view");
	});
});

describe("voltageSummary", () => {
	it("junta as voltagens com 'ou'", () => {
		expect(voltageSummary(["127V", "220V"])).toBe("127 V ou 220 V");
		expect(voltageSummary([])).toBeNull();
	});
});
