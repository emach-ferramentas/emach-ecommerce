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

// `reason` distingue o definitivo do transitório: "not_found" = a Frenet
// respondeu e o CEP não existe na base (a UI avisa o cliente — CEP digitado
// errado passa batido por todo o resto da pipeline, a Frenet cota preço real
// até pra CEP inexistente); "unavailable" = infra/rate-limit, não é culpa do
// CEP e a UI não deve alarmar.
export type LookupCepResult =
	| { ok: true; data: CepAddress }
	| { ok: false; reason: "not_found" | "unavailable" };

// Autofill de endereço via Frenet GET /CEP/Address (#191). Progressive
// enhancement: falha nunca lança — a UI preenche o que vier e o cliente digita
// à mão. O token Frenet nunca vai ao browser; o lookup é sempre server-side.
export async function lookupCepAction(
	rawCep: string
): Promise<LookupCepResult> {
	const parsed = cepSchema.safeParse(rawCep);
	if (!parsed.success) {
		return { ok: false, reason: "not_found" };
	}

	// Mesmo padrão do quote-shipping/search: rate limit por IP confiável;
	// sem IP (dev/edge sem proxy) → fail-open + log, evitando bucket "anon"
	// compartilhado que causaria DoS mútuo.
	const ip = getClientIp(await headers());
	if (ip) {
		const { success } = await cepLimiter.limit(`cep:${ip}`);
		if (!success) {
			return { ok: false, reason: "unavailable" };
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
			return { ok: false, reason: "not_found" };
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
		return { ok: false, reason: "unavailable" };
	}
}
