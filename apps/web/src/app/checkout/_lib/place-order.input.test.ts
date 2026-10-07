import { describe, expect, it } from "vitest";

import { inputSchema } from "./place-order";

const BASE_INPUT = {
	name: "Maria Silva",
	phone: "11999998888",
	document: "52998224725",
	addressId: "addr-1",
	newAddress: null,
	acceptMarketing: false,
	cartItems: [
		{
			toolId: "tool-1",
			variantId: "variant-1",
			quantity: 1,
			priceAmount: "100.00",
		},
	],
	shippingAmount: "35.95",
};

describe("inputSchema", () => {
	it("grava o telefone só com dígitos", () => {
		const parsed = inputSchema.parse({
			...BASE_INPUT,
			phone: "(11) 99999-8888",
		});
		expect(parsed.phone).toBe("11999998888");
	});

	it("recusa celular sem o 9 na frente", () => {
		const parsed = inputSchema.safeParse({
			...BASE_INPUT,
			phone: "11899998888",
		});
		expect(parsed.error?.issues.map((i) => i.path.join("."))).toEqual([
			"phone",
		]);
	});

	it("aceita CNPJ alfanumérico e grava em maiúsculas sem pontuação", () => {
		const parsed = inputSchema.parse({
			...BASE_INPUT,
			document: "12.abc.345/01de-35",
		});
		expect(parsed.document).toBe("12ABC34501DE35");
	});

	it("grava CPF só com dígitos", () => {
		const parsed = inputSchema.parse({
			...BASE_INPUT,
			document: "529.982.247-25",
		});
		expect(parsed.document).toBe("52998224725");
	});

	it("não exige e-mail (o pedido usa o e-mail da conta)", () => {
		const parsed = inputSchema.safeParse(BASE_INPUT);
		expect(parsed.success).toBe(true);
	});
});
