import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runEvlog } = vi.hoisted(() => ({ runEvlog: vi.fn() }));
vi.mock("evlog/next", () => ({ evlogMiddleware: () => runEvlog }));

import { proxy } from "./proxy";

const ORIGIN = "https://www.emachferramentas.com.br";

describe("proxy — categoria legada", () => {
	beforeEach(() => {
		runEvlog.mockReset();
		runEvlog.mockResolvedValue(new Response(null, { status: 200 }));
	});

	it("308 de /catalog?cat=X para /catalog/X preservando os demais params", async () => {
		const res = await proxy(
			new NextRequest(`${ORIGIN}/catalog?cat=serras&sort=price-asc`)
		);
		expect(res.status).toBe(308);
		expect(res.headers.get("location")).toBe(
			`${ORIGIN}/catalog/serras?sort=price-asc`
		);
		expect(runEvlog).not.toHaveBeenCalled();
	});

	it("sem cat segue o fluxo normal", async () => {
		const res = await proxy(new NextRequest(`${ORIGIN}/catalog?sort=newest`));
		expect(res.status).toBe(200);
		expect(runEvlog).toHaveBeenCalledOnce();
	});

	it("rota protegida sem cookie redireciona para /login antes de tudo", async () => {
		const res = await proxy(new NextRequest(`${ORIGIN}/dashboard/pedidos`));
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toBe(
			`${ORIGIN}/login?redirect=%2Fdashboard%2Fpedidos`
		);
	});
});
