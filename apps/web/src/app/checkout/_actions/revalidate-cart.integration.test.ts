import { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { tool, toolVariant } from "@emach/db/schema/tools";
import { describe, expect, it } from "vitest";
import { computeFinalPrices } from "@/app/checkout/_lib/compute-final-prices";
import type { DbTransaction } from "@/lib/db-executor";
import { disableGlobalPromos } from "@/lib/test-helpers";

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

async function seedToolWithVariant(
	tx: DbTransaction,
	price: string
): Promise<{ toolId: string; variantId: string }> {
	const toolId = crypto.randomUUID();
	const variantId = crypto.randomUUID();
	await tx.insert(tool).values({
		id: toolId,
		name: `Tool ${toolId}`,
		weightKg: "1.000",
		lengthCm: "10.00",
		widthCm: "10.00",
		heightCm: "10.00",
	});
	await tx.insert(toolVariant).values({
		id: variantId,
		toolId,
		sku: `SKU-${variantId}`,
		barcode: `BARCODE-${variantId}`,
		priceAmount: price,
	});

	return { toolId, variantId };
}

describe("computeFinalPrices", () => {
	it("retorna o preço base quando não há auto-promo", async () => {
		await withRollback(async (tx) => {
			const { toolId, variantId } = await seedToolWithVariant(tx, "349.90");
			const prices = await computeFinalPrices(tx, [{ toolId, variantId }]);
			expect(prices).toEqual([{ variantId, finalPriceCents: 34_990 }]);
		});
	});

	it("aplica a auto-promo vigente (menor preço)", async () => {
		await withRollback(async (tx) => {
			const { toolId, variantId } = await seedToolWithVariant(tx, "100.00");
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
			const prices = await computeFinalPrices(tx, [{ toolId, variantId }]);
			expect(prices).toEqual([{ variantId, finalPriceCents: 8500 }]);
		});
	});
});
