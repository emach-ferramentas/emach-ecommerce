import { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { describe, expect, it } from "vitest";
import { disableGlobalPromos, seedTool } from "@/lib/test-helpers";
import {
	type CouponLine,
	publicCouponError,
	validateCoupon,
} from "./validate-coupon";

const ROLLBACK = Symbol("rollback");
const RE_MIN_ORDER = /Pedido mínimo/;

async function withRollback(
	fn: (tx: typeof db) => Promise<void>
): Promise<void> {
	try {
		await db.transaction(async (tx) => {
			await disableGlobalPromos(tx as unknown as typeof db);
			await fn(tx as unknown as typeof db);
			throw ROLLBACK;
		});
	} catch (err) {
		if (err !== ROLLBACK) {
			throw err;
		}
	}
}

interface PromoOpts {
	appliesToAll?: boolean;
	discountType?: "percent" | "fixed";
	discountValue?: string;
	endsAt?: Date | null;
	maxRedemptions?: number | null;
	minOrderAmount?: string | null;
	redemptionCount?: number;
	type?: "promotion" | "promocode";
}

async function seedPromotion(
	tx: typeof db,
	code: string,
	opts: PromoOpts = {}
): Promise<string> {
	const id = crypto.randomUUID();
	await tx.insert(promotion).values({
		id,
		title: `Promo ${code}`,
		type: opts.type ?? "promocode",
		code,
		discountType: opts.discountType ?? "percent",
		discountValue: opts.discountValue ?? "10.00",
		appliesToAll: opts.appliesToAll ?? true,
		maxRedemptions: opts.maxRedemptions ?? null,
		redemptionCount: opts.redemptionCount ?? 0,
		minOrderAmount: opts.minOrderAmount ?? null,
		active: true,
		endsAt: opts.endsAt ?? null,
	});

	return id;
}

const line = (
	toolId: string,
	basePriceCents: number,
	quantity = 1
): CouponLine => ({
	toolId,
	basePriceCents,
	quantity,
});

describe("validateCoupon", () => {
	it("aplica percentual sobre a base elegível", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "OFF10", { discountValue: "10.00" });

			const result = await validateCoupon(tx, "OFF10", [
				line(toolId, 10_000, 2),
			]);

			expect(result).toEqual(
				expect.objectContaining({ ok: true, discountCents: 2000 })
			);
		});
	});

	it("aplica desconto fixo com clamp na base", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "MENOS50", {
				discountType: "fixed",
				discountValue: "50.00",
			});
			const result = await validateCoupon(tx, "MENOS50", [line(toolId, 3000)]);
			expect(result).toEqual(
				expect.objectContaining({ ok: true, discountCents: 3000 })
			);
		});
	});

	it("casa o código de forma case-insensitive", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "OFF10", { discountValue: "10.00" });
			const result = await validateCoupon(tx, "off10", [line(toolId, 10_000)]);
			expect(result).toEqual(
				expect.objectContaining({ ok: true, discountCents: 1000 })
			);
		});
	});

	it("rejeita código inexistente", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			const result = await validateCoupon(tx, "NOPE", [line(toolId, 10_000)]);
			expect(result).toEqual({
				ok: false,
				error: "Cupom inválido",
				reason: "invalid",
			});
		});
	});

	it("rejeita cupom expirado", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "VELHO", { endsAt: new Date(Date.now() - 1000) });
			const result = await validateCoupon(tx, "VELHO", [line(toolId, 10_000)]);
			expect(result).toEqual({
				ok: false,
				error: "Cupom expirado",
				reason: "expired",
			});
		});
	});

	it("rejeita cupom esgotado", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "CHEIO", {
				maxRedemptions: 5,
				redemptionCount: 5,
			});
			const result = await validateCoupon(tx, "CHEIO", [line(toolId, 10_000)]);
			expect(result).toEqual({
				ok: false,
				error: "Cupom esgotado",
				reason: "exhausted",
			});
		});
	});

	it("rejeita abaixo do pedido mínimo", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "MIN", { minOrderAmount: "200.00" });
			const result = await validateCoupon(tx, "MIN", [line(toolId, 10_000)]);
			expect(result.ok).toBe(false);
			expect((result as { error: string }).error).toMatch(RE_MIN_ORDER);
			expect((result as { reason: string }).reason).toBe("min_order");
		});
	});

	it("pedido mínimo usa o subtotal elegível, não o total do carrinho", async () => {
		await withRollback(async (tx) => {
			const inTool = await seedTool(tx);
			const outTool = await seedTool(tx);

			const couponId = await seedPromotion(tx, "MINESCOPO", {
				appliesToAll: false,
				minOrderAmount: "200.00",
			});

			await tx
				.insert(promotionTool)
				.values({ promotionId: couponId, toolId: inTool });

			// Carrinho R$ 450 (in R$ 150 + out R$ 300), mas só R$ 150 elegível < R$ 200.
			// Se o mínimo olhasse o carrinho todo (450 ≥ 200), passaria — não deve.
			const result = await validateCoupon(tx, "MINESCOPO", [
				line(inTool, 15_000),
				line(outTool, 30_000),
			]);

			expect(result.ok).toBe(false);
			expect((result as { error: string }).error).toMatch(RE_MIN_ORDER);
		});
	});

	it("exclui itens com auto-promo ativa da base", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);

			const autoId = await seedPromotion(tx, "AUTO-X", {
				type: "promotion",
				appliesToAll: false,
			});

			await tx.insert(promotionTool).values({ promotionId: autoId, toolId });
			await seedPromotion(tx, "CUPOM", { discountValue: "10.00" });
			const result = await validateCoupon(tx, "CUPOM", [line(toolId, 10_000)]);
			expect(result).toEqual({
				ok: false,
				error: "Cupom não cobre nenhum item do carrinho",
				reason: "not_eligible",
			});
		});
	});

	it("restringe escopo a promotion_tool do cupom", async () => {
		await withRollback(async (tx) => {
			const inTool = await seedTool(tx);
			const outTool = await seedTool(tx);

			const couponId = await seedPromotion(tx, "ESCOPO", {
				appliesToAll: false,
				discountValue: "10.00",
			});

			await tx
				.insert(promotionTool)
				.values({ promotionId: couponId, toolId: inTool });

			const result = await validateCoupon(tx, "ESCOPO", [
				line(inTool, 10_000),
				line(outTool, 10_000),
			]);

			expect(result).toEqual(
				expect.objectContaining({ ok: true, discountCents: 1000 })
			);
		});
	});

	it("usa o set injetado para excluir auto-promo sem re-consultar", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "CUPOM", { discountValue: "10.00" });

			const result = await validateCoupon(
				tx,
				"CUPOM",
				[line(toolId, 10_000)],
				new Set([toolId])
			);

			expect(result).toEqual({
				ok: false,
				error: "Cupom não cobre nenhum item do carrinho",
				reason: "not_eligible",
			});
		});
	});

	it("set injetado vazio não exclui nada", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "CUPOM", { discountValue: "10.00" });

			const result = await validateCoupon(
				tx,
				"CUPOM",
				[line(toolId, 10_000)],
				new Set()
			);

			expect(result).toEqual(
				expect.objectContaining({ ok: true, discountCents: 1000 })
			);
		});
	});
});

describe("publicCouponError", () => {
	it("colapsa reasons enumeráveis numa mensagem genérica", () => {
		expect(publicCouponError("invalid", "Cupom inválido")).toBe(
			"Cupom inválido ou indisponível"
		);
		expect(publicCouponError("expired", "Cupom expirado")).toBe(
			"Cupom inválido ou indisponível"
		);
		expect(publicCouponError("exhausted", "Cupom esgotado")).toBe(
			"Cupom inválido ou indisponível"
		);
		expect(publicCouponError("empty", "Cupom inválido")).toBe(
			"Cupom inválido ou indisponível"
		);
	});

	it("preserva a mensagem de reasons não-enumeráveis (UX legítima)", () => {
		expect(
			publicCouponError(
				"not_eligible",
				"Cupom não cobre nenhum item do carrinho"
			)
		).toBe("Cupom não cobre nenhum item do carrinho");
		expect(publicCouponError("min_order", "Pedido mínimo de R$ 150,00")).toBe(
			"Pedido mínimo de R$ 150,00"
		);
	});
});
