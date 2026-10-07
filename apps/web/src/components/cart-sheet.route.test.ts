import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// O header vive no StoreFrame do layout de (shop) e não desmonta entre páginas.
// Fechar a gaveta no unmount do HeaderBar deixava a gaveta aberta e o scroll
// travado ao voltar de /catalog para /. O app não tem DOM nos testes, então a
// guarda lê o source: a gaveta fecha quando o pathname muda.

const dir = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(join(dir, file), "utf8");
const CLOSE_ON_PATHNAME =
	/use(?:Layout)?Effect\(\(\) => \{\s*if \(pathname\) \{\s*onOpenChangeRef\.current\(false\);\s*\}\s*\}, \[pathname\]\)/;
const UNMOUNT_CLEANUP = /use(?:Layout)?Effect\(\(\) => \(\) =>/;

describe("gaveta do carrinho na troca de rota", () => {
	it("a CartSheet fecha quando o pathname muda", () => {
		const sheet = read("cart-sheet.tsx");
		expect(sheet).toContain("usePathname()");
		expect(sheet).toMatch(CLOSE_ON_PATHNAME);
	});

	it("o HeaderBar não depende do unmount para fechar a gaveta", () => {
		expect(read("header-bar.tsx")).not.toMatch(UNMOUNT_CLEANUP);
	});
});
