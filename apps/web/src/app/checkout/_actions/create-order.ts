"use server";

import { db } from "@emach/db";
import { headers } from "next/headers";

import { getClientIp } from "@/lib/client-ip";
import { log } from "@/lib/evlog";
import { numericToCents } from "@/lib/format";
import { orderLimiter, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { requireCurrentClient } from "@/lib/session";

import {
	assertShippingQuoted,
	type CreateOrderInput,
	type CreateOrderResult,
	cepKnownToFrenet,
	inputSchema,
	OrderError,
	placeOrder,
	prepareLines,
	resolveDestinationCep,
} from "../_lib/place-order";

const GENERIC_ORDER_ERROR =
	"Não foi possível concluir o pedido. Tente novamente.";

// Gate de verificação de e-mail (#93, opção B): só o checkout exige e-mail
// verificado — login e navegação seguem livres. Server actions não herdam
// layout, então o gate vai no topo da própria action (invariante do CLAUDE.md).
// Clientes via Google OAuth já chegam com emailVerified=true. A UI do checkout
// (banner + CTA reenviar) é só UX; este é o gate autoritativo.
const EMAIL_NOT_VERIFIED_ERROR =
	"Confirme seu e-mail antes de finalizar o pedido.";

export type { CreateOrderInput, CreateOrderResult } from "../_lib/place-order";

export async function createOrderAction(
	rawInput: CreateOrderInput
): Promise<CreateOrderResult> {
	const parsed = inputSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	const input = parsed.data;

	const session = await requireCurrentClient();
	const clientId = session.user.id;

	if (!session.user.emailVerified) {
		return { ok: false, error: EMAIL_NOT_VERIFIED_ERROR };
	}

	const { success } = await orderLimiter.limit(`order:${clientId}`);
	if (!success) {
		return { ok: false, error: RATE_LIMIT_MESSAGE };
	}

	const reqHeaders = await headers();
	const ipAddress = getClientIp(reqHeaders);
	const userAgent = reqHeaders.get("user-agent") ?? null;

	try {
		// Anti-fraude do frete roda FORA da transação (chamada externa não pode
		// segurar a transação aberta). Mismatch lança OrderError; API fora não
		// bloqueia, mas marca o pedido como `shippingUnverified` p/ revisão (#97).
		// Default `true` = "não verificado até prova em contrário": só vira false
		// quando assertShippingQuoted confirma o match. Assim, qualquer caminho que
		// chegue ao placeOrder sem revalidar o frete (ex.: destino sem CEP) fica
		// marcado p/ revisão, em vez de aceito às cegas (defesa em profundidade).
		let shippingUnverified = true;
		let shippingMethod: string | null = null;
		let shippingServiceCode: string | null = null;
		const destinationCep = await resolveDestinationCep(db, input, clientId);
		if (destinationCep) {
			// Valor declarado p/ o seguro de frete derivado dos preços VERIFICADOS
			// (prepareLines valida contra o DB e lança em mismatch) — o priceAmount
			// cru do cliente não entra: sob política 'cart_value', payload
			// subdeclarado reduziria o seguro. Custa 1 leitura extra fora da
			// transação; dentro dela o placeOrder re-executa como autoridade.
			const { lines } = await prepareLines(db, input);
			const declaredValueCents = lines.reduce(
				(sum, l) => sum + l.lineTotalCents,
				0
			);
			// Em paralelo com o anti-fraude: o CEP existe na base da Frenet? A
			// cotação cota preço real até pra CEP inexistente, então "preço bate"
			// não prova endereço entregável. not_found definitivo → pedido criado,
			// mas marcado p/ revisão staff (mesmo fluxo do fail-open #97, sem
			// bloquear venda — a base da Frenet pode atrasar CEPs novos).
			const [shippingCheck, cepKnown] = await Promise.all([
				assertShippingQuoted({
					shippingCents: numericToCents(input.shippingAmount),
					destinationCep,
					items: input.cartItems.map((i) => ({
						toolId: i.toolId,
						quantity: i.quantity,
					})),
					declaredValueCents,
					shippingServiceCode: input.shippingServiceCode,
				}),
				cepKnownToFrenet(destinationCep),
			]);
			if (cepKnown === false) {
				log.warn({ action: "order_cep_not_found", destinationCep, clientId });
			}
			shippingUnverified =
				shippingCheck.shippingUnverified || cepKnown === false;
			shippingMethod = shippingCheck.shippingMethod;
			shippingServiceCode = shippingCheck.shippingServiceCode;
		}

		const result = await db.transaction((tx) =>
			placeOrder(tx as unknown as typeof db, {
				clientId,
				input,
				ipAddress,
				userAgent,
				shippingUnverified,
				shippingMethod,
				shippingServiceCode,
			})
		);
		return { ok: true, ...result };
	} catch (err) {
		const rawMessage = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "create_order_failed",
			clientId,
			error: rawMessage,
		});
		const userError =
			err instanceof OrderError ? err.message : GENERIC_ORDER_ERROR;
		return { ok: false, error: userError };
	}
}
