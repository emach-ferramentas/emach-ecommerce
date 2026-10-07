import { describe, expect, test } from "bun:test";
import {
	isValidCnpj,
	isValidCpf,
	isValidCpfCnpj,
	isValidPhone,
	maskCpfCnpj,
	normalizeDocument,
} from "./cpf-cnpj";

describe("isValidCpf", () => {
	test("aceita CPF válido sem máscara", () => {
		expect(isValidCpf("52998224725")).toBe(true);
	});

	test("aceita CPF válido com máscara", () => {
		expect(isValidCpf("529.982.247-25")).toBe(true);
	});

	test("rejeita dígito verificador errado", () => {
		expect(isValidCpf("52998224724")).toBe(false);
	});

	test("rejeita allSame", () => {
		expect(isValidCpf("11111111111")).toBe(false);
	});

	test("rejeita comprimento errado", () => {
		expect(isValidCpf("123")).toBe(false);
	});
});

describe("isValidCnpj", () => {
	test("aceita CNPJ válido sem máscara", () => {
		expect(isValidCnpj("11222333000181")).toBe(true);
	});

	test("aceita CNPJ válido com máscara", () => {
		expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
	});

	test("rejeita dígito verificador errado", () => {
		expect(isValidCnpj("11222333000182")).toBe(false);
	});

	test("rejeita allSame", () => {
		expect(isValidCnpj("11111111111111")).toBe(false);
	});

	test("rejeita comprimento errado", () => {
		expect(isValidCnpj("1122")).toBe(false);
	});
});

// Exemplo oficial do Serpro ("Cálculo dos dígitos verificadores de CNPJ
// alfanumérico", manual-dv-cnpj.pdf da Receita Federal): 12.ABC.345/01DE-35.
describe("isValidCnpj alfanumérico", () => {
	test("aceita o exemplo oficial sem máscara", () => {
		expect(isValidCnpj("12ABC34501DE35")).toBe(true);
	});

	test("aceita o exemplo oficial com máscara", () => {
		expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
	});

	test("aceita letras minúsculas", () => {
		expect(isValidCnpj("12.abc.345/01de-35")).toBe(true);
	});

	test("rejeita dígito verificador errado", () => {
		expect(isValidCnpj("12ABC34501DE36")).toBe(false);
	});

	test("rejeita letra na posição do dígito verificador", () => {
		expect(isValidCnpj("12ABC34501DE3A")).toBe(false);
	});

	test("rejeita letra trocada na raiz", () => {
		expect(isValidCnpj("12ABD34501DE35")).toBe(false);
	});
});

describe("normalizeDocument", () => {
	test("tira pontuação e passa para maiúsculas", () => {
		expect(normalizeDocument(" 12.abc.345/01de-35 ")).toBe("12ABC34501DE35");
	});

	test("mantém CPF só com dígitos", () => {
		expect(normalizeDocument("529.982.247-25")).toBe("52998224725");
	});
});

describe("maskCpfCnpj", () => {
	test("formata CPF", () => {
		expect(maskCpfCnpj("52998224725")).toBe("529.982.247-25");
	});

	test("formata CNPJ numérico", () => {
		expect(maskCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
	});

	test("formata CNPJ alfanumérico em maiúsculas", () => {
		expect(maskCpfCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
	});

	test("trata entrada parcial com letra como CNPJ", () => {
		expect(maskCpfCnpj("12abc")).toBe("12.ABC");
	});

	test("corta além de 14 caracteres", () => {
		expect(maskCpfCnpj("12ABC34501DE35999")).toBe("12.ABC.345/01DE-35");
	});
});

describe("isValidCpfCnpj", () => {
	test("aceita CNPJ alfanumérico", () => {
		expect(isValidCpfCnpj("12.abc.345/01de-35")).toBe(true);
	});

	test("rejeita CPF com letra", () => {
		expect(isValidCpfCnpj("5299822472A")).toBe(false);
	});

	test("aceita CPF válido (11 dígitos)", () => {
		expect(isValidCpfCnpj("52998224725")).toBe(true);
	});

	test("aceita CNPJ válido (14 dígitos)", () => {
		expect(isValidCpfCnpj("11222333000181")).toBe(true);
	});

	test("rejeita comprimento intermediário (12 dígitos)", () => {
		expect(isValidCpfCnpj("123456789012")).toBe(false);
	});

	test("rejeita CPF inválido passado como isValidCpfCnpj", () => {
		expect(isValidCpfCnpj("52998224724")).toBe(false);
	});

	test("rejeita CNPJ inválido passado como isValidCpfCnpj", () => {
		expect(isValidCpfCnpj("11222333000182")).toBe(false);
	});
});

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
