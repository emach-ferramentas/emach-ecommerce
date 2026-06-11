import { describe, expect, test } from "bun:test";
import { isValidPhone } from "./cpf-cnpj";

describe("isValidPhone", () => {
	test("aceita fixo com 10 dígitos", () => {
		expect(isValidPhone("1133334444")).toBe(true);
	});

	test("aceita celular com 11 dígitos e o 9", () => {
		expect(isValidPhone("11999998888")).toBe(true);
	});

	test("aceita entrada mascarada (normaliza antes)", () => {
		expect(isValidPhone("(11) 99999-8888")).toBe(true);
	});

	test("rejeita texto sem dígitos", () => {
		expect(isValidPhone("abc")).toBe(false);
	});

	test("rejeita comprimento inválido (5 dígitos)", () => {
		expect(isValidPhone("11999")).toBe(false);
	});

	test("rejeita allSame", () => {
		expect(isValidPhone("00000000000")).toBe(false);
	});

	test("rejeita DDD fora da faixa (< 11)", () => {
		expect(isValidPhone("0199998888")).toBe(false);
	});

	test("rejeita celular (11 díg) sem o 9 no 3º dígito", () => {
		expect(isValidPhone("11899998888")).toBe(false);
	});
});
