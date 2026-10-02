import { describe, expect, it } from "vitest";
import { isAccountNavActive, NAV_ITEMS } from "./nav-items";

function activeLabels(pathname: string): string[] {
	return NAV_ITEMS.filter((item) => isAccountNavActive(pathname, item)).map(
		(item) => item.label
	);
}

describe("isAccountNavActive", () => {
	it("/dashboard ativa só Início", () => {
		expect(activeLabels("/dashboard")).toEqual(["Início"]);
	});

	it("rota filha ativa a seção dona, não Início", () => {
		expect(activeLabels("/dashboard/pedidos/abc")).toEqual(["Pedidos"]);
		expect(activeLabels("/dashboard/pedidos/abc/pagar")).toEqual(["Pedidos"]);
	});

	it("prefixo sem barra não casa", () => {
		expect(activeLabels("/dashboard/pedidosx")).toEqual([]);
	});
});
