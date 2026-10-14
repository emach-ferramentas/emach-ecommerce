import { db } from "@emach/db";
import type {
	OrderStatus,
	RefundReason,
	RefundStatus,
} from "@emach/db/schema/orders";
import { order, orderItem, refundRequest } from "@emach/db/schema/orders";
import { and, desc, eq, inArray } from "drizzle-orm";

import { primaryImageByToolId } from "@/lib/tool-images";

import { isActiveRefund } from "./status";

export interface RefundPreviewItem {
	id: string;
	imageUrl: string | null;
	name: string;
	quantity: number;
	unitPrice: string;
	voltage: string | null;
}

export interface RefundListItem {
	amount: string;
	id: string;
	orderId: string;
	orderNumber: string;
	preview: RefundPreviewItem[];
	reasonCategory: RefundReason;
	reasonText: string | null;
	rejectionReason: string | null;
	requestedAt: Date;
	resolvedAt: Date | null;
	status: RefundStatus;
}

export type RefundRequestRow = typeof refundRequest.$inferSelect;

/** Pedido elegível a devolução: enviado ou entregue. */
export function isRefundEligibleStatus(status: OrderStatus): boolean {
	return status === "shipped" || status === "delivered";
}

/** Devoluções do cliente, mais recentes primeiro, com preview dos itens do pedido. */
export async function listClientRefunds(
	clientId: string
): Promise<RefundListItem[]> {
	const refunds = await db
		.select({
			id: refundRequest.id,
			orderId: refundRequest.orderId,
			orderNumber: order.number,
			status: refundRequest.status,
			reasonCategory: refundRequest.reasonCategory,
			reasonText: refundRequest.reasonText,
			rejectionReason: refundRequest.rejectionReason,
			amount: refundRequest.amount,
			requestedAt: refundRequest.requestedAt,
			resolvedAt: refundRequest.resolvedAt,
		})
		.from(refundRequest)
		.innerJoin(order, eq(order.id, refundRequest.orderId))
		.where(eq(refundRequest.clientId, clientId))
		.orderBy(desc(refundRequest.requestedAt));

	if (refunds.length === 0) {
		return [];
	}

	const orderIds = Array.from(new Set(refunds.map((r) => r.orderId)));

	// Devolução é sempre do pedido inteiro (sem itens parciais — ver spec),
	// então o preview = todos os itens do pedido. Set dedup: um pedido pode ter
	// mais de uma devolução no histórico (ex.: uma recusada + uma nova).
	const items = await db
		.select({
			id: orderItem.id,
			orderId: orderItem.orderId,
			toolId: orderItem.toolId,
			name: orderItem.name,
			voltage: orderItem.voltage,
			quantity: orderItem.quantity,
			unitPrice: orderItem.unitPrice,
		})
		.from(orderItem)
		.where(inArray(orderItem.orderId, orderIds));

	const imageByTool = await primaryImageByToolId(
		db,
		Array.from(new Set(items.map((i) => i.toolId)))
	);

	const itemsByOrder = new Map<string, typeof items>();

	for (const it of items) {
		const arr = itemsByOrder.get(it.orderId) ?? [];
		arr.push(it);
		itemsByOrder.set(it.orderId, arr);
	}

	return refunds.map((r) => ({
		id: r.id,
		orderId: r.orderId,
		orderNumber: r.orderNumber,
		status: r.status,
		reasonCategory: r.reasonCategory,
		reasonText: r.reasonText,
		rejectionReason: r.rejectionReason,
		amount: r.amount,
		requestedAt: r.requestedAt,
		resolvedAt: r.resolvedAt,
		preview: (itemsByOrder.get(r.orderId) ?? []).map((i) => ({
			id: i.id,
			name: i.name,
			voltage: i.voltage,
			quantity: i.quantity,
			unitPrice: i.unitPrice,
			imageUrl: imageByTool.get(i.toolId) ?? null,
		})),
	}));
}

/**
 * Devolução de um pedido do cliente (a mais recente), ou `null`. Usada no
 * detalhe pra mostrar o bloco de status e decidir a visibilidade do botão.
 */
export async function getRefundForOrder(
	clientId: string,
	orderId: string
): Promise<RefundRequestRow | null> {
	const [row] = await db
		.select()
		.from(refundRequest)
		.where(
			and(
				eq(refundRequest.orderId, orderId),
				eq(refundRequest.clientId, clientId)
			)
		)
		.orderBy(desc(refundRequest.requestedAt))
		.limit(1);

	return row ?? null;
}

export function hasActiveRefund(refund: RefundRequestRow | null): boolean {
	return refund !== null && isActiveRefund(refund.status);
}
