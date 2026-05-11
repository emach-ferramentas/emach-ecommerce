"use server";

import { db } from "@emach/db";
import { client, clientAddress } from "@emach/db/schema/client";
import { consentLog } from "@emach/db/schema/consent-log";
import { stockLevel } from "@emach/db/schema/inventory";
import { order, orderItem } from "@emach/db/schema/orders";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { stockMovement } from "@emach/db/schema/stock-movements";
import { tool, toolVariant } from "@emach/db/schema/tools";
import { env } from "@emach/env/server";
import { and, eq, gt, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { log } from "@/lib/evlog";
import { requireCurrentClient } from "@/lib/session";
import { isValidCpfCnpj, onlyDigits } from "@/lib/validators/cpf-cnpj";

const PRICE_TOLERANCE_CENTS = 1;

const newAddressSchema = z.object({
	zipCode: z.string().refine((v) => onlyDigits(v).length === 8, "CEP inválido"),
	street: z.string().min(2),
	number: z.string().min(1),
	complement: z.string(),
	neighborhood: z.string().min(2),
	city: z.string().min(2),
	state: z.string().length(2),
});

const inputSchema = z.object({
	name: z.string().min(2),
	email: z.email(),
	phone: z.string().min(10),
	document: z.string().refine(isValidCpfCnpj, "Documento inválido"),
	addressId: z.string().nullable(),
	newAddress: newAddressSchema.nullable(),
	acceptMarketing: z.boolean(),
	cartItems: z
		.array(
			z.object({
				toolId: z.string().min(1),
				variantId: z.string().min(1),
				quantity: z.number().int().positive(),
				priceAmount: z.string().min(1),
			})
		)
		.min(1, "Carrinho vazio"),
	shippingAmount: z.string().regex(/^\d+\.\d{2}$/),
});

export type CreateOrderInput = z.infer<typeof inputSchema>;

export type CreateOrderResult =
	| { ok: true; orderId: string; orderNumber: string }
	| { ok: false; error: string };

interface AddressSnapshot {
	city: string;
	complement: string | null;
	country: string;
	neighborhood: string;
	number: string;
	recipient: string;
	state: string;
	street: string;
	zipCode: string;
}

function centsFromString(amount: string): number {
	return Math.round(Number(amount) * 100);
}

function formatOrderNumber(seq: number): string {
	const year = new Date().getUTCFullYear();
	return `${year}-${seq.toString().padStart(6, "0")}`;
}

async function buildAddressSnapshot(params: {
	clientId: string;
	addressId: string | null;
	newAddress: z.infer<typeof newAddressSchema> | null;
	recipient: string;
	tx: typeof db;
}): Promise<{ snapshot: AddressSnapshot; addressId: string }> {
	const { clientId, addressId, newAddress, recipient, tx } = params;

	if (addressId) {
		const rows = await tx
			.select()
			.from(clientAddress)
			.where(
				and(
					eq(clientAddress.id, addressId),
					eq(clientAddress.clientId, clientId)
				)
			)
			.limit(1);
		const row = rows[0];
		if (!row) {
			throw new Error("Endereço não encontrado");
		}
		return {
			addressId: row.id,
			snapshot: {
				recipient: row.recipient,
				zipCode: row.zipCode,
				street: row.street,
				number: row.number,
				complement: row.complement,
				neighborhood: row.neighborhood,
				city: row.city,
				state: row.state,
				country: row.country,
			},
		};
	}

	if (!newAddress) {
		throw new Error("Endereço não fornecido");
	}

	const id = crypto.randomUUID();
	const isDefault =
		(
			await tx
				.select({ id: clientAddress.id })
				.from(clientAddress)
				.where(eq(clientAddress.clientId, clientId))
				.limit(1)
		).length === 0;

	await tx.insert(clientAddress).values({
		id,
		clientId,
		recipient,
		zipCode: newAddress.zipCode,
		street: newAddress.street,
		number: newAddress.number,
		complement: newAddress.complement || null,
		neighborhood: newAddress.neighborhood,
		city: newAddress.city,
		state: newAddress.state,
		country: "BR",
		isDefault,
	});

	return {
		addressId: id,
		snapshot: {
			recipient,
			zipCode: newAddress.zipCode,
			street: newAddress.street,
			number: newAddress.number,
			complement: newAddress.complement || null,
			neighborhood: newAddress.neighborhood,
			city: newAddress.city,
			state: newAddress.state,
			country: "BR",
		},
	};
}

interface PreparedLine {
	cartItem: CreateOrderInput["cartItems"][number];
	finalPriceCents: number;
	lineTotalCents: number;
	tool: {
		id: string;
		name: string;
		model: string | null;
		ncm: string | null;
		cest: string | null;
		manufacturerName: string | null;
		weightKg: string | null;
		lengthCm: string | null;
		widthCm: string | null;
		heightCm: string | null;
	};
	variant: {
		id: string;
		toolId: string;
		sku: string;
		voltage: "127V" | "220V" | "Bivolt" | "380V" | null;
		priceAmount: string;
		costAmount: string | null;
	};
}

async function fetchDiscountPctByToolId(
	toolIds: string[],
	now: Date
): Promise<Map<string, number>> {
	const promoRows = await db
		.select({
			toolId: promotionTool.toolId,
			discountPct: promotion.discountPct,
		})
		.from(promotion)
		.innerJoin(promotionTool, eq(promotionTool.promotionId, promotion.id))
		.where(
			and(
				eq(promotion.active, true),
				eq(promotion.type, "promotion"),
				inArray(promotionTool.toolId, toolIds),
				or(isNull(promotion.startsAt), lte(promotion.startsAt, now)),
				or(isNull(promotion.endsAt), gt(promotion.endsAt, now))
			)
		);

	const map = new Map<string, number>();
	for (const row of promoRows) {
		const pct = Number(row.discountPct);
		if (!Number.isFinite(pct) || pct <= 0) {
			continue;
		}
		const current = map.get(row.toolId) ?? 0;
		if (pct > current) {
			map.set(row.toolId, pct);
		}
	}
	return map;
}

async function prepareLines(
	input: CreateOrderInput
): Promise<{ ok: true; lines: PreparedLine[] } | { ok: false; error: string }> {
	const variantIds = input.cartItems.map((i) => i.variantId);
	const toolIds = Array.from(new Set(input.cartItems.map((i) => i.toolId)));

	const [variantRows, toolRows, discountPctByToolId] = await Promise.all([
		db
			.select({
				id: toolVariant.id,
				toolId: toolVariant.toolId,
				sku: toolVariant.sku,
				voltage: toolVariant.voltage,
				priceAmount: toolVariant.priceAmount,
				costAmount: toolVariant.costAmount,
			})
			.from(toolVariant)
			.where(inArray(toolVariant.id, variantIds)),
		db
			.select({
				id: tool.id,
				name: tool.name,
				model: tool.model,
				ncm: tool.ncm,
				cest: tool.cest,
				manufacturerName: tool.manufacturerName,
				weightKg: tool.weightKg,
				lengthCm: tool.lengthCm,
				widthCm: tool.widthCm,
				heightCm: tool.heightCm,
			})
			.from(tool)
			.where(inArray(tool.id, toolIds)),
		fetchDiscountPctByToolId(toolIds, new Date()),
	]);

	if (variantRows.length !== variantIds.length) {
		return { ok: false, error: "Variante inválida no carrinho" };
	}

	const toolById = new Map(toolRows.map((t) => [t.id, t]));
	const variantById = new Map(variantRows.map((v) => [v.id, v]));

	const lines: PreparedLine[] = [];
	for (const cartItem of input.cartItems) {
		const variant = variantById.get(cartItem.variantId);
		const toolRow = toolById.get(cartItem.toolId);
		if (!(variant && toolRow) || variant.toolId !== cartItem.toolId) {
			return { ok: false, error: "Inconsistência cart/DB" };
		}
		const pct = discountPctByToolId.get(cartItem.toolId) ?? 0;
		const basePriceCents = centsFromString(variant.priceAmount);
		const finalPriceCents =
			pct > 0 ? Math.round(basePriceCents * (1 - pct / 100)) : basePriceCents;
		const submittedCents = centsFromString(cartItem.priceAmount);
		if (Math.abs(submittedCents - finalPriceCents) > PRICE_TOLERANCE_CENTS) {
			return { ok: false, error: "Preços atualizados, refaça o checkout" };
		}
		lines.push({
			cartItem,
			variant,
			tool: toolRow,
			finalPriceCents,
			lineTotalCents: finalPriceCents * cartItem.quantity,
		});
	}

	return { ok: true, lines };
}

async function checkStock(
	lines: PreparedLine[],
	branchId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const stockRows = await db
		.select()
		.from(stockLevel)
		.where(
			and(
				eq(stockLevel.branchId, branchId),
				inArray(
					stockLevel.variantId,
					lines.map((l) => l.variant.id)
				)
			)
		);
	const stockByVariant = new Map(
		stockRows.map((s) => [s.variantId, s.quantity])
	);
	for (const line of lines) {
		const available = stockByVariant.get(line.variant.id) ?? 0;
		if (available < line.cartItem.quantity) {
			return { ok: false, error: `Sem estoque para ${line.tool.name}` };
		}
	}
	return { ok: true };
}

export async function createOrderAction(
	rawInput: CreateOrderInput
): Promise<CreateOrderResult> {
	const parsed = inputSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	const input = parsed.data;

	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const branchId = env.ECOMMERCE_DEFAULT_BRANCH_ID;

	const prep = await prepareLines(input);
	if (!prep.ok) {
		return prep;
	}
	const { lines } = prep;

	const stock = await checkStock(lines, branchId);
	if (!stock.ok) {
		return stock;
	}

	const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
	const shippingCents = centsFromString(input.shippingAmount);
	const totalCents = subtotalCents + shippingCents;

	const reqHeaders = await headers();
	const ipAddress =
		reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
	const userAgent = reqHeaders.get("user-agent") ?? null;

	try {
		const result = await db.transaction(async (tx) => {
			await tx
				.update(client)
				.set({
					name: input.name,
					phone: input.phone,
					document: input.document,
				})
				.where(eq(client.id, clientId));

			const { snapshot } = await buildAddressSnapshot({
				clientId,
				addressId: input.addressId,
				newAddress: input.newAddress,
				recipient: input.name,
				tx: tx as unknown as typeof db,
			});

			const consentVersion = "1.0";
			const consentRows = [
				{ kind: "tos" as const, granted: true },
				{ kind: "privacy" as const, granted: true },
				{
					kind: "marketing_email" as const,
					granted: input.acceptMarketing,
				},
			];
			await tx.insert(consentLog).values(
				consentRows.map((c) => ({
					id: crypto.randomUUID(),
					actorType: "client" as const,
					clientId,
					kind: c.kind,
					granted: c.granted,
					version: consentVersion,
					ipAddress,
					userAgent,
				}))
			);

			const seqRow = await tx.execute(
				sql`SELECT nextval('order_number_seq')::int AS seq`
			);
			const seq = Number(
				(seqRow as unknown as { rows: Array<{ seq: number }> }).rows[0]?.seq ??
					(seqRow as unknown as Array<{ seq: number }>)[0]?.seq
			);
			if (!Number.isFinite(seq)) {
				throw new Error("Falha ao gerar número do pedido");
			}
			const orderNumber = formatOrderNumber(seq);

			const orderId = crypto.randomUUID();
			const subtotalAmount = (subtotalCents / 100).toFixed(2);
			const totalAmount = (totalCents / 100).toFixed(2);

			await tx.insert(order).values({
				id: orderId,
				number: orderNumber,
				clientId,
				branchId,
				status: "pending_payment",
				paymentStatus: "pending",
				subtotalAmount,
				discountAmount: "0",
				shippingAmount: input.shippingAmount,
				totalAmount,
				shippingAddress: snapshot,
			});

			for (const line of lines) {
				const orderItemId = crypto.randomUUID();
				const unitPrice = (line.finalPriceCents / 100).toFixed(2);
				const lineTotal = (line.lineTotalCents / 100).toFixed(2);

				await tx.insert(orderItem).values({
					id: orderItemId,
					orderId,
					toolId: line.tool.id,
					variantId: line.variant.id,
					sku: line.variant.sku,
					name: line.tool.name,
					model: line.tool.model,
					voltage: line.variant.voltage,
					unitPrice,
					quantity: line.cartItem.quantity,
					lineTotal,
					discountAmount: "0",
					cost: line.variant.costAmount ?? null,
					ncm: line.tool.ncm,
					cest: line.tool.cest,
					manufacturerName: line.tool.manufacturerName,
					weightKg: line.tool.weightKg,
					lengthCm: line.tool.lengthCm,
					widthCm: line.tool.widthCm,
					heightCm: line.tool.heightCm,
				});

				const updated = await tx
					.update(stockLevel)
					.set({
						quantity: sql`${stockLevel.quantity} - ${line.cartItem.quantity}`,
					})
					.where(
						and(
							eq(stockLevel.variantId, line.variant.id),
							eq(stockLevel.branchId, branchId),
							gte(stockLevel.quantity, line.cartItem.quantity)
						)
					)
					.returning({
						quantity: stockLevel.quantity,
					});
				const after = updated[0];
				if (!after) {
					throw new Error(`Stock insuficiente para ${line.tool.name}`);
				}
				const previousQty = after.quantity + line.cartItem.quantity;

				await tx.insert(stockMovement).values({
					id: crypto.randomUUID(),
					variantId: line.variant.id,
					branchId,
					previousQty,
					newQty: after.quantity,
					delta: -line.cartItem.quantity,
					reason: "saida_venda",
					orderId,
					orderItemId,
					actorType: "system",
				});
			}

			return { orderId, orderNumber };
		});

		return { ok: true, ...result };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "create_order_failed",
			clientId,
			branchId,
			totalCents,
			lineCount: lines.length,
			error: message,
		});
		return { ok: false, error: message };
	}
}
