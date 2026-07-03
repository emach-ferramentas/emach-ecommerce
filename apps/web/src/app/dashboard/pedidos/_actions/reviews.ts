"use server";

import { db } from "@emach/db";
import { canCreateReview } from "@emach/db/queries/reviews";
import { review } from "@emach/db/schema/reviews";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/types";
import { log } from "@/lib/evlog";
import { requireCurrentClient } from "@/lib/session";

const schema = z.object({
	orderId: z.string().min(1),
	toolId: z.string().min(1),
	rating: z.number().int().min(1).max(5),
	title: z.string().trim().max(120).optional(),
	body: z.string().trim().min(3, "Escreva sua avaliação").max(2000),
});

const REASON_MESSAGE: Record<string, string> = {
	order_not_found: "Pedido não encontrado",
	order_not_owned_by_client: "Pedido não encontrado",
	not_paid: "Só é possível avaliar pedidos pagos",
	window_expired: "O prazo de avaliação (90 dias) expirou",
	tool_not_in_order: "Produto não está neste pedido",
	already_reviewed: "Você já avaliou este produto",
};

export async function createReviewAction(raw: {
	orderId: string;
	toolId: string;
	rating: number;
	title?: string;
	body: string;
}): Promise<ActionResult> {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { orderId, toolId, rating, title, body } = parsed.data;

	try {
		const can = await canCreateReview(db, { clientId, orderId, toolId });
		if (!can.ok) {
			return {
				ok: false,
				error: REASON_MESSAGE[can.reason] ?? "Não permitido",
			};
		}
		await db.insert(review).values({
			id: crypto.randomUUID(),
			toolId,
			clientId,
			orderId,
			rating,
			title: title || null,
			body,
			status: "pending",
		});
		revalidatePath(`/dashboard/pedidos/${orderId}`);
		return { ok: true };
	} catch (err) {
		// Race de duplo-submit: o unique (toolId,clientId,orderId) é o backstop
		// quando duas requisições passam por canCreateReview ao mesmo tempo.
		const code = (err as { cause?: { code?: string } })?.cause?.code;
		if (code === "23505") {
			return { ok: false, error: "Você já avaliou este produto" };
		}
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "create_review_failed",
			clientId,
			orderId,
			toolId,
			error: message,
		});
		return { ok: false, error: "Não foi possível enviar a avaliação" };
	}
}
