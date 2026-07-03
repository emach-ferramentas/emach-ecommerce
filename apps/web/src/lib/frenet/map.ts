import type { ShippingOption } from "@/lib/shipping/types";
import type { FrenetQuoteResponse } from "./types";

// Resposta Frenet → contrato da UI. Erro é POR SERVIÇO (Error/Msg): um serviço
// inválido não derruba os demais. Zero serviços válidos → negotiate (mesma
// semântica de "Frete a combinar" do motor anterior). carrierId é composto
// (CarrierCode-ServiceCode) — ServiceCode sozinho pode colidir entre
// transportadoras.
export function mapFrenetResponse(response: FrenetQuoteResponse): {
	negotiate: boolean;
	options: ShippingOption[];
} {
	const services = response.ShippingSevicesArray ?? [];
	const options: ShippingOption[] = [];
	for (const s of services) {
		if (s.Error) {
			continue;
		}
		const price = Number.parseFloat(s.ShippingPrice ?? "");
		if (!Number.isFinite(price)) {
			continue;
		}
		const days = Number.parseInt(s.DeliveryTime ?? "", 10);
		const name =
			[s.Carrier, s.ServiceDescription].filter(Boolean).join(" — ") ||
			"Transportadora";
		options.push({
			carrierId: `${s.CarrierCode ?? "NA"}-${s.ServiceCode ?? "NA"}`,
			name,
			// Mesmo arredondamento do motor anterior (Math.round(x*100)) — o
			// anti-fraude compara com tolerância de 1 centavo; divergência de
			// rounding rejeitaria cotação legítima.
			priceCents: Math.round(price * 100),
			deliveryDays: Number.isFinite(days) ? days : 0,
		});
	}
	options.sort((a, b) => a.priceCents - b.priceCents);
	return { negotiate: options.length === 0, options };
}
