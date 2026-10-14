import { describe, expect, it } from "vitest";
import { autoPromoToolIdsFromMap } from "./auto-promo";

// Testes que batem no DB (fetchAutoPromosByToolId via withRollback) vivem em
// `auto-promo.integration.test.ts` e ficam fora do CI (ver vitest.config.ts).
describe("auto-promo helper", () => {
	it("autoPromoToolIdsFromMap deriva o set dos toolIds com promo", () => {
		const map = new Map([
			["a", [{ discountType: "percent", discountValue: "10.00" }]],
			["b", []],
		]);

		const set = autoPromoToolIdsFromMap(map);
		expect(set.has("a")).toBe(true);
		expect(set.has("b")).toBe(false);
	});
});
