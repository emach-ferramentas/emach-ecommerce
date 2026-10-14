import { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { describe, expect, it } from "vitest";
import type { DbTransaction } from "@/lib/db-executor";
import { disableGlobalPromos, seedTool } from "@/lib/test-helpers";
import { autoPromoToolIdsFromMap, fetchAutoPromosByToolId } from "./auto-promo";

// Integração: bate no Supabase compartilhado via withRollback. Fora do CI
// (VITEST_UNIT_ONLY=1 / lista INTEGRATION em vitest.config.ts); roda local com
// `bun run --filter=web test`.
const ROLLBACK = Symbol("rollback");

async function withRollback(
	fn: (tx: DbTransaction) => Promise<void>
): Promise<void> {
	try {
		await db.transaction(async (tx) => {
			await disableGlobalPromos(tx);
			await fn(tx);
			throw ROLLBACK;
		});
	} catch (err) {
		if (err !== ROLLBACK) {
			throw err;
		}
	}
}

describe("auto-promo helper (integração)", () => {
	it("fetchAutoPromosByToolId pega promo específica vigente", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			const promoId = crypto.randomUUID();
			await tx.insert(promotion).values({
				id: promoId,
				title: "Auto",
				type: "promotion",
				discountType: "percent",
				discountValue: "15.00",
				appliesToAll: false,
				active: true,
			});
			await tx.insert(promotionTool).values({ promotionId: promoId, toolId });
			const map = await fetchAutoPromosByToolId(tx, [toolId], new Date());
			expect(map.get(toolId)?.length).toBe(1);
			expect(autoPromoToolIdsFromMap(map).has(toolId)).toBe(true);
		});
	});
});
