import { describe, expect, it } from "vitest";

import { mapFrenetResponse } from "./map";

describe("mapFrenetResponse", () => {
	it("mapeia serviços válidos, converte preço string → centavos e ordena por preço", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "40010",
					ServiceDescription: "Sedex",
					ShippingPrice: "31.71",
					DeliveryTime: "2",
					Error: false,
				},
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "41106",
					ServiceDescription: "PAC",
					ShippingPrice: "18.90",
					DeliveryTime: "6",
					Error: false,
				},
			],
		});
		expect(result.negotiate).toBe(false);
		expect(result.options).toEqual([
			{
				carrierId: "COR-41106",
				name: "Correios — PAC",
				priceCents: 1890,
				deliveryDays: 6,
			},
			{
				carrierId: "COR-40010",
				name: "Correios — Sedex",
				priceCents: 3171,
				deliveryDays: 2,
			},
		]);
	});

	it("filtra serviço com Error=true sem derrubar os demais", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					CarrierCode: "TNT",
					ServiceCode: "RNC",
					Error: true,
					Msg: "CEP não atendido",
				},
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "40010",
					ServiceDescription: "Sedex",
					ShippingPrice: "31.71",
					DeliveryTime: "2",
					Error: false,
				},
			],
		});
		expect(result.options).toHaveLength(1);
		expect(result.options[0]?.carrierId).toBe("COR-40010");
	});

	it("filtra preço não-numérico; prazo não-numérico vira 0 (prazo a confirmar)", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					CarrierCode: "X",
					ServiceCode: "1",
					ShippingPrice: "indisponível",
					Error: false,
				},
				{
					Carrier: "Jadlog",
					CarrierCode: "JAD",
					ServiceCode: "3",
					ServiceDescription: ".Package",
					ShippingPrice: "25.00",
					DeliveryTime: "",
					Error: false,
				},
			],
		});
		expect(result.options).toEqual([
			{
				carrierId: "JAD-3",
				name: "Jadlog — .Package",
				priceCents: 2500,
				deliveryDays: 0,
			},
		]);
	});

	it("resposta sem serviços válidos (ou sem a chave) → negotiate", () => {
		expect(mapFrenetResponse({})).toEqual({ negotiate: true, options: [] });
		expect(
			mapFrenetResponse({
				ShippingSevicesArray: [{ Error: true, Msg: "sem cotação" }],
			})
		).toEqual({ negotiate: true, options: [] });
	});

	it("Error como string: 'true' filtra, 'false' mantém (SDK oficial aceita ambos os tipos)", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					CarrierCode: "TNT",
					ServiceCode: "RNC",
					Error: "true",
					Msg: "CEP não atendido",
				},
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "40010",
					ServiceDescription: "Sedex",
					ShippingPrice: "31.71",
					DeliveryTime: "2",
					Error: "false",
				},
			],
		});
		expect(result.options).toHaveLength(1);
		expect(result.options[0]?.carrierId).toBe("COR-40010");
		expect(result.negotiate).toBe(false);
	});

	it("normaliza vírgula decimal (locale BR): '45,90' → 4590 e '1.234,56' → 123456", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "41106",
					ServiceDescription: "PAC",
					ShippingPrice: "45,90",
					DeliveryTime: "6",
					Error: false,
				},
				{
					Carrier: "Jadlog",
					CarrierCode: "JAD",
					ServiceCode: "3",
					ServiceDescription: ".Package",
					ShippingPrice: "1.234,56",
					DeliveryTime: "4",
					Error: false,
				},
			],
		});
		expect(result.options.map((o) => o.priceCents)).toEqual([4590, 123_456]);
	});

	it("frete grátis (preço 0.00 de regra do painel) é aceito", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "41106",
					ServiceDescription: "PAC",
					ShippingPrice: "0.00",
					DeliveryTime: "6",
					Error: false,
				},
			],
		});
		expect(result.options[0]?.priceCents).toBe(0);
		expect(result.negotiate).toBe(false);
	});
});
