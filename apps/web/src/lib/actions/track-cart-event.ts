"use server";

import { db } from "@emach/db";
import { cartEvent } from "@emach/db/schema/cart-events";
import { headers } from "next/headers";
import { z } from "zod";

import { getClientIp } from "@/lib/client-ip";
import { log } from "@/lib/evlog";
import { cartEventLimiter } from "@/lib/rate-limit";
import { getCurrentClient } from "@/lib/session";

const schema = z.object({
	quantity: z.number().int().min(1).max(999),
	sessionId: z.string().min(1).max(64),
	toolId: z.string().min(1),
	variantId: z.string().min(1),
});

export type TrackCartEventInput = z.infer<typeof schema>;

/**
 * Métrica de demanda pro admin (issue #175): 1 linha em `cart_event` por
 * clique de "adicionar ao carrinho". Fire-and-forget por contrato
 * (docs/integration/admin-ecommerce.md do dashboard): falha aqui JAMAIS
 * quebra o carrinho — sem retry, sem fila, só log. INSERT-only; o expurgo
 * (>180d) é cron do dashboard.
 */
export async function trackCartEventAction(
	raw: TrackCartEventInput
): Promise<void> {
	try {
		const parsed = schema.safeParse(raw);
		if (!parsed.success) {
			log.warn({ action: "cart_event_invalid_input" });
			return;
		}
		const ip = getClientIp(await headers());
		if (ip) {
			const { success } = await cartEventLimiter.limit(`cart-event:${ip}`);
			if (!success) {
				return;
			}
		}
		const session = await getCurrentClient();
		await db.insert(cartEvent).values({
			id: crypto.randomUUID(),
			toolId: parsed.data.toolId,
			variantId: parsed.data.variantId,
			clientId: session?.user.id ?? null,
			sessionId: parsed.data.sessionId,
			quantity: parsed.data.quantity,
		});
	} catch (err) {
		log.error({
			action: "cart_event_insert_failed",
			error: err instanceof Error ? err.message : "erro inesperado",
			toolId: raw?.toolId,
		});
	}
}
