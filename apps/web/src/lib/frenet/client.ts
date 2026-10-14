import { env } from "@emach/env/server";
import { z } from "zod";

import type {
	FrenetAddressResponse,
	FrenetQuoteRequest,
	FrenetQuoteResponse,
} from "./types";

const TIMEOUT_MS = 10_000;
const TRAILING_SLASH = /\/$/;

// Campo opcional da Frenet: ausente ou `null` viram `undefined`, para o tipo
// bater com os contratos de ./types.
const optionalString = z
	.string()
	.nullish()
	.transform((v) => v ?? undefined);

// Campo de serviço: string documentada, número aceito como string. Tipo
// inesperado vira `undefined` em vez de derrubar a cotação inteira.
const serviceString = z
	.union([z.string(), z.number()])
	.nullish()
	.transform((v) => (v == null ? undefined : String(v)))
	.catch(undefined);

// Formato real da resposta: chave com o typo oficial `ShippingSevicesArray`,
// preço e prazo como string, erro por serviço (`Error` boolean ou "true").
// O erro é por serviço: serviço malformado chega ao map.ts sem preço e é
// descartado lá (contado em `discardedByParse`), sem custar os demais. Só a
// casca (corpo não-objeto, array que não é array) vira FrenetError.
// `Timeout` fica de fora: ninguém o lê.
const frenetServiceSchema = z.object({
	Carrier: serviceString,
	CarrierCode: serviceString,
	DeliveryTime: serviceString,
	Error: z
		.union([z.boolean(), z.string()])
		.nullish()
		.transform((v) => v ?? undefined)
		.catch(undefined),
	Msg: serviceString,
	ServiceCode: serviceString,
	ServiceDescription: serviceString,
	ShippingPrice: serviceString,
});

const frenetQuoteResponseSchema = z.object({
	ShippingSevicesArray: z
		.array(
			// Item que nem é objeto vira serviço vazio, descartado no map.ts.
			frenetServiceSchema.catch(() => frenetServiceSchema.parse({}))
		)
		.nullish()
		.transform((v) => v ?? undefined),
}) satisfies z.ZodType<FrenetQuoteResponse>;

const frenetAddressResponseSchema = z.object({
	CEP: optionalString,
	City: optionalString,
	District: optionalString,
	Message: optionalString,
	Street: optionalString,
	UF: optionalString,
}) satisfies z.ZodType<FrenetAddressResponse>;

/** Erro do client Frenet — timeout, HTTP não-2xx ou body inválido. */
export class FrenetError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FrenetError";
	}
}

// Timeout + tratamento de erro compartilhados entre os endpoints Frenet.
async function frenetRequest<T>(
	path: string,
	schema: z.ZodType<T>,
	init?: RequestInit
): Promise<T> {
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

		const parsed = schema.safeParse(await res.json());

		if (!parsed.success) {
			throw new FrenetError(
				`Frenet respondeu fora do formato em ${path}: ${z.prettifyError(parsed.error)}`
			);
		}

		return parsed.data;
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
	return frenetRequest("/shipping/quote", frenetQuoteResponseSchema, {
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
	return frenetRequest(`/CEP/Address/${cep}`, frenetAddressResponseSchema);
}
