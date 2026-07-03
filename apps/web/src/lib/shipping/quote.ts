import { db } from "@emach/db";
import { getActiveBoxes } from "@emach/db/queries/shipping";
import { packItems } from "@emach/db/queries/shipping-quote";
import {
	getShippingSettings,
	type ShippingSettings,
} from "@emach/db/queries/store-settings";
import { tool } from "@emach/db/schema/tools";
import { env } from "@emach/env/server";
import { inArray } from "drizzle-orm";

import {
	buildQuoteCacheKey,
	getCachedQuote,
	setCachedQuote,
} from "@/lib/frenet/cache";
import { fetchFrenetQuote } from "@/lib/frenet/client";
import { mapFrenetResponse } from "@/lib/frenet/map";
import { buildQuoteItems } from "./build-items";
import type { ShippingOption } from "./types";

export interface QuoteShippingInput {
	declaredValueCents?: number;
	destinationCep: string;
	items: { toolId: string; quantity: number }[];
}

// Valor declarado efetivo segundo a política de seguro do dashboard (#179):
// 'none' → 0 (não declara, sem ad valorem); 'cart_value' → subtotal limitado
// ao cap (insuranceCapAmount é numeric em REAIS — conversão explícita p/ cents).
function effectiveInsuranceCents(
	declaredValueCents: number,
	settings: ShippingSettings
): number {
	if (settings.insurancePolicy === "none") {
		return 0;
	}
	return Math.min(
		declaredValueCents,
		Math.round(settings.insuranceCapAmount * 100)
	);
}

// Cotação via Frenet (substitui o motor de tabelas próprias — spec
// 2026-07-02). O carrinho ainda é consolidado em caixas reais (packItems +
// shippingBox): cada caixa vira uma linha do ShippingItemArray; item sem caixa
// → negotiate ("a combinar") SEM gastar chamada. Cache Redis 30min faz o
// re-quote do assertShippingQuoted reutilizar a cotação exibida ao cliente.
export async function quoteShipping(
	input: QuoteShippingInput
): Promise<{ negotiate: boolean; options: ShippingOption[] }> {
	const toolIds = Array.from(new Set(input.items.map((i) => i.toolId)));
	const [boxes, settings, toolRows] = await Promise.all([
		getActiveBoxes(db),
		getShippingSettings(db),
		db
			.select({
				id: tool.id,
				weightKg: tool.weightKg,
				lengthCm: tool.lengthCm,
				widthCm: tool.widthCm,
				heightCm: tool.heightCm,
				packagingWeightKg: tool.packagingWeightKg,
				stackable: tool.stackable,
				shipsInOwnBox: tool.shipsInOwnBox,
			})
			.from(tool)
			.where(inArray(tool.id, toolIds)),
	]);

	const items = buildQuoteItems(toolRows, input.items);
	const packages = packItems(items, boxes);
	if (packages.some((p) => p.outOfCatalog)) {
		return { negotiate: true, options: [] };
	}

	const destinationCep = input.destinationCep.replace(/\D/g, "");
	// Origem: CEP da filial configurada no dashboard; fallback env quando não
	// configurada. Valor declarado: política de seguro do dashboard. Ambos
	// entram na chave de cache → setting mudou, chave muda, sem invalidação manual.
	const sellerCep = (settings.originCep ?? env.FRENET_SELLER_CEP).replace(
		/\D/g,
		""
	);
	const declaredValueCents = effectiveInsuranceCents(
		input.declaredValueCents ?? 0,
		settings
	);
	const cacheKey = buildQuoteCacheKey({
		sellerCep,
		destinationCep,
		declaredValueCents,
		packages,
	});
	const cached = await getCachedQuote(cacheKey);
	if (cached) {
		return cached;
	}

	const response = await fetchFrenetQuote({
		SellerCEP: sellerCep,
		RecipientCEP: destinationCep,
		ShipmentInvoiceValue: declaredValueCents / 100,
		RecipientCountry: "BR",
		ShippingItemArray: packages.map((p) => ({
			Weight: p.weightKg,
			Length: p.lengthCm,
			Height: p.heightCm,
			Width: p.widthCm,
			Quantity: 1,
		})),
	});
	const result = mapFrenetResponse(response);
	await setCachedQuote(cacheKey, result);
	return result;
}
