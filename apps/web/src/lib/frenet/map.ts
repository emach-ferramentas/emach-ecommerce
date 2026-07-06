import { log } from "@/lib/evlog";
import type { ShippingOption } from "@/lib/shipping/types";
import type { FrenetQuoteResponse } from "./types";

// Preço/prazo chegam como STRING; o separador observado ao vivo é ponto
// ("34.52"), mas o plugin WooCommerce oficial da Frenet defende contra vírgula
// decimal (locale BR) — mesma defesa aqui: "45,90" → 45.90, "1.234,56" → 1234.56.
function parseDecimal(raw: string | undefined): number {
	if (!raw) {
		return Number.NaN;
	}
	const normalized = raw.includes(",")
		? raw.replace(/\./g, "").replace(",", ".")
		: raw;
	return Number.parseFloat(normalized);
}

// Resposta Frenet → contrato da UI. Erro é POR SERVIÇO (Error/Msg): um serviço
// inválido não derruba os demais. Zero serviços válidos → negotiate (mesma
// semântica de "Frete a combinar" do motor anterior). carrierId é composto
// (CarrierCode-ServiceCode) — ServiceCode sozinho pode colidir entre
// transportadoras.
export function mapFrenetResponse(response: FrenetQuoteResponse): {
	negotiate: boolean;
	options: ShippingOption[];
} {
	// Chave ausente ≠ zero serviços: se a Frenet renomear a chave (ex.: corrigir
	// o typo oficial) ou devolver 200 com corpo inesperado, todo checkout viraria
	// "a combinar" sem exceção nem fail-open — este warn é o único sinal
	// distintivo de drift de contrato.
	if (!response.ShippingSevicesArray) {
		log.warn({ action: "frenet_response_missing_services_key" });
	}
	const services = response.ShippingSevicesArray ?? [];
	const options: ShippingOption[] = [];
	let discardedByError = 0;
	let discardedByParse = 0;
	for (const s of services) {
		// O SDK oficial da Frenet (frenet-php/Magento) trata Error como boolean OU
		// string — truthy simples descartaria um serviço válido com Error:"false".
		if (s.Error === true || s.Error === "true") {
			discardedByError += 1;
			continue;
		}
		const carrierId = `${s.CarrierCode ?? "NA"}-${s.ServiceCode ?? "NA"}`;
		const price = parseDecimal(s.ShippingPrice);
		if (!Number.isFinite(price)) {
			discardedByParse += 1;
			log.warn({
				action: "frenet_service_price_invalid",
				carrierId,
				raw: s.ShippingPrice ?? null,
			});
			continue;
		}
		const days = Number.parseInt(s.DeliveryTime ?? "", 10);
		const name =
			[s.Carrier, s.ServiceDescription].filter(Boolean).join(" — ") ||
			"Transportadora";
		options.push({
			carrierId,
			name,
			// Mesmo arredondamento do motor anterior (Math.round(x*100)) — o
			// anti-fraude compara com tolerância de 1 centavo; divergência de
			// rounding rejeitaria cotação legítima.
			priceCents: Math.round(price * 100),
			deliveryDays: Number.isFinite(days) ? days : 0,
		});
	}
	// Zero opções com serviços recebidos: os contadores separam "todos com
	// Error" (CEP legitimamente sem cobertura) de "descartados por parse"
	// (drift de contrato) — sem eles, os dois casos logam idênticos.
	if (options.length === 0 && services.length > 0) {
		log.warn({
			action: "frenet_zero_valid_services",
			servicesReceived: services.length,
			discardedByError,
			discardedByParse,
		});
	}
	options.sort((a, b) => a.priceCents - b.priceCents);
	return { negotiate: options.length === 0, options };
}
