import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Entre duas páginas da conta o layout /dashboard já está montado, e o
// <Suspense> dele fica acima do que a navegação re-renderiza. Página que faz
// `await` de dado no topo trava a troca de página até o servidor responder
// (aviso "uncached data during a navigation" do Next 16). Cada página tem que
// ser síncrona e pôr o dado sob o próprio <Suspense>. Lê o source, como o
// layout.guard.test.ts.

const dashboardDir = dirname(fileURLToPath(import.meta.url));
const ASYNC_PAGE = /export default async function/;

const pages = readdirSync(dashboardDir, { encoding: "utf8", recursive: true })
	.filter((path) => path.endsWith("page.tsx"))
	.sort();

describe("páginas de /dashboard navegam sem bloquear", () => {
	it("acha as páginas da conta", () => {
		expect(pages).toContain("page.tsx");
		expect(pages).toContain("pedidos/[id]/page.tsx");
	});

	for (const page of pages) {
		it(`${page} é síncrona e põe o dado sob <Suspense>`, () => {
			const source = readFileSync(join(dashboardDir, page), "utf8");
			expect(source).not.toMatch(ASYNC_PAGE);
			expect(source).toContain("<Suspense");
		});
	}
});
