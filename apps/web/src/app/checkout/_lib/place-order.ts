import type { db } from "@emach/db";
import { client, clientAddress } from "@emach/db/schema/client";
import { consentLog } from "@emach/db/schema/consent-log";
import { stockLevel } from "@emach/db/schema/inventory";
import { order, orderItem } from "@emach/db/schema/orders";
import { promotion } from "@emach/db/schema/promotions";
import { tool, toolVariant } from "@emach/db/schema/tools";
import { isValidCpfCnpj, onlyDigits } from "@emach/validators";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
	autoPromoToolIdsFromMap,
	fetchAutoPromosByToolId,
} from "@/lib/auto-promo";
import {
	ENUMERABLE_REASONS,
	publicCouponError,
	validateCoupon,
} from "@/lib/coupons/validate-coupon";
import { log } from "@/lib/evlog";
import { numericToCents } from "@/lib/format";
import { effectiveAutoDiscountCents } from "@/lib/promotions";
import { quoteShipping } from "@/lib/shipping/quote";
import { addressFieldsSchema } from "@/lib/validators/address";

const PRICE_TOLERANCE_CENTS = 1;

const newAddressSchema = addressFieldsSchema;

/**
 * Erro de negócio do checkout cuja `message` é segura para exibir ao
 * cliente. Tudo que não for `OrderError` é tratado como falha inesperada
 * de infraestrutura e nunca deve ter a mensagem repassada ao navegador.
 */
export class OrderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OrderError";
	}
}

const PG_UNIQUE_VIOLATION = "23505";

/** Detecta a violação de unicidade de `client.document` (DrizzleQueryError → cause pg). */
function isDocumentUniqueViolation(err: unknown): boolean {
	const cause = (err as { cause?: { code?: string; constraint?: string } })
		?.cause;
	return (
		cause?.code === PG_UNIQUE_VIOLATION &&
		cause?.constraint === "client_document_unique"
	);
}

export const inputSchema = z.object({
	name: z.string().min(2),
	email: z.email(),
	phone: z.string().min(10),
	document: z
		.string()
		.transform((v) => onlyDigits(v))
		.refine(isValidCpfCnpj, "Documento inválido"),
	addressId: z.string().nullable(),
	newAddress: newAddressSchema.nullable(),
	acceptMarketing: z.boolean(),
	cartItems: z
		.array(
			z.object({
				toolId: z.string().min(1),
				variantId: z.string().min(1),
				quantity: z.number().int().positive(),
				// Mesmo formato do shippingAmount: sem o regex, "abc" viraria NaN em
				// numericToCents e passaria mudo pela comparação de preço (NaN > tol
				// é false) — o pedido gravaria o preço do DB, mas sem rejeitar o
				// payload malformado.
				priceAmount: z.string().regex(/^\d+\.\d{2}$/),
			})
		)
		.min(1, "Carrinho vazio"),
	shippingAmount: z.string().regex(/^\d+\.\d{2}$/),
	// carrierId composto ("COR-40010") da opção Frenet escolhida na UI. Opcional
	// p/ compat na janela de deploy — sem ele o match cai pro preço apenas.
	shippingServiceCode: z.string().min(1).optional(),
	couponCode: z.string().trim().min(1).optional(),
});

export type CreateOrderInput = z.infer<typeof inputSchema>;

export type CreateOrderResult =
	| { ok: true; orderId: string; orderNumber: string }
	| { ok: false; error: string };

interface AddressSnapshot {
	city: string;
	complement: string | null;
	country: string;
	neighborhood: string;
	number: string;
	recipient: string;
	state: string;
	street: string;
	zipCode: string;
}

export function formatOrderNumber(seq: number): string {
	const year = new Date().getUTCFullYear();
	return `${year}-${seq.toString().padStart(6, "0")}`;
}

async function buildAddressSnapshot(params: {
	clientId: string;
	addressId: string | null;
	newAddress: z.infer<typeof newAddressSchema> | null;
	recipient: string;
	tx: typeof db;
}): Promise<{ snapshot: AddressSnapshot; addressId: string }> {
	const { clientId, addressId, newAddress, recipient, tx } = params;

	if (addressId) {
		const rows = await tx
			.select()
			.from(clientAddress)
			.where(
				and(
					eq(clientAddress.id, addressId),
					eq(clientAddress.clientId, clientId)
				)
			)
			.limit(1);
		const row = rows[0];
		if (!row) {
			throw new OrderError("Endereço não encontrado");
		}
		return {
			addressId: row.id,
			snapshot: {
				recipient: row.recipient,
				zipCode: row.zipCode,
				street: row.street,
				number: row.number,
				complement: row.complement,
				neighborhood: row.neighborhood,
				city: row.city,
				state: row.state,
				country: row.country,
			},
		};
	}

	if (!newAddress) {
		throw new OrderError("Endereço não fornecido");
	}

	const id = crypto.randomUUID();
	const isDefault =
		(
			await tx
				.select({ id: clientAddress.id })
				.from(clientAddress)
				.where(eq(clientAddress.clientId, clientId))
				.limit(1)
		).length === 0;

	await tx.insert(clientAddress).values({
		id,
		clientId,
		recipient,
		zipCode: newAddress.zipCode,
		street: newAddress.street,
		number: newAddress.number,
		complement: newAddress.complement || null,
		neighborhood: newAddress.neighborhood,
		city: newAddress.city,
		state: newAddress.state,
		country: "BR",
		isDefault,
	});

	return {
		addressId: id,
		snapshot: {
			recipient,
			zipCode: newAddress.zipCode,
			street: newAddress.street,
			number: newAddress.number,
			complement: newAddress.complement || null,
			neighborhood: newAddress.neighborhood,
			city: newAddress.city,
			state: newAddress.state,
			country: "BR",
		},
	};
}

interface PreparedLine {
	cartItem: CreateOrderInput["cartItems"][number];
	finalPriceCents: number;
	lineTotalCents: number;
	tool: {
		id: string;
		name: string;
		model: string | null;
		ncm: string | null;
		cest: string | null;
		manufacturerName: string | null;
		weightKg: string | null;
		lengthCm: string | null;
		widthCm: string | null;
		heightCm: string | null;
	};
	variant: {
		id: string;
		toolId: string;
		sku: string;
		barcode: string;
		voltage: "127V" | "220V" | "Bivolt" | "380V" | null;
		priceAmount: string;
		visibleOnSite: boolean;
	};
}

// Exportado p/ o createOrderAction derivar o valor declarado do seguro dos
// preços VERIFICADOS (fora da transação) — dentro da transação o placeOrder
// re-executa esta função como autoridade final.
export async function prepareLines(
	tx: typeof db,
	input: CreateOrderInput
): Promise<{ lines: PreparedLine[]; autoPromoToolIds: Set<string> }> {
	const variantIds = input.cartItems.map((i) => i.variantId);
	const toolIds = Array.from(new Set(input.cartItems.map((i) => i.toolId)));

	const [variantRows, toolRows, autoPromosByToolId] = await Promise.all([
		tx
			.select({
				id: toolVariant.id,
				toolId: toolVariant.toolId,
				sku: toolVariant.sku,
				barcode: toolVariant.barcode,
				voltage: toolVariant.voltage,
				priceAmount: toolVariant.priceAmount,
				visibleOnSite: toolVariant.visibleOnSite,
			})
			.from(toolVariant)
			.where(inArray(toolVariant.id, variantIds)),
		tx
			.select({
				id: tool.id,
				name: tool.name,
				model: tool.model,
				ncm: tool.ncm,
				cest: tool.cest,
				manufacturerName: tool.manufacturerName,
				weightKg: tool.weightKg,
				lengthCm: tool.lengthCm,
				widthCm: tool.widthCm,
				heightCm: tool.heightCm,
			})
			.from(tool)
			.where(inArray(tool.id, toolIds)),
		fetchAutoPromosByToolId(tx, toolIds, new Date()),
	]);

	if (variantRows.length !== variantIds.length) {
		throw new OrderError("Variante inválida no carrinho");
	}

	const toolById = new Map(toolRows.map((t) => [t.id, t]));
	const variantById = new Map(variantRows.map((v) => [v.id, v]));

	const lines: PreparedLine[] = [];
	for (const cartItem of input.cartItems) {
		const variant = variantById.get(cartItem.variantId);
		const toolRow = toolById.get(cartItem.toolId);
		if (!(variant && toolRow) || variant.toolId !== cartItem.toolId) {
			throw new OrderError("Inconsistência cart/DB");
		}
		// Defesa final: bloqueia variante hidden mesmo se o cliente manipular o
		// frontend ou se a variante virou hidden depois de adicionada ao carrinho.
		// O catálogo e o PDP já filtram variantes hidden, então em fluxo normal
		// isso é inalcançável — mas é a única barreira contra payload adulterado.
		if (!variant.visibleOnSite) {
			throw new OrderError(`Variante indisponível para venda: ${toolRow.name}`);
		}
		const promos = autoPromosByToolId.get(cartItem.toolId) ?? [];
		const basePriceCents = numericToCents(variant.priceAmount);
		let finalPriceCents = basePriceCents;
		for (const promo of promos) {
			const candidate = effectiveAutoDiscountCents(
				basePriceCents,
				promo.discountType,
				promo.discountValue
			);
			if (candidate < finalPriceCents) {
				finalPriceCents = candidate;
			}
		}
		const submittedCents = numericToCents(cartItem.priceAmount);
		if (Math.abs(submittedCents - finalPriceCents) > PRICE_TOLERANCE_CENTS) {
			throw new OrderError("Preços atualizados, refaça o checkout");
		}
		lines.push({
			cartItem,
			variant,
			tool: toolRow,
			finalPriceCents,
			lineTotalCents: finalPriceCents * cartItem.quantity,
		});
	}

	return {
		lines,
		autoPromoToolIds: autoPromoToolIdsFromMap(autoPromosByToolId),
	};
}

/**
 * Resolve o CEP de destino (8 dígitos) a partir do endereço salvo ou do novo
 * endereço do input. Retorna `null` se não houver CEP válido.
 */
export async function resolveDestinationCep(
	database: typeof db,
	input: CreateOrderInput,
	clientId: string
): Promise<string | null> {
	const raw = input.addressId
		? (
				await database
					.select({ zipCode: clientAddress.zipCode })
					.from(clientAddress)
					.where(
						and(
							eq(clientAddress.id, input.addressId),
							eq(clientAddress.clientId, clientId)
						)
					)
					.limit(1)
			)[0]?.zipCode
		: input.newAddress?.zipCode;
	const cep = raw?.replace(/\D/g, "") ?? "";
	return cep.length === 8 ? cep : null;
}

/**
 * Anti-fraude: re-cota o frete no servidor (via cache Frenet — reutiliza a
 * cotação que a UI exibiu) e exige que o `shippingCents` enviado pelo cliente
 * bata com uma opção (tolerância de 1 centavo). Com `shippingServiceCode`
 * presente, valida o PAR serviço+preço — não basta o preço existir em outra
 * opção. Devolve `shippingMethod` (label da opção casada) p/ persistir no
 * pedido.
 *
 * Falha de infra na cotação (Frenet fora/timeout, cache e DB indisponíveis)
 * **não** bloqueia a venda (fail-open), mas retorna `shippingUnverified: true`
 * — o pedido é marcado para revisão do staff no dashboard antes de faturar
 * (#97 / dashboard#143). Só valor adulterado (mismatch) ou frete a combinar
 * lança `OrderError`.
 *
 * Deve rodar **fora** da transação do pedido — a cotação faz chamada externa
 * e não pode segurar a transação aberta durante essa latência.
 */
export async function assertShippingQuoted(params: {
	shippingCents: number;
	destinationCep: string;
	items: Array<{ toolId: string; quantity: number }>;
	declaredValueCents?: number;
	shippingServiceCode?: string;
}): Promise<{
	shippingUnverified: boolean;
	shippingMethod: string | null;
	// #186: carrierId composto ("COR-40010") da opção CASADA pelo anti-fraude
	// (não o input cru do cliente) — persistido p/ habilitar tracking Frenet.
	shippingServiceCode: string | null;
}> {
	let quote: Awaited<ReturnType<typeof quoteShipping>>;
	try {
		quote = await quoteShipping({
			destinationCep: params.destinationCep,
			items: params.items,
			declaredValueCents: params.declaredValueCents,
		});
	} catch (err) {
		// Fail-open consciente: falha de infra na cotação (Frenet fora do ar,
		// timeout) NÃO bloqueia a venda — não punir o cliente por instabilidade
		// de terceiro. Em vez de aceitar o frete às cegas, sinalizamos
		// `shippingUnverified` — o pedido grava a flag e o staff revisa no
		// dashboard antes de faturar (limpa via markShippingReviewed). Fecha o
		// vetor "derruba a cotação → frete grátis".
		log.error({
			action: "shipping_revalidation_skipped",
			destinationCep: params.destinationCep,
			shippingCents: params.shippingCents,
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return {
			shippingUnverified: true,
			shippingMethod: null,
			shippingServiceCode: null,
		};
	}
	// Nenhum serviço cotável p/ o CEP/pacote → frete a combinar; sem opção a casar.
	if (quote.negotiate) {
		throw new OrderError("Frete a combinar — entre em contato para concluir");
	}
	const candidates = params.shippingServiceCode
		? quote.options.filter((o) => o.carrierId === params.shippingServiceCode)
		: quote.options;
	const match = candidates.find(
		(o) =>
			Math.abs(o.priceCents - params.shippingCents) <= PRICE_TOLERANCE_CENTS
	);
	if (!match) {
		throw new OrderError("Frete inválido, refaça o checkout");
	}
	return {
		shippingUnverified: false,
		shippingMethod: match.name,
		shippingServiceCode: match.carrierId,
	};
}

async function checkAggregateStock(
	tx: typeof db,
	lines: PreparedLine[]
): Promise<void> {
	const variantIds = lines.map((l) => l.variant.id);
	const rows = await tx
		.select({
			variantId: stockLevel.variantId,
			total: sql<number>`COALESCE(SUM(${stockLevel.quantity}), 0)::int`,
		})
		.from(stockLevel)
		.where(inArray(stockLevel.variantId, variantIds))
		.groupBy(stockLevel.variantId);

	const totalByVariant = new Map(rows.map((r) => [r.variantId, r.total]));
	for (const line of lines) {
		const total = totalByVariant.get(line.variant.id) ?? 0;
		if (total < line.cartItem.quantity) {
			throw new OrderError(`Sem estoque para ${line.tool.name}`);
		}
	}
}

export async function placeOrder(
	tx: typeof db,
	params: {
		clientId: string;
		input: CreateOrderInput;
		ipAddress: string | null;
		userAgent: string | null;
		// #97: frete não pôde ser revalidado server-side (API de frete fora) →
		// pedido marcado para revisão do staff. Default false (frete verificado).
		shippingUnverified?: boolean;
		// Label do serviço validado pelo assertShippingQuoted (ex.: "Correios —
		// Sedex"). null quando o frete não pôde ser verificado (fail-open).
		shippingMethod?: string | null;
		// #186: carrierId composto validado ("COR-40010") — base do tracking
		// Frenet (POST /tracking/trackinginfo exige ShippingServiceCode).
		shippingServiceCode?: string | null;
	}
): Promise<{ orderId: string; orderNumber: string }> {
	const {
		clientId,
		input,
		ipAddress,
		userAgent,
		shippingUnverified = false,
		shippingMethod = null,
		shippingServiceCode = null,
	} = params;

	const { lines, autoPromoToolIds } = await prepareLines(tx, input);
	await checkAggregateStock(tx, lines);

	const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
	const shippingCents = numericToCents(input.shippingAmount);
	let discountCents = 0;
	let couponId: string | null = null;
	if (input.couponCode) {
		const couponLines = lines.map((l) => ({
			toolId: l.tool.id,
			quantity: l.cartItem.quantity,
			basePriceCents: numericToCents(l.variant.priceAmount),
		}));
		const coupon = await validateCoupon(
			tx,
			input.couponCode,
			couponLines,
			autoPromoToolIds
		);
		if (!coupon.ok) {
			// Anti-enumeração também neste caminho: createOrderAction valida o cupom
			// direto (sem passar pelo apply-coupon), então a mensagem precisa ser
			// colapsada aqui também, senão o controle do apply-coupon é contornável.
			if (ENUMERABLE_REASONS.has(coupon.reason)) {
				log.warn({ action: "coupon_rejected", reason: coupon.reason });
			}
			throw new OrderError(publicCouponError(coupon.reason, coupon.error));
		}

		// Trava a linha da promoção e re-checa o limite na mesma transação
		// (mesmo padrão idempotente do débito de estoque).
		const lockRes = await tx.execute(
			sql`SELECT redemption_count, max_redemptions FROM promotion WHERE id = ${coupon.promotionId} FOR UPDATE`
		);
		const lock =
			(
				lockRes as unknown as {
					rows: Array<{
						redemption_count: number;
						max_redemptions: number | null;
					}>;
				}
			).rows?.[0] ??
			(
				lockRes as unknown as Array<{
					redemption_count: number;
					max_redemptions: number | null;
				}>
			)[0];
		if (!lock) {
			// Promoção removida concorrentemente entre validateCoupon e o FOR UPDATE.
			// Mensagem colapsada (anti-enumeração) — mesmo motivo do throw acima.
			throw new OrderError(
				publicCouponError("invalid", "Cupom não disponível")
			);
		}
		if (
			lock.max_redemptions !== null &&
			lock.redemption_count >= lock.max_redemptions
		) {
			throw new OrderError(publicCouponError("exhausted", "Cupom esgotado"));
		}

		await tx
			.update(promotion)
			.set({ redemptionCount: sql`${promotion.redemptionCount} + 1` })
			.where(eq(promotion.id, coupon.promotionId));

		discountCents = coupon.discountCents;
		couponId = coupon.promotionId;
	}
	const totalCents = subtotalCents - discountCents + shippingCents;

	try {
		await tx
			.update(client)
			.set({
				name: input.name,
				phone: input.phone,
				document: input.document,
			})
			.where(eq(client.id, clientId));
	} catch (err) {
		if (isDocumentUniqueViolation(err)) {
			throw new OrderError("Este CPF/CNPJ já está cadastrado em outra conta.");
		}
		throw err;
	}

	const { snapshot } = await buildAddressSnapshot({
		clientId,
		addressId: input.addressId,
		newAddress: input.newAddress,
		recipient: input.name,
		tx,
	});

	const consentVersion = "1.0";
	const consentRows = [
		{ kind: "tos" as const, granted: true },
		{ kind: "privacy" as const, granted: true },
		{ kind: "marketing_email" as const, granted: input.acceptMarketing },
	];
	await tx.insert(consentLog).values(
		consentRows.map((c) => ({
			id: crypto.randomUUID(),
			clientId,
			kind: c.kind,
			granted: c.granted,
			version: consentVersion,
			ipAddress,
			userAgent,
		}))
	);

	const seqRow = await tx.execute(
		sql`SELECT nextval('order_number_seq')::int AS seq`
	);
	const seq = Number(
		(seqRow as unknown as { rows: Array<{ seq: number }> }).rows[0]?.seq ??
			(seqRow as unknown as Array<{ seq: number }>)[0]?.seq
	);
	if (!Number.isFinite(seq)) {
		throw new OrderError("Falha ao gerar número do pedido");
	}
	const orderNumber = formatOrderNumber(seq);

	const orderId = crypto.randomUUID();
	const subtotalAmount = (subtotalCents / 100).toFixed(2);
	const totalAmount = (totalCents / 100).toFixed(2);

	await tx.insert(order).values({
		id: orderId,
		number: orderNumber,
		clientId,
		branchId: null,
		status: "pending_payment",
		subtotalAmount,
		discountAmount: (discountCents / 100).toFixed(2),
		couponId,
		shippingAmount: input.shippingAmount,
		shippingMethod,
		shippingServiceCode,
		totalAmount,
		shippingAddress: snapshot,
		shippingUnverified,
	});

	for (const line of lines) {
		const orderItemId = crypto.randomUUID();
		const unitPrice = (line.finalPriceCents / 100).toFixed(2);
		const lineTotal = (line.lineTotalCents / 100).toFixed(2);

		await tx.insert(orderItem).values({
			id: orderItemId,
			orderId,
			toolId: line.tool.id,
			variantId: line.variant.id,
			sku: line.variant.sku,
			barcode: line.variant.barcode,
			name: line.tool.name,
			model: line.tool.model,
			voltage: line.variant.voltage,
			unitPrice,
			quantity: line.cartItem.quantity,
			lineTotal,
			discountAmount: "0",
			ncm: line.tool.ncm,
			cest: line.tool.cest,
			manufacturerName: line.tool.manufacturerName,
			weightKg: line.tool.weightKg,
			lengthCm: line.tool.lengthCm,
			widthCm: line.tool.widthCm,
			heightCm: line.tool.heightCm,
		});
	}

	return { orderId, orderNumber };
}
