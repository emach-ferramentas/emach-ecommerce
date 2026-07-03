"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getClientIp } from "@/lib/client-ip";
import { log } from "@/lib/evlog";
import { fetchFrenetAddress } from "@/lib/frenet/client";
import { cepLimiter } from "@/lib/rate-limit";

const cepSchema = z
	.string()
	.transform((v) => v.replace(/\D/g, ""))
	.refine((v) => v.length === 8, "CEP inválido");

export interface CepAddress {
	city: string;
	neighborhood: string;
	state: string;
	street: string;
}

export type LookupCepResult =
	| { ok: true; data: CepAddress }
	| { ok: false; error: string };

const LOOKUP_FAILED = "CEP não encontrado";

// Autofill de endereço via Frenet GET /CEP/Address (#191). Progressive
// enhancement: QUALQUER falha (input, rate limit, Frenet fora, CEP inexistente)
// vira { ok: false } silencioso — a UI ignora e o cliente digita à mão. O
// token Frenet nunca vai ao browser; o lookup é sempre server-side.
export async function lookupCepAction(
	rawCep: string
): Promise<LookupCepResult> {
	const parsed = cepSchema.safeParse(rawCep);
	if (!parsed.success) {
		return { ok: false, error: LOOKUP_FAILED };
	}

	// Mesmo padrão do quote-shipping/search: rate limit por IP confiável;
	// sem IP (dev/edge sem proxy) → fail-open + log, evitando bucket "anon"
	// compartilhado que causaria DoS mútuo.
	const ip = getClientIp(await headers());
	if (ip) {
		const { success } = await cepLimiter.limit(`cep:${ip}`);
		if (!success) {
			return { ok: false, error: LOOKUP_FAILED };
		}
	} else {
		log.warn({ action: "cep_rate_limit_skipped_no_ip" });
	}

	try {
		const address = await fetchFrenetAddress(parsed.data);
		// Sem City/UF = CEP inexistente na base (a Frenet devolve 200 com body
		// vazio + Message). Street/District podem faltar em CEP rural — a UI
		// preenche o que vier e o cliente completa.
		if (!(address.City && address.UF)) {
			return { ok: false, error: LOOKUP_FAILED };
		}
		return {
			ok: true,
			data: {
				street: address.Street ?? "",
				neighborhood: address.District ?? "",
				city: address.City,
				state: address.UF,
			},
		};
	} catch (err) {
		// Falha de infra não é erro do usuário: log e silêncio (sem toast).
		log.warn({
			action: "lookup_cep_failed",
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return { ok: false, error: LOOKUP_FAILED };
	}
}
