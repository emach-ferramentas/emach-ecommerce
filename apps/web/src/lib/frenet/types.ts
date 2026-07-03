// Contrato da API Frenet (POST /shipping/quote) — espelha o frenetapi.apib.
// Atenção: a chave da resposta tem typo OFICIAL ("ShippingSevicesArray", sem o
// segundo "r") e preço/prazo chegam como STRING.

export interface FrenetShippingItem {
	Height: number;
	Length: number;
	Quantity: number;
	Weight: number;
	Width: number;
}

export interface FrenetQuoteRequest {
	RecipientCEP: string;
	RecipientCountry: "BR";
	SellerCEP: string;
	ShipmentInvoiceValue: number;
	ShippingItemArray: FrenetShippingItem[];
}

export interface FrenetShippingService {
	Carrier?: string;
	CarrierCode?: string;
	DeliveryTime?: string;
	Error?: boolean;
	Msg?: string;
	ServiceCode?: string;
	ServiceDescription?: string;
	ShippingPrice?: string;
}

export interface FrenetQuoteResponse {
	ShippingSevicesArray?: FrenetShippingService[];
	Timeout?: number;
}

// GET /CEP/Address/{cep} — lookup de endereço p/ autofill (#191).
export interface FrenetAddressResponse {
	CEP?: string;
	City?: string;
	District?: string;
	Message?: string;
	Street?: string;
	UF?: string;
}
