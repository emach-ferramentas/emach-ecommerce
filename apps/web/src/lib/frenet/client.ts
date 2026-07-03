import { env } from "@emach/env/server";

import type { FrenetQuoteRequest, FrenetQuoteResponse } from "./types";

const TIMEOUT_MS = 10_000;

/** Erro do client Frenet — timeout, HTTP não-2xx ou body inválido. */
export class FrenetError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FrenetError";
	}
}

// Sem retry automático (v1): o fail-open do assertShippingQuoted cobre o
// server-side e a UI do checkout tem retry manual (quoteNonce).
export async function fetchFrenetQuote(
	body: FrenetQuoteRequest
): Promise<FrenetQuoteResponse> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(
			`${env.FRENET_BASE_URL.replace(/\/$/, "")}/shipping/quote`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					token: env.FRENET_TOKEN,
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			}
		);
		if (!res.ok) {
			throw new FrenetError(`Frenet respondeu HTTP ${res.status}`);
		}
		return (await res.json()) as FrenetQuoteResponse;
	} catch (err) {
		if (err instanceof FrenetError) {
			throw err;
		}
		throw new FrenetError(
			err instanceof Error ? err.message : "falha na chamada à Frenet"
		);
	} finally {
		clearTimeout(timer);
	}
}
