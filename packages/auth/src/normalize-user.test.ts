import { describe, expect, test } from "bun:test";
import { APIError } from "better-auth/api";
import { normalizeUserForWrite } from "./normalize-user";

describe("normalizeUserForWrite: documento", () => {
	test("grava CNPJ alfanumérico em maiúsculas, sem pontuação", () => {
		expect(
			normalizeUserForWrite({ document: "12.abc.345/01de-35" }).document
		).toBe("12ABC34501DE35");
	});

	test("grava CNPJ numérico só com dígitos", () => {
		expect(
			normalizeUserForWrite({ document: "11.222.333/0001-81" }).document
		).toBe("11222333000181");
	});

	test("grava CPF só com dígitos", () => {
		expect(normalizeUserForWrite({ document: "529.982.247-25" }).document).toBe(
			"52998224725"
		);
	});

	test("documento vazio vira NULL, não string vazia", () => {
		expect(normalizeUserForWrite({ document: "  " }).document).toBeNull();
	});

	test("documento ausente não entra no payload", () => {
		expect(normalizeUserForWrite({ name: "Ana" })).toEqual({ name: "Ana" });
	});

	test("recusa CNPJ alfanumérico com DV errado", () => {
		expect(() => normalizeUserForWrite({ document: "12ABC34501DE36" })).toThrow(
			APIError
		);
	});

	test("recusa CPF com letra", () => {
		expect(() => normalizeUserForWrite({ document: "5299822472A" })).toThrow(
			APIError
		);
	});
});

describe("normalizeUserForWrite: telefone", () => {
	test("grava telefone só com dígitos", () => {
		expect(normalizeUserForWrite({ phone: "(11) 98765-4321" }).phone).toBe(
			"11987654321"
		);
	});

	test("telefone vazio vira NULL", () => {
		expect(normalizeUserForWrite({ phone: " " }).phone).toBeNull();
	});

	test("recusa telefone inválido", () => {
		expect(() => normalizeUserForWrite({ phone: "123" })).toThrow(APIError);
	});
});

describe("normalizeUserForWrite: campo que não é string", () => {
	test.each([
		["null", null],
		["undefined", undefined],
		["número", 11_987_654_321],
	])("%s passa intacto e devolve o mesmo objeto", (_label, value) => {
		const input = { name: "Ana", document: value, phone: value };
		const out = normalizeUserForWrite(input);

		expect(out).toBe(input);
		expect(out).toEqual({ name: "Ana", document: value, phone: value });
	});
});
