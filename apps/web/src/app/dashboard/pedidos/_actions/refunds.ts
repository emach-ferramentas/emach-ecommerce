"use server";

import { db } from "@emach/db";
import {
	ACTIVE_REFUND_STATUSES,
	order,
	refundRequest,
} from "@emach/db/schema/orders";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/types";
import { log } from "@/lib/evlog";
import { isRefundEligibleStatus } from "@/lib/refunds/queries";
import { requireCurrentClient } from "@/lib/session";

const schema = z.object({
	orderId: z.string().min(1),
	reasonCategory: z.enum([
		"defeito",
		"item_errado",
		"avaria_transporte",
		"arrependimento",
		"outro",
	]),
	reasonText: z.string().trim().max(2000).optional(),
});

export async function requestRefundAction(raw: {
	orderId: string;
	reasonCategory: string;
	reasonText?: string;
}): Promise<ActionResult> {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { orderId, reasonCategory, reasonText } = parsed.data;

	try {
		// Posse + elegibilidade num só fetch.
		const [orderRow] = await db
			.select({
				id: order.id,
				status: order.status,
				totalAmount: order.totalAmount,
			})
			.from(order)
			.where(and(eq(order.id, orderId), eq(order.clientId, clientId)))
			.limit(1);

		if (!orderRow) {
			return { ok: false, error: "Pedido não encontrado" };
		}
		if (!isRefundEligibleStatus(orderRow.status)) {
			return {
				ok: false,
				error: "Devolução disponível só para pedidos enviados ou entregues",
			};
		}

		// Já existe solicitação ATIVA (requested/under_review/approved)?
		const [active] = await db
			.select({ id: refundRequest.id })
			.from(refundRequest)
			.where(
				and(
					eq(refundRequest.orderId, orderId),
					eq(refundRequest.clientId, clientId),
					inArray(refundRequest.status, [...ACTIVE_REFUND_STATUSES])
				)
			)
			.limit(1);
		if (active) {
			return {
				ok: false,
				error: "Já existe uma solicitação de devolução aberta para este pedido",
			};
		}

		await db.insert(refundRequest).values({
			id: crypto.randomUUID(),
			orderId,
			clientId,
			reasonCategory,
			reasonText: reasonText || null,
			status: "requested",
			amount: orderRow.totalAmount,
			// Cliente não é staff `user` — solicitação parte do sistema.
			actorType: "system",
			actorUserId: null,
		});

		revalidatePath(`/dashboard/pedidos/${orderId}`);
		revalidatePath("/dashboard/reembolso");
		return { ok: true };
	} catch (err) {
		// Backstop de corrida: índice parcial único em (orderId) WHERE
		// status IN ('requested','under_review').
		const code = (err as { cause?: { code?: string } })?.cause?.code;
		if (code === "23505") {
			return {
				ok: false,
				error: "Já existe uma solicitação de devolução aberta para este pedido",
			};
		}
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "request_refund_failed",
			clientId,
			orderId,
			error: message,
		});
		return { ok: false, error: "Não foi possível solicitar a devolução" };
	}
}
