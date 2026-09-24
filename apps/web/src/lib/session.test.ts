import { beforeEach, describe, expect, it, vi } from "vitest";

// redirect() lança no Next (interrompe o render). Replicamos isso para garantir
// que a guarda realmente impede o retorno da sessão quando não há login.
const { getSession, redirect } = vi.hoisted(() => ({
	getSession: vi.fn(),
	redirect: vi.fn((path: string) => {
		throw new Error(`NEXT_REDIRECT:${path}`);
	}),
}));

vi.mock("@emach/auth/ecommerce", () => ({
	authEcommerce: { api: { getSession } },
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/navigation", () => ({
	redirect: (path: string) => redirect(path),
}));

import { getCurrentClient, requireCurrentClient } from "./session";

const fakeSession = {
	user: { id: "c1", email: "a@b.com", name: "A", image: null },
	session: { id: "s1" },
};

describe("requireCurrentClient", () => {
	beforeEach(() => {
		getSession.mockReset();
		redirect.mockClear();
	});

	it("redireciona para /login quando não há sessão", async () => {
		getSession.mockResolvedValue(null);
		await expect(requireCurrentClient()).rejects.toThrow(
			"NEXT_REDIRECT:/login"
		);
		expect(redirect).toHaveBeenCalledWith("/login");
	});

	it("redireciona para /login quando a sessão existe mas não tem user (token forjado/adulterado)", async () => {
		// Better Auth retorna null em token inválido; cobrimos também o caso
		// defensivo de um objeto sem `user`.
		getSession.mockResolvedValue({ session: { id: "s1" }, user: null });
		await expect(requireCurrentClient()).rejects.toThrow(
			"NEXT_REDIRECT:/login"
		);
		expect(redirect).toHaveBeenCalledWith("/login");
	});

	it("preserva o caminho de retorno no mesmo parâmetro que o proxy usa", async () => {
		getSession.mockResolvedValue(null);
		await expect(
			requireCurrentClient("/dashboard/pedidos/abc?aba=itens")
		).rejects.toThrow(
			"NEXT_REDIRECT:/login?redirect=%2Fdashboard%2Fpedidos%2Fabc%3Faba%3Ditens"
		);
	});

	it("ignora caminho de retorno inseguro e cai no /login puro", async () => {
		getSession.mockResolvedValue(null);
		await expect(requireCurrentClient("/\t/evil.com")).rejects.toThrow(
			"NEXT_REDIRECT:/login"
		);
		expect(redirect).toHaveBeenCalledWith("/login");
	});

	it("retorna a sessão e não redireciona quando o cliente está logado", async () => {
		getSession.mockResolvedValue(fakeSession);
		const session = await requireCurrentClient();
		expect(session).toEqual(fakeSession);
		expect(redirect).not.toHaveBeenCalled();
	});
});

describe("getCurrentClient", () => {
	beforeEach(() => getSession.mockReset());

	it("não redireciona — devolve null quando não há sessão", async () => {
		getSession.mockResolvedValue(null);
		await expect(getCurrentClient()).resolves.toBeNull();
		expect(redirect).not.toHaveBeenCalled();
	});
});
