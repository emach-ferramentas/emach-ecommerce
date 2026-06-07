import { env } from "@emach/env/server";

import type { SuperFreteServiceRaw } from "./types";

const QUOTE_PATH = "/api/v0/calculator";
const TIMEOUT_MS = 8000;

export class SuperFreteError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SuperFreteError";
	}
}

export interface SuperFreteQuoteBody {
	from: { postal_code: string };
	options: {
		insurance_value: number;
		use_insurance_value: boolean;
	};
	products: Array<{
		height: number;
		width: number;
		length: number;
		weight: number;
		quantity: number;
	}>;
	services: string;
	to: { postal_code: string };
}

export async function fetchSuperFreteQuote(
	body: SuperFreteQuoteBody
): Promise<SuperFreteServiceRaw[]> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(`${env.SUPERFRETE_BASE_URL}${QUOTE_PATH}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.SUPERFRETE_TOKEN}`,
				"User-Agent": env.SUPERFRETE_USER_AGENT,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		const data: unknown = await res.json().catch(() => null);
		if (!res.ok) {
			// 400 = o SuperFrete entendeu a requisição mas o pacote/rota não rende
			// frete: sem transportadora (`freight.calculator.no_result`), peso/dimensão
			// acima do limite (`correios.weight`/`correios.dimensions`), ou CEP sem
			// cobertura. É ausência de opções (negócio), não falha técnica → [].
			// 401/403/5xx/timeout continuam virando SuperFreteError.
			if (res.status === 400) {
				return [];
			}
			throw new SuperFreteError(`SuperFrete respondeu ${res.status}`);
		}
		return data as SuperFreteServiceRaw[];
	} catch (err) {
		if (err instanceof SuperFreteError) {
			throw err;
		}
		throw new SuperFreteError(
			err instanceof Error ? err.message : "Falha na cotação"
		);
	} finally {
		clearTimeout(timer);
	}
}
