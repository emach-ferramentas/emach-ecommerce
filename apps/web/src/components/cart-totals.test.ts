import { describe, expect, it } from "vitest";
import { itemCountLabel } from "./cart-totals";

describe("itemCountLabel", () => {
	it("usa o singular só para 1", () => {
		expect(itemCountLabel(1)).toBe("1 item");
		expect(itemCountLabel(0)).toBe("0 itens");
		expect(itemCountLabel(3)).toBe("3 itens");
	});
});
