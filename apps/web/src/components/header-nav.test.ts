import { describe, expect, it } from "vitest";
import { isNavActive } from "./header-nav";

describe("isNavActive", () => {
	it("marca a própria rota", () => {
		expect(isNavActive("/catalog", "/catalog")).toBe(true);
		expect(isNavActive("/sobre", "/sobre")).toBe(true);
	});

	it("marca a seção pai numa subpágina", () => {
		expect(isNavActive("/catalog", "/catalog/eletricas")).toBe(true);
	});

	it("não confunde prefixo de texto com segmento de rota", () => {
		expect(isNavActive("/catalog", "/catalogo")).toBe(false);
	});

	it("casa link com hash só por igualdade", () => {
		expect(isNavActive("/sobre#filiais", "/sobre#filiais")).toBe(true);
		expect(isNavActive("/sobre#filiais", "/sobre")).toBe(false);
	});

	it("não marca Sobre quando Filiais está ativo", () => {
		expect(isNavActive("/sobre", "/sobre#filiais")).toBe(false);
	});
});
