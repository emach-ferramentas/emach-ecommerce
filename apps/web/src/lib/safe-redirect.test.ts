import { describe, expect, it } from "vitest";
import { loginHref, safeRedirect } from "./safe-redirect";

const FALLBACK = "/dashboard";

describe("safeRedirect", () => {
	it.each([
		["/dashboard/pedidos?x=1", "/dashboard/pedidos?x=1"],
		["/checkout", "/checkout"],
		["/", "/"],
		["/product/parafusadeira-efp21", "/product/parafusadeira-efp21"],
	])("aceita caminho relativo da mesma origem: %j", (raw, expected) => {
		expect(safeRedirect(raw, FALLBACK)).toBe(expected);
	});

	it.each([
		["/\t/evil.com"],
		["/\n/evil.com"],
		["/\r/evil.com"],
		["//evil.com"],
		["/\\evil.com"],
		["/foo\\bar"],
		["https://evil.com"],
		["javascript:alert(1)"],
		[" /dashboard"],
		["/dash board"],
		["/\u0000/evil.com"],
		["dashboard"],
		["/product/furadeira-123#avaliacoes"],
		["/busca%20x"],
		["/a:b"],
		[""],
	])("rejeita e devolve o fallback: %j", (raw) => {
		expect(safeRedirect(raw, FALLBACK)).toBe(FALLBACK);
	});

	it.each([
		["/login"],
		["/login?x=1"],
		["/login/"],
		["/esqueci-senha"],
		["/redefinir-senha?token=abc"],
		["/verificar-email"],
	])("rota de auth não é destino e vira o fallback: %j", (raw) => {
		expect(safeRedirect(raw, FALLBACK)).toBe(FALLBACK);
	});

	it("caminho que só começa igual a uma rota de auth continua aceito", () => {
		expect(safeRedirect("/loginx", FALLBACK)).toBe("/loginx");
		expect(safeRedirect("/login-ajuda?x=1", FALLBACK)).toBe("/login-ajuda?x=1");
	});

	it("devolve o fallback quando o parâmetro não veio", () => {
		expect(safeRedirect(null, FALLBACK)).toBe(FALLBACK);
		expect(safeRedirect(undefined, "/")).toBe("/");
	});
});

describe("safeRedirect com caminho normalizado", () => {
	it.each([
		["/./login"],
		["/x/../login"],
		["/x/./../login?y=1"],
		["//login"],
		["/login"],
		["https://evil.com/login"],
	])("rota de auth disfarçada ou externa vira o fallback: %j", (raw) => {
		expect(safeRedirect(raw, FALLBACK)).toBe(FALLBACK);
	});

	it.each([
		["/loginx", "/loginx"],
		["/dashboard/pedidos?x=1", "/dashboard/pedidos?x=1"],
		["/dashboard/./pedidos", "/dashboard/pedidos"],
		["/dashboard/x/../pedidos?x=1", "/dashboard/pedidos?x=1"],
		["/dashboard//pedidos", "/dashboard/pedidos"],
		["/x/..//evil.com", "/evil.com"],
	])("devolve o caminho resolvido: %j", (raw, expected) => {
		expect(safeRedirect(raw, FALLBACK)).toBe(expected);
	});
});

describe("loginHref", () => {
	it("leva o caminho atual como redirect numa rota comum", () => {
		expect(loginHref("/dashboard/pedidos")).toEqual({
			pathname: "/login",
			query: { redirect: "/dashboard/pedidos" },
		});
	});

	it.each([
		["/login"],
		["/esqueci-senha"],
		["/./login"],
	])("não leva redirect numa rota de auth: %j", (pathname) => {
		expect(loginHref(pathname)).toEqual({ pathname: "/login" });
	});
});
