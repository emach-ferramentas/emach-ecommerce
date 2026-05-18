import { db } from "@emach/db";
import { client } from "@emach/db/schema/client";
import { consentLog } from "@emach/db/schema/consent-log";
import { branch, stockLevel } from "@emach/db/schema/inventory";
import { order, orderItem } from "@emach/db/schema/orders";
import { stockMovement } from "@emach/db/schema/stock-movements";
import { tool, toolVariant } from "@emach/db/schema/tools";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { type CreateOrderInput, placeOrder } from "./place-order";

const ROLLBACK = Symbol("rollback");
const RE_ESTOQUE = /estoque/i;
const RE_DOC_DUP = /cadastrado em outra conta/i;
const RE_SQL_LEAK = /Failed query|update "client"/i;

/** Roda `fn` numa transação e sempre dá ROLLBACK — zero resíduo no banco. */
async function withRollback(
	fn: (tx: typeof db) => Promise<void>
): Promise<void> {
	try {
		await db.transaction(async (tx) => {
			await fn(tx as unknown as typeof db);
			throw ROLLBACK;
		});
	} catch (err) {
		if (err !== ROLLBACK) {
			throw err;
		}
	}
}

/** Semeia client+branch+tool+variant+stock dentro da transação `tx`. */
async function seed(
	tx: typeof db,
	stockQty: number
): Promise<{
	clientId: string;
	branchId: string;
	toolId: string;
	variantId: string;
}> {
	const branchId = crypto.randomUUID();
	await tx.insert(branch).values({ id: branchId, name: "Filial Teste" });

	const clientId = crypto.randomUUID();
	await tx.insert(client).values({
		id: clientId,
		name: "Cliente Teste",
		email: `t-${clientId}@test.local`,
	});

	const toolId = crypto.randomUUID();
	await tx.insert(tool).values({ id: toolId, name: "Furadeira Teste" });

	const variantId = crypto.randomUUID();
	await tx.insert(toolVariant).values({
		id: variantId,
		toolId,
		sku: `SKU-${variantId}`,
		priceAmount: "100.00",
		isDefault: true,
	});

	await tx
		.insert(stockLevel)
		.values({ variantId, branchId, quantity: stockQty });

	return { clientId, branchId, toolId, variantId };
}

function buildInput(toolId: string, variantId: string, qty: number) {
	return {
		name: "Cliente Teste",
		email: "cliente@test.local",
		phone: "11999999999",
		// placeOrder não revalida o input; documento único por execução
		// evita colisão com o índice unique de client.document.
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
		cartItems: [{ toolId, variantId, quantity: qty, priceAmount: "100.00" }],
		shippingAmount: "20.00",
	} satisfies CreateOrderInput;
}

describe("placeOrder", () => {
	it("cria o pedido, debita estoque e registra consentimento", async () => {
		await withRollback(async (tx) => {
			const { clientId, branchId, toolId, variantId } = await seed(tx, 10);
			const input = buildInput(toolId, variantId, 2);

			const result = await placeOrder(tx, {
				clientId,
				branchId,
				input,
				ipAddress: null,
				userAgent: null,
			});

			const [ord] = await tx
				.select()
				.from(order)
				.where(eq(order.id, result.orderId));
			expect(ord?.status).toBe("pending_payment");
			expect(ord?.subtotalAmount).toBe("200.00");
			expect(ord?.totalAmount).toBe("220.00");

			const items = await tx
				.select()
				.from(orderItem)
				.where(eq(orderItem.orderId, result.orderId));
			expect(items).toHaveLength(1);
			expect(items[0]?.quantity).toBe(2);
			expect(items[0]?.unitPrice).toBe("100.00");

			const [stock] = await tx
				.select()
				.from(stockLevel)
				.where(eq(stockLevel.variantId, variantId));
			expect(stock?.quantity).toBe(8);

			const movements = await tx
				.select()
				.from(stockMovement)
				.where(eq(stockMovement.orderId, result.orderId));
			expect(movements).toHaveLength(1);
			expect(movements[0]?.reason).toBe("saida_venda");
			expect(movements[0]?.actorType).toBe("system");
			expect(movements[0]?.delta).toBe(-2);

			const consents = await tx
				.select()
				.from(consentLog)
				.where(eq(consentLog.clientId, clientId));
			expect(consents).toHaveLength(3);
		});
	});

	it("rejeita quando o estoque é insuficiente", async () => {
		await withRollback(async (tx) => {
			const { clientId, branchId, toolId, variantId } = await seed(tx, 1);
			const input = buildInput(toolId, variantId, 5);

			await expect(
				placeOrder(tx, {
					clientId,
					branchId,
					input,
					ipAddress: null,
					userAgent: null,
				})
			).rejects.toThrow(RE_ESTOQUE);
		});
	});

	it("rejeita com erro amigável quando o documento já pertence a outra conta", async () => {
		await withRollback(async (tx) => {
			const { clientId, branchId, toolId, variantId } = await seed(tx, 10);

			// Documento único por execução: evita colisão com dados reais
			// da DB; placeOrder não revalida o formato do documento.
			const takenDoc = crypto.randomUUID();
			const otherId = crypto.randomUUID();
			await tx.insert(client).values({
				id: otherId,
				name: "Outro Cliente",
				email: `o-${otherId}@test.local`,
				document: takenDoc,
			});

			const input = { ...buildInput(toolId, variantId, 1), document: takenDoc };
			const call = placeOrder(tx, {
				clientId,
				branchId,
				input,
				ipAddress: null,
				userAgent: null,
			});

			await expect(call).rejects.toThrow(RE_DOC_DUP);
			await expect(call).rejects.not.toThrow(RE_SQL_LEAK);
		});
	});
});
