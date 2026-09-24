import { db } from "@emach/db";
import type { OrderStatus } from "@emach/db/schema/orders";
import { order, orderItem, orderStatusHistory } from "@emach/db/schema/orders";
import { review } from "@emach/db/schema/reviews";
import { and, desc, eq, inArray } from "drizzle-orm";

import { primaryImageByToolId } from "@/lib/tool-images";

export interface OrderPreviewItem {
	id: string;
	imageUrl: string | null;
	name: string;
	quantity: number;
	unitPrice: string;
	voltage: string | null;
}

export interface OrderListItem {
	createdAt: Date;
	id: string;
	itemCount: number;
	number: string;
	preview: OrderPreviewItem[];
	shippingAmount: string;
	status: OrderStatus;
	subtotalAmount: string;
	totalAmount: string;
}

/**
 * Colunas de `orderItem` expostas ao cliente. Exclui campos
 * fiscais/dimensionais não exibidos — convenção "sem select *".
 */
const ORDER_ITEM_COLUMNS = {
	id: orderItem.id,
	orderId: orderItem.orderId,
	toolId: orderItem.toolId,
	variantId: orderItem.variantId,
	sku: orderItem.sku,
	name: orderItem.name,
	model: orderItem.model,
	voltage: orderItem.voltage,
	unitPrice: orderItem.unitPrice,
	quantity: orderItem.quantity,
	lineTotal: orderItem.lineTotal,
	discountAmount: orderItem.discountAmount,
	manufacturerName: orderItem.manufacturerName,
} as const;

export interface OrderItemRow {
	discountAmount: string;
	id: string;
	lineTotal: string;
	manufacturerName: string | null;
	model: string | null;
	name: string;
	orderId: string;
	quantity: number;
	sku: string | null;
	toolId: string;
	unitPrice: string;
	variantId: string;
	voltage: string | null;
}

/** Colunas de `order` que o detalhe do cliente exibe — sem nota interna, ref do gateway, filial nem flags de revisão do staff. */
const ORDER_DETAIL_COLUMNS = {
	id: order.id,
	number: order.number,
	status: order.status,
	createdAt: order.createdAt,
	canceledAt: order.canceledAt,
	refundedAt: order.refundedAt,
	returnedAt: order.returnedAt,
	couponId: order.couponId,
	subtotalAmount: order.subtotalAmount,
	discountAmount: order.discountAmount,
	shippingAmount: order.shippingAmount,
	totalAmount: order.totalAmount,
	paymentMethod: order.paymentMethod,
	paymentReceiptUrl: order.paymentReceiptUrl,
	shippingMethod: order.shippingMethod,
	shippingTrackingCode: order.shippingTrackingCode,
	shippingAddress: order.shippingAddress,
	nfeNumber: order.nfeNumber,
	nfeStatus: order.nfeStatus,
	nfeUrl: order.nfeUrl,
	nfeXmlUrl: order.nfeXmlUrl,
} as const;

/** Histórico exibido na timeline — sem o `actorUserId` do staff. */
const ORDER_HISTORY_COLUMNS = {
	id: orderStatusHistory.id,
	toStatus: orderStatusHistory.toStatus,
	reason: orderStatusHistory.reason,
	createdAt: orderStatusHistory.createdAt,
} as const;

type OrderDetailRow = {
	[K in keyof typeof ORDER_DETAIL_COLUMNS]: (typeof order.$inferSelect)[K];
};

export interface OrderHistoryEntry {
	createdAt: Date;
	id: string;
	reason: string | null;
	toStatus: OrderStatus;
}

export interface OrderDetailData {
	history: OrderHistoryEntry[];
	items: (OrderItemRow & { imageUrl: string | null })[];
	order: OrderDetailRow;
	reviewedToolIds: string[];
}

export async function listClientOrders(
	clientId: string
): Promise<OrderListItem[]> {
	const orders = await db
		.select({
			id: order.id,
			number: order.number,
			status: order.status,
			createdAt: order.createdAt,
			totalAmount: order.totalAmount,
			subtotalAmount: order.subtotalAmount,
			shippingAmount: order.shippingAmount,
		})
		.from(order)
		.where(eq(order.clientId, clientId))
		.orderBy(desc(order.createdAt));

	if (orders.length === 0) {
		return [];
	}

	const orderIds = orders.map((o) => o.id);
	const items = await db
		.select(ORDER_ITEM_COLUMNS)
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

	return orders.map((o) => {
		const its = itemsByOrder.get(o.id) ?? [];
		return {
			id: o.id,
			number: o.number,
			status: o.status,
			createdAt: o.createdAt,
			totalAmount: o.totalAmount,
			subtotalAmount: o.subtotalAmount,
			shippingAmount: o.shippingAmount,
			itemCount: its.reduce((s, i) => s + i.quantity, 0),
			preview: its.map((i) => ({
				id: i.id,
				name: i.name,
				voltage: i.voltage,
				quantity: i.quantity,
				unitPrice: i.unitPrice,
				imageUrl: imageByTool.get(i.toolId) ?? null,
			})),
		};
	});
}

export async function getClientOrderDetail(
	clientId: string,
	orderId: string
): Promise<OrderDetailData | null> {
	const [orderRow] = await db
		.select(ORDER_DETAIL_COLUMNS)
		.from(order)
		.where(and(eq(order.id, orderId), eq(order.clientId, clientId)))
		.limit(1);

	if (!orderRow) {
		return null;
	}

	const items = await db
		.select(ORDER_ITEM_COLUMNS)
		.from(orderItem)
		.where(eq(orderItem.orderId, orderId));

	const imageByTool = await primaryImageByToolId(
		db,
		Array.from(new Set(items.map((i) => i.toolId)))
	);

	const history = await db
		.select(ORDER_HISTORY_COLUMNS)
		.from(orderStatusHistory)
		.where(eq(orderStatusHistory.orderId, orderId))
		.orderBy(desc(orderStatusHistory.createdAt));

	const reviewed = await db
		.select({ toolId: review.toolId })
		.from(review)
		.where(and(eq(review.orderId, orderId), eq(review.clientId, clientId)));

	return {
		order: orderRow,
		items: items.map((i) => ({
			...i,
			imageUrl: imageByTool.get(i.toolId) ?? null,
		})),
		history,
		reviewedToolIds: reviewed.map((r) => r.toolId),
	};
}
