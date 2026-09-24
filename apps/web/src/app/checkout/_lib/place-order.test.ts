import { db } from "@emach/db";
import { client } from "@emach/db/schema/client";
import { consentLog } from "@emach/db/schema/consent-log";
import { branch, stockLevel } from "@emach/db/schema/inventory";
import { order, orderItem } from "@emach/db/schema/orders";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { stockMovement } from "@emach/db/schema/stock-movements";
import { tool, toolVariant } from "@emach/db/schema/tools";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { disableGlobalPromos } from "@/lib/test-helpers";

// quoteShipping chama o DB global e a API externa — mockar para os testes de
// integração do place-order (a lógica de anti-fraude está coberta em
// place-order.shipping.test.ts).
vi.mock("@/lib/shipping/quote", () => ({
	quoteShipping: vi.fn().mockResolvedValue({
		negotiate: false,
		options: [
			{
				carrierId: "carrier-1",
				name: "SEDEX",
				priceCents: 2000,
				deliveryDays: 1,
			},
		],
	}),
}));

import { type CreateOrderInput, placeOrder } from "./place-order";

const ROLLBACK = Symbol("rollback");
const RE_ESTOQUE = /estoque/i;
const RE_DOC_DUP = /cadastrado em outra conta/i;
const RE_SQL_LEAK = /Failed query|update "client"/i;
const RE_COUPON_INVALID = /inválido ou indisponível/i;
const RE_COUPON_NOT_COVER = /não cobre/i;

/** Roda `fn` numa transação e sempre dá ROLLBACK — zero resíduo no banco. */
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

interface SeedResult {
	branchIds: string[];
	clientId: string;
	toolId: string;
	variantId: string;
}

async function seedMultiBranch(
	tx: typeof db,
	stockPerBranch: number[]
): Promise<SeedResult> {
	const clientId = crypto.randomUUID();
	await tx.insert(client).values({
		id: clientId,
		name: "Cliente Teste",
		email: `t-${clientId}@test.local`,
	});

	const toolId = crypto.randomUUID();
	await tx.insert(tool).values({
		id: toolId,
		name: "Furadeira Teste",
		weightKg: "1.000",
		lengthCm: "20.00",
		widthCm: "15.00",
		heightCm: "10.00",
	});

	const variantId = crypto.randomUUID();
	await tx.insert(toolVariant).values({
		id: variantId,
		toolId,
		sku: `SKU-${variantId}`,
		barcode: `BARCODE-${variantId}`,
		priceAmount: "100.00",
		isDefault: true,
	});

	const branchIds: string[] = [];
	for (const [i, qty] of stockPerBranch.entries()) {
		const branchId = crypto.randomUUID();
		await tx
			.insert(branch)
			.values({ id: branchId, name: `Filial Teste ${i + 1}` });
		await tx.insert(stockLevel).values({ variantId, branchId, quantity: qty });
		branchIds.push(branchId);
	}

	return { clientId, toolId, variantId, branchIds };
}

async function seedSecondVariant(
	tx: typeof db,
	stockPerBranch: number[],
	existingBranchIds: string[]
): Promise<{ toolId: string; variantId: string }> {
	const toolId = crypto.randomUUID();
	await tx.insert(tool).values({
		id: toolId,
		name: "Serra Teste",
		weightKg: "2.000",
		lengthCm: "40.00",
		widthCm: "25.00",
		heightCm: "15.00",
	});

	const variantId = crypto.randomUUID();
	await tx.insert(toolVariant).values({
		id: variantId,
		toolId,
		sku: `SKU-${variantId}`,
		barcode: `BARCODE-${variantId}`,
		priceAmount: "100.00",
		isDefault: true,
	});

	for (const [i, qty] of stockPerBranch.entries()) {
		const branchId = existingBranchIds[i];
		if (!branchId) {
			throw new Error("Branch faltando para semear segunda variante");
		}
		await tx.insert(stockLevel).values({ variantId, branchId, quantity: qty });
	}

	return { toolId, variantId };
}

function buildInput(
	items: Array<{ toolId: string; variantId: string; quantity: number }>
): CreateOrderInput {
	return {
		name: "Cliente Teste",
		phone: "11999999999",
		document: String(Date.now()).padStart(11, "0").slice(-11),
		addressId: null,
		newAddress: {
			zipCode: "01001000",
			street: "Rua Teste",
			number: "1",
			complement: "",
			neighborhood: "Centro",
			city: "São Paulo",
			state: "SP",
		},
		acceptMarketing: true,
		cartItems: items.map((i) => ({
			toolId: i.toolId,
			variantId: i.variantId,
			quantity: i.quantity,
			priceAmount: "100.00",
		})),
		shippingAmount: "20.00",
	};
}

describe("placeOrder (multi-filial)", () => {
	it("cria pedido com order.branch_id NULL e nenhum stock_movement (filial única)", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);
			const input = buildInput([{ toolId, variantId, quantity: 2 }]);

			const result = await placeOrder(tx, {
				clientId,
				input,
				ipAddress: null,
				userAgent: null,
				verifiedShippingCents: null,
			});

			const [ord] = await tx
				.select()
				.from(order)
				.where(eq(order.id, result.orderId));
			expect(ord?.branchId).toBeNull();
			expect(ord?.status).toBe("pending_payment");
			expect(ord?.subtotalAmount).toBe("200.00");
			expect(ord?.totalAmount).toBe("220.00");
			// Default: frete verificado (não veio shippingUnverified nos params).
			expect(ord?.shippingUnverified).toBe(false);

			const items = await tx
				.select()
				.from(orderItem)
				.where(eq(orderItem.orderId, result.orderId));
			expect(items).toHaveLength(1);
			expect(items[0]?.quantity).toBe(2);
			expect(items[0]?.barcode).toBe(`BARCODE-${variantId}`);

			const stocks = await tx
				.select()
				.from(stockLevel)
				.where(eq(stockLevel.variantId, variantId));
			expect(stocks.map((s) => s.quantity)).toEqual([10]);

			const movements = await tx
				.select()
				.from(stockMovement)
				.where(eq(stockMovement.orderId, result.orderId));
			expect(movements).toHaveLength(0);

			const consents = await tx
				.select()
				.from(consentLog)
				.where(eq(consentLog.clientId, clientId));
			expect(consents).toHaveLength(3);
		});
	});

	it("grava shippingUnverified=true quando o frete não foi revalidado (#97)", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);
			const input = buildInput([{ toolId, variantId, quantity: 1 }]);

			const result = await placeOrder(tx, {
				clientId,
				input,
				ipAddress: null,
				userAgent: null,
				verifiedShippingCents: null,
				shippingUnverified: true,
			});

			const [ord] = await tx
				.select()
				.from(order)
				.where(eq(order.id, result.orderId));
			expect(ord?.shippingUnverified).toBe(true);
		});
	});

	it("autoriza pedido quando o estoque agregado de 2 filiais é suficiente", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [3, 2]);
			const input = buildInput([{ toolId, variantId, quantity: 4 }]);

			const result = await placeOrder(tx, {
				clientId,
				input,
				ipAddress: null,
				userAgent: null,
				verifiedShippingCents: null,
			});

			const [ord] = await tx
				.select()
				.from(order)
				.where(eq(order.id, result.orderId));
			expect(ord?.branchId).toBeNull();

			const stocks = await tx
				.select()
				.from(stockLevel)
				.where(eq(stockLevel.variantId, variantId));
			const totalQty = stocks.reduce((s, r) => s + r.quantity, 0);
			expect(totalQty).toBe(5);
			expect(stocks.map((s) => s.quantity).sort()).toEqual([2, 3]);

			const movements = await tx
				.select()
				.from(stockMovement)
				.where(eq(stockMovement.orderId, result.orderId));
			expect(movements).toHaveLength(0);
		});
	});

	it("rejeita pedido quando o estoque agregado é insuficiente", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [3, 2]);
			const input = buildInput([{ toolId, variantId, quantity: 6 }]);

			await expect(
				placeOrder(tx, {
					clientId,
					input,
					ipAddress: null,
					userAgent: null,
					verifiedShippingCents: null,
				})
			).rejects.toThrow(RE_ESTOQUE);
		});
	});

	it("rejeita pedido quando a variante não tem nenhum registro em stock_level", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, []);
			const input = buildInput([{ toolId, variantId, quantity: 1 }]);

			await expect(
				placeOrder(tx, {
					clientId,
					input,
					ipAddress: null,
					userAgent: null,
					verifiedShippingCents: null,
				})
			).rejects.toThrow(RE_ESTOQUE);
		});
	});

	it("rejeita pedido multi-item quando uma das variantes tem estoque agregado insuficiente", async () => {
		await withRollback(async (tx) => {
			const seedA = await seedMultiBranch(tx, [10]);
			const seedB = await seedSecondVariant(tx, [1], seedA.branchIds);
			const input = buildInput([
				{ toolId: seedA.toolId, variantId: seedA.variantId, quantity: 2 },
				{ toolId: seedB.toolId, variantId: seedB.variantId, quantity: 5 },
			]);

			await expect(
				placeOrder(tx, {
					clientId: seedA.clientId,
					input,
					ipAddress: null,
					userAgent: null,
					verifiedShippingCents: null,
				})
			).rejects.toThrow(RE_ESTOQUE);

			const orders = await tx
				.select()
				.from(order)
				.where(eq(order.clientId, seedA.clientId));
			expect(orders).toHaveLength(0);
		});
	});

	it("validação otimista — documenta oversell aceito em concorrência (ADR-0003)", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [1]);
			const otherClientId = crypto.randomUUID();
			await tx.insert(client).values({
				id: otherClientId,
				name: "Cliente Concorrente",
				email: `c-${otherClientId}@test.local`,
			});

			const input1 = buildInput([{ toolId, variantId, quantity: 1 }]);
			const input2 = {
				...buildInput([{ toolId, variantId, quantity: 1 }]),
				document: crypto.randomUUID().slice(0, 11).replace(/-/g, "0"),
			};

			const r1 = await placeOrder(tx, {
				clientId,
				input: input1,
				ipAddress: null,
				userAgent: null,
				verifiedShippingCents: null,
			});
			const r2 = await placeOrder(tx, {
				clientId: otherClientId,
				input: input2,
				ipAddress: null,
				userAgent: null,
				verifiedShippingCents: null,
			});

			expect(r1.orderId).toBeTruthy();
			expect(r2.orderId).toBeTruthy();

			const stocks = await tx
				.select()
				.from(stockLevel)
				.where(eq(stockLevel.variantId, variantId));
			expect(stocks[0]?.quantity).toBe(1);
		});
	});

	it("rejeita com erro amigável quando o documento já pertence a outra conta", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);

			const takenDoc = crypto.randomUUID();
			const otherId = crypto.randomUUID();
			await tx.insert(client).values({
				id: otherId,
				name: "Outro Cliente",
				email: `o-${otherId}@test.local`,
				document: takenDoc,
			});

			const input = {
				...buildInput([{ toolId, variantId, quantity: 1 }]),
				document: takenDoc,
			};
			const call = placeOrder(tx, {
				clientId,
				input,
				ipAddress: null,
				userAgent: null,
				verifiedShippingCents: null,
			});

			await expect(call).rejects.toThrow(RE_DOC_DUP);
			await expect(call).rejects.not.toThrow(RE_SQL_LEAK);
		});
	});
});

describe("placeOrder (cupom)", () => {
	it("aplica cupom percentual: grava discount/coupon/total e incrementa resgate", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);
			const couponId = crypto.randomUUID();
			await tx.insert(promotion).values({
				id: couponId,
				title: "Cupom 10%",
				type: "promocode",
				code: "OFF10",
				discountType: "percent",
				discountValue: "10.00",
				appliesToAll: true,
				redemptionCount: 0,
				active: true,
			});

			const input = {
				...buildInput([{ toolId, variantId, quantity: 2 }]),
				couponCode: "OFF10",
			};
			const result = await placeOrder(tx, {
				clientId,
				input,
				ipAddress: null,
				userAgent: null,
				verifiedShippingCents: null,
			});

			const [ord] = await tx
				.select()
				.from(order)
				.where(eq(order.id, result.orderId));
			expect(ord?.subtotalAmount).toBe("200.00");
			expect(ord?.discountAmount).toBe("20.00");
			expect(ord?.totalAmount).toBe("200.00");
			expect(ord?.couponId).toBe(couponId);

			const [promoAfter] = await tx
				.select()
				.from(promotion)
				.where(eq(promotion.id, couponId));
			expect(promoAfter?.redemptionCount).toBe(1);
		});
	});

	it("rejeita cupom esgotado", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);
			await tx.insert(promotion).values({
				id: crypto.randomUUID(),
				title: "Esgotado",
				type: "promocode",
				code: "CHEIO",
				discountType: "percent",
				discountValue: "10.00",
				appliesToAll: true,
				maxRedemptions: 1,
				redemptionCount: 1,
				active: true,
			});
			const input = {
				...buildInput([{ toolId, variantId, quantity: 1 }]),
				couponCode: "CHEIO",
			};
			// Anti-enumeração (#94): a mensagem é colapsada também neste caminho,
			// senão createOrderAction vazaria o motivo real ("esgotado") e contornaria
			// o controle do apply-coupon.
			await expect(
				placeOrder(tx, {
					clientId,
					input,
					ipAddress: null,
					userAgent: null,
					verifiedShippingCents: null,
				})
			).rejects.toThrow(RE_COUPON_INVALID);
		});
	});

	it("ignora item em auto-promo na base do cupom", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);
			const autoId = crypto.randomUUID();
			await tx.insert(promotion).values({
				id: autoId,
				title: "Auto",
				type: "promotion",
				discountType: "percent",
				discountValue: "20.00",
				appliesToAll: false,
				redemptionCount: 0,
				active: true,
			});
			await tx.insert(promotionTool).values({ promotionId: autoId, toolId });
			await tx.insert(promotion).values({
				id: crypto.randomUUID(),
				title: "Cupom",
				type: "promocode",
				code: "CUPOM",
				discountType: "percent",
				discountValue: "10.00",
				appliesToAll: true,
				redemptionCount: 0,
				active: true,
			});
			// Envia o preço JÁ auto-descontado (100 − 20% = 80) para passar a guarda de
			// tolerância e exercitar de fato a exclusão no validateCoupon: o único item
			// está em auto-promo → base elegível do cupom = 0 → "não cobre".
			const base = buildInput([{ toolId, variantId, quantity: 1 }]);
			const firstItem = base.cartItems[0];
			if (firstItem) {
				firstItem.priceAmount = "80.00";
			}
			const input = { ...base, couponCode: "CUPOM" };
			await expect(
				placeOrder(tx, {
					clientId,
					input,
					ipAddress: null,
					userAgent: null,
					verifiedShippingCents: null,
				})
			).rejects.toThrow(RE_COUPON_NOT_COVER);
		});
	});
});
