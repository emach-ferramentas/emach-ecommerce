import { env } from "@emach/env/server";

import type {
	FrenetAddressResponse,
	FrenetQuoteRequest,
	FrenetQuoteResponse,
} from "./types";

const TIMEOUT_MS = 10_000;
const TRAILING_SLASH = /\/$/;

/** Erro do client Frenet — timeout, HTTP não-2xx ou body inválido. */
export class FrenetError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FrenetError";
	}
}

// Timeout + tratamento de erro compartilhados entre os endpoints Frenet.
async function frenetRequest<T>(path: string, init?: RequestInit): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(
			`${env.FRENET_BASE_URL.replace(TRAILING_SLASH, "")}${path}`,
			{
				...init,
				headers: {
					Accept: "application/json",
					token: env.FRENET_TOKEN,
					...init?.headers,
				},
				signal: controller.signal,
			}
		);
		if (!res.ok) {
			throw new FrenetError(`Frenet respondeu HTTP ${res.status}`);
		}
		return (await res.json()) as T;
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

// Sem retry automático (v1): o fail-open do assertShippingQuoted cobre o
// server-side e a UI do checkout tem retry manual (quoteNonce).
export function fetchFrenetQuote(
	body: FrenetQuoteRequest
): Promise<FrenetQuoteResponse> {
	return frenetRequest<FrenetQuoteResponse>("/shipping/quote", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

// GET /CEP/Address/{cep} — autofill de endereço (#191). `cep` deve chegar
// normalizado (8 dígitos) — quem valida é a action.
export function fetchFrenetAddress(
	cep: string
): Promise<FrenetAddressResponse> {
	return frenetRequest<FrenetAddressResponse>(`/CEP/Address/${cep}`);
}
