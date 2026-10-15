"use server";

import { db } from "@emach/db";
import { z } from "zod";

import {
	computeFinalPrices,
	type RevalidatedPrice,
} from "@/app/checkout/_lib/compute-final-prices";
import { log } from "@/lib/evlog";
import { requireCurrentClient } from "@/lib/session";

const schema = z.object({
	cartItems: z
		.array(
			z.object({
				toolId: z.string().min(1),
				variantId: z.string().min(1),
			})
		)
		.min(1),
});

export type RevalidateCartResult =
	// `unavailable`: variantIds sem preço na resposta (removidas, ocultas ou sem
	// preço) — o checkout tira do carrinho e avisa, em vez de travar no submit.
	| { ok: true; prices: RevalidatedPrice[]; unavailable: string[] }
	| { ok: false; error: string };

export async function revalidateCartAction(
	raw: z.infer<typeof schema>
): Promise<RevalidateCartResult> {
	const parsed = schema.safeParse(raw);

	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}

	await requireCurrentClient();

	try {
		const prices = await computeFinalPrices(db, parsed.data.cartItems);
		const priced = new Set(prices.map((p) => p.variantId));

		const unavailable = parsed.data.cartItems
			.filter((i) => !priced.has(i.variantId))
			.map((i) => i.variantId);

		return { ok: true, prices, unavailable };
	} catch (err) {
		log.error({
			action: "revalidate_cart_failed",
			error: err instanceof Error ? err.message : "erro inesperado",
		});

		return { ok: false, error: "Não foi possível atualizar os preços" };
	}
}
