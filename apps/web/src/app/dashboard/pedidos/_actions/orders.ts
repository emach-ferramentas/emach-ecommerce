"use server";

import { db } from "@emach/db";
import { order, orderStatusHistory } from "@emach/db/schema/orders";
import { promotion } from "@emach/db/schema/promotions";
import type { Voltage } from "@emach/db/schema/tools";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { log } from "@/lib/evlog";
import { getRebuyItems } from "@/lib/orders/rebuy-query";
import { requireCurrentClient } from "@/lib/session";

export type ActionResult<T = undefined> =
	| { ok: true; data: T }
	| { ok: false; error: string };

const CANCELABLE = new Set(["pending_payment", "payment_failed"]);

const orderIdSchema = z.object({ orderId: z.string().min(1) });

export async function cancelOrderAction(raw: {
	orderId: string;
}): Promise<ActionResult> {
	const parsed = orderIdSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "ID inválido" };
	}
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { orderId } = parsed.data;

	try {
		const result = await db.transaction(async (tx) => {
			const [row] = await tx
				.select({
					id: order.id,
					status: order.status,
					couponId: order.couponId,
				})
				.from(order)
				.where(and(eq(order.id, orderId), eq(order.clientId, clientId)))
				.limit(1);
			if (!row) {
				return { ok: false as const, error: "Pedido não encontrado" };
			}
			if (!CANCELABLE.has(row.status)) {
				return {
					ok: false as const,
					error: "Este pedido não pode mais ser cancelado",
				};
			}

			// Status lido no WHERE: se o staff (ou o webhook de pagamento) mudou o
			// pedido depois do SELECT, o UPDATE não pega linha nenhuma.
			const updated = await tx
				.update(order)
				.set({ status: "canceled", canceledAt: new Date() })
				.where(and(eq(order.id, orderId), eq(order.status, row.status)))
				.returning({ id: order.id });
			if (updated.length === 0) {
				return {
					ok: false as const,
					error: "O status do pedido mudou. Atualize a página.",
				};
			}

			// O uso do cupom é contado na criação do pedido (place-order); cancelar
			// devolve esse uso.
			if (row.couponId) {
				await tx
					.update(promotion)
					.set({
						redemptionCount: sql`GREATEST(${promotion.redemptionCount} - 1, 0)`,
					})
					.where(eq(promotion.id, row.couponId));
			}

			await tx.insert(orderStatusHistory).values({
				id: crypto.randomUUID(),
				orderId,
				fromStatus: row.status,
				toStatus: "canceled",
				actorType: "system",
				actorUserId: null,
				reason: "Cancelado pelo cliente",
			});

			return { ok: true as const, data: undefined };
		});

		if (result.ok) {
			revalidatePath("/dashboard/pedidos");
			revalidatePath(`/dashboard/pedidos/${orderId}`);
		}
		return result;
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "cancel_order_failed",
			clientId,
			orderId,
			error: message,
		});
		return { ok: false, error: "Não foi possível cancelar o pedido" };
	}
}

export interface RebuySnapshot {
	categoryName: string | null;
	categorySlug: string | null;
	imageUrl: string | null;
	name: string;
	priceAmount: string;
	quantity: number;
	sku: string;
	slug: string;
	toolId: string;
	variantId: string;
	voltage: Voltage | null;
}

export async function rebuyAction(raw: {
	orderId: string;
}): Promise<ActionResult<{ items: RebuySnapshot[]; skipped: number }>> {
	const parsed = orderIdSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "ID inválido" };
	}
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { orderId } = parsed.data;

	try {
		const rows = await getRebuyItems(clientId, orderId);
		if (rows === null) {
			return { ok: false, error: "Pedido não encontrado" };
		}
		const available = rows.filter((r) => r.available);
		const items: RebuySnapshot[] = available.map((r) => ({
			toolId: r.toolId,
			variantId: r.variantId,
			slug: r.slug,
			name: r.name,
			sku: r.sku,
			voltage: r.voltage,
			priceAmount: r.priceAmount,
			imageUrl: r.imageUrl,
			categoryName: r.categoryName,
			categorySlug: r.categorySlug,
			quantity: r.quantity,
		}));
		if (items.length === 0) {
			return { ok: false, error: "Nenhum item disponível para recompra" };
		}
		return { ok: true, data: { items, skipped: rows.length - items.length } };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({ action: "rebuy_failed", clientId, orderId, error: message });
		return { ok: false, error: "Não foi possível montar a recompra" };
	}
}
