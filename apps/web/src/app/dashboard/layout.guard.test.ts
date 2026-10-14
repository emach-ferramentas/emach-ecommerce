import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guarda estrutural da issue #98: toda página sob /dashboard deve herdar a
// proteção de um layout que chama `requireCurrentClient()`. Este teste falha se
// alguém remover a guarda do layout raiz — a regressão exata que a issue teme
// (página nova renderizando para não-autenticados). Lê o source, não executa o
// RSC, então é barato e independente do runtime do Next.

const dashboardDir = dirname(fileURLToPath(import.meta.url));
const GUARD = "requireCurrentClient";

describe("guarda estrutural de /dashboard (#98)", () => {
	it("o DashboardChrome chama requireCurrentClient() de verdade", () => {
		// Sob cacheComponents a guarda migrou do layout para o DashboardChrome
		// (sob Suspense). Checamos a CHAMADA real (não só a string), senão um
		// refactor que removesse a guarda passaria invisível pelo CI.
		const chrome = readFileSync(
			join(dashboardDir, "_components/dashboard-chrome.tsx"),
			"utf8"
		);

		expect(chrome).toContain(`await ${GUARD}()`);
	});

	it("o layout raiz monta o DashboardChrome (guarda herdada por toda página)", () => {
		const layout = readFileSync(join(dashboardDir, "layout.tsx"), "utf8");
		expect(layout).toContain("DashboardChrome");
	});

	it("requireCurrentClient valida a sessão real (não só o cookie)", () => {
		// A guarda precisa chamar getSession do Better Auth — checar só a
		// existência do cookie (como o proxy faz no edge) não basta na camada
		// que renderiza dados sensíveis.
		const session = readFileSync(
			resolve(dashboardDir, "../../lib/session.ts"),
			"utf8"
		);

		expect(session).toContain("authEcommerce.api.getSession");
		expect(session).toContain('redirect("/login")');
	});
});
