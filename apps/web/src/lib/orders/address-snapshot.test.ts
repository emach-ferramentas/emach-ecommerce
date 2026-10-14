import { describe, expect, it } from "vitest";
import { addressSnapshotSchema } from "./address-snapshot";

describe("addressSnapshotSchema", () => {
	it("mantém o snapshot completo gravado pelo checkout", () => {
		const snapshot = {
			city: "Curitiba",
			complement: "Sala 2",
			country: "BR",
			neighborhood: "Centro",
			number: "100",
			recipient: "Ana",
			state: "PR",
			street: "Rua XV",
			zipCode: "80020-000",
		};

		expect(addressSnapshotSchema.parse(snapshot)).toStrictEqual(snapshot);
	});

	it("converte número em texto, inclusive no complemento", () => {
		expect(
			addressSnapshotSchema.parse({
				number: 100,
				zipCode: 80_020_000,
				complement: 7,
			})
		).toStrictEqual({ number: "100", zipCode: "80020000", complement: "7" });
	});

	it("descarta só o campo inválido e mantém os outros", () => {
		expect(
			addressSnapshotSchema.parse({
				city: { nome: "Curitiba" },
				street: "Rua XV",
				number: true,
				state: null,
			})
		).toStrictEqual({
			city: undefined,
			number: undefined,
			state: undefined,
			street: "Rua XV",
		});
	});

	it("aceita complemento null", () => {
		expect(addressSnapshotSchema.parse({ complement: null })).toStrictEqual({
			complement: null,
		});
	});

	it("descarta chave desconhecida", () => {
		expect(
			addressSnapshotSchema.parse({ street: "Rua XV", latitude: -25.4 })
		).toStrictEqual({ street: "Rua XV" });
	});

	it("falha quando o valor não é objeto", () => {
		for (const value of [null, undefined, "Rua XV", 42, ["Rua XV"]]) {
			expect(addressSnapshotSchema.safeParse(value).success).toBe(false);
		}
	});

	it("com .catch({}) vira endereço vazio quando o valor não é objeto", () => {
		expect(addressSnapshotSchema.catch({}).parse(null)).toStrictEqual({});
	});
});
