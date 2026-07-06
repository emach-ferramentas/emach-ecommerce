"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getClientIp } from "@/lib/client-ip";
import { log } from "@/lib/evlog";
import { RATE_LIMIT_MESSAGE, shippingLimiter } from "@/lib/rate-limit";
import { requireCurrentClient } from "@/lib/session";
import { quoteShipping } from "@/lib/shipping/quote";
import type { ShippingOption } from "@/lib/shipping/types";

const inputSchema = z.object({
	destinationCep: z
		.string()
		.transform((v) => v.replace(/\D/g, ""))
		.refine((v) => v.length === 8, "CEP inválido"),
	items: z
		.array(
			z.object({
				toolId: z.string().min(1),
				quantity: z.number().int().positive(),
			})
		)
		.min(1, "Carrinho vazio"),
	declaredValueCents: z.number().int().nonnegative().optional(),
});

export type QuoteShippingResult =
	| { ok: true; options: ShippingOption[]; negotiate: boolean }
	| { ok: false; error: string };

export async function quoteShippingAction(
	rawInput: unknown
): Promise<QuoteShippingResult> {
	// Único caller é o checkout (autenticado) — sessão obrigatória fecha o
	// endpoint contra anônimos gastando cota da API Frenet.
	await requireCurrentClient();

	const parsed = inputSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos para cotação" };
	}

	// Rate limit por IP como segunda camada. Sem IP (dev/edge sem proxy) →
	// fail-open + log: evita um bucket "anon" compartilhado que causaria DoS
	// mútuo entre usuários sem-IP. Em prod (Vercel) o IP sempre existe via
	// x-forwarded-for.
	const ip = getClientIp(await headers());
	if (ip) {
		const { success } = await shippingLimiter.limit(`shipping:${ip}`);
		if (!success) {
			return { ok: false, error: RATE_LIMIT_MESSAGE };
		}
	} else {
		log.warn({ action: "shipping_rate_limit_skipped_no_ip" });
	}

	try {
		const { options, negotiate } = await quoteShipping(parsed.data);
		return { ok: true, options, negotiate };
	} catch (err) {
		log.error({
			action: "quote_shipping_failed",
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return { ok: false, error: "Não foi possível calcular o frete." };
	}
}
