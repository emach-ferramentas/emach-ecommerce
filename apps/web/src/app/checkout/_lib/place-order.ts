import type { db } from "@emach/db";
import { client, clientAddress } from "@emach/db/schema/client";
import { consentLog } from "@emach/db/schema/consent-log";
import { stockLevel } from "@emach/db/schema/inventory";
import { order, orderItem } from "@emach/db/schema/orders";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { tool, toolVariant } from "@emach/db/schema/tools";
import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { addressFieldsSchema } from "@/lib/validators/address";
import { isValidCpfCnpj } from "@/lib/validators/cpf-cnpj";

const PRICE_TOLERANCE_CENTS = 1;

const newAddressSchema = addressFieldsSchema;

/**
 * Erro de negócio do checkout cuja `message` é segura para exibir ao
 * cliente. Tudo que não for `OrderError` é tratado como falha inesperada
 * de infraestrutura e nunca deve ter a mensagem repassada ao navegador.
 */
export class OrderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OrderError";
	}
}

const PG_UNIQUE_VIOLATION = "23505";

/** Detecta a violação de unicidade de `client.document` (DrizzleQueryError → cause pg). */
function isDocumentUniqueViolation(err: unknown): boolean {
	const cause = (err as { cause?: { code?: string; constraint?: string } })
		?.cause;
	return (
		cause?.code === PG_UNIQUE_VIOLATION &&
		cause?.constraint === "client_document_unique"
	);
}

export const inputSchema = z.object({
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

export function centsFromString(amount: string): number {
	return Math.round(Number(amount) * 100);
}

export function formatOrderNumber(seq: number): string {
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
			throw new OrderError("Endereço não encontrado");
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
		throw new OrderError("Endereço não fornecido");
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
	tx: typeof db,
	toolIds: string[],
	now: Date
): Promise<Map<string, number>> {
	const promoRows = await tx
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
	tx: typeof db,
	input: CreateOrderInput
): Promise<PreparedLine[]> {
	const variantIds = input.cartItems.map((i) => i.variantId);
	const toolIds = Array.from(new Set(input.cartItems.map((i) => i.toolId)));

	const [variantRows, toolRows, discountPctByToolId] = await Promise.all([
		tx
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
		tx
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
		fetchDiscountPctByToolId(tx, toolIds, new Date()),
	]);

	if (variantRows.length !== variantIds.length) {
		throw new OrderError("Variante inválida no carrinho");
	}

	const toolById = new Map(toolRows.map((t) => [t.id, t]));
	const variantById = new Map(variantRows.map((v) => [v.id, v]));

	const lines: PreparedLine[] = [];
	for (const cartItem of input.cartItems) {
		const variant = variantById.get(cartItem.variantId);
		const toolRow = toolById.get(cartItem.toolId);
		if (!(variant && toolRow) || variant.toolId !== cartItem.toolId) {
			throw new OrderError("Inconsistência cart/DB");
		}
		const pct = discountPctByToolId.get(cartItem.toolId) ?? 0;
		const basePriceCents = centsFromString(variant.priceAmount);
		const finalPriceCents =
			pct > 0 ? Math.round(basePriceCents * (1 - pct / 100)) : basePriceCents;
		const submittedCents = centsFromString(cartItem.priceAmount);
		if (Math.abs(submittedCents - finalPriceCents) > PRICE_TOLERANCE_CENTS) {
			throw new OrderError("Preços atualizados, refaça o checkout");
		}
		lines.push({
			cartItem,
			variant,
			tool: toolRow,
			finalPriceCents,
			lineTotalCents: finalPriceCents * cartItem.quantity,
		});
	}

	return lines;
}

async function checkAggregateStock(
	tx: typeof db,
	lines: PreparedLine[]
): Promise<void> {
	const variantIds = lines.map((l) => l.variant.id);
	const rows = await tx
		.select({
			variantId: stockLevel.variantId,
			total: sql<number>`COALESCE(SUM(${stockLevel.quantity}), 0)::int`,
		})
		.from(stockLevel)
		.where(inArray(stockLevel.variantId, variantIds))
		.groupBy(stockLevel.variantId);

	const totalByVariant = new Map(rows.map((r) => [r.variantId, r.total]));
	for (const line of lines) {
		const total = totalByVariant.get(line.variant.id) ?? 0;
		if (total < line.cartItem.quantity) {
			throw new OrderError(`Sem estoque para ${line.tool.name}`);
		}
	}
}

export async function placeOrder(
	tx: typeof db,
	params: {
		clientId: string;
		input: CreateOrderInput;
		ipAddress: string | null;
		userAgent: string | null;
	}
): Promise<{ orderId: string; orderNumber: string }> {
	const { clientId, input, ipAddress, userAgent } = params;

	const lines = await prepareLines(tx, input);
	await checkAggregateStock(tx, lines);

	const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
	const shippingCents = centsFromString(input.shippingAmount);
	const totalCents = subtotalCents + shippingCents;

	try {
		await tx
			.update(client)
			.set({
				name: input.name,
				phone: input.phone,
				document: input.document,
			})
			.where(eq(client.id, clientId));
	} catch (err) {
		if (isDocumentUniqueViolation(err)) {
			throw new OrderError("Este CPF/CNPJ já está cadastrado em outra conta.");
		}
		throw err;
	}

	const { snapshot } = await buildAddressSnapshot({
		clientId,
		addressId: input.addressId,
		newAddress: input.newAddress,
		recipient: input.name,
		tx,
	});

	const consentVersion = "1.0";
	const consentRows = [
		{ kind: "tos" as const, granted: true },
		{ kind: "privacy" as const, granted: true },
		{ kind: "marketing_email" as const, granted: input.acceptMarketing },
	];
	await tx.insert(consentLog).values(
		consentRows.map((c) => ({
			id: crypto.randomUUID(),
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
		throw new OrderError("Falha ao gerar número do pedido");
	}
	const orderNumber = formatOrderNumber(seq);

	const orderId = crypto.randomUUID();
	const subtotalAmount = (subtotalCents / 100).toFixed(2);
	const totalAmount = (totalCents / 100).toFixed(2);

	await tx.insert(order).values({
		id: orderId,
		number: orderNumber,
		clientId,
		branchId: null,
		status: "pending_payment",
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
	}

	return { orderId, orderNumber };
}
