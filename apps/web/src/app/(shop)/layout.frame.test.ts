import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guarda estrutural da #238: a moldura da loja (header, único
// <main id="main-content"> e rodapé) vem do `StoreFrame` montado no layout de
// (shop). Página ou loading que monta o próprio header ou o próprio <main>
// duplica os dois no DOM e remonta o header a cada navegação.

const shopDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(shopDir, "../..");
const TEST_FILE = /\.test\.tsx?$/;
const MAIN_TAG = /<main[\s>]/;
// O grupo impede que este arquivo case com a busca literal da tag, que é o
// critério de aceite da #238.
const HEADER_TAG = /<(?:SiteHeader)[\s/>]/;

function sourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...sourceFiles(path));
		} else if (entry.name.endsWith(".tsx") && !TEST_FILE.test(entry.name)) {
			files.push(path);
		}
	}
	return files;
}

function filesMatching(dir: string, pattern: RegExp | string): string[] {
	return sourceFiles(dir)
		.filter((file) => {
			const text = readFileSync(file, "utf8");
			return typeof pattern === "string"
				? text.includes(pattern)
				: pattern.test(text);
		})
		.map((file) => relative(srcDir, file));
}

describe("moldura de (shop) (#238)", () => {
	it("o layout de (shop) monta o StoreFrame", () => {
		const layout = readFileSync(join(shopDir, "layout.tsx"), "utf8");
		expect(layout).toContain("<StoreFrame>");
	});

	it("só o StoreFrame monta o SiteHeader", () => {
		expect(filesMatching(srcDir, HEADER_TAG)).toEqual([
			"components/store-frame.tsx",
		]);
	});

	it("nenhuma página, loading ou componente de (shop) abre <main>", () => {
		expect(filesMatching(shopDir, MAIN_TAG)).toEqual([]);
	});

	it("nenhum arquivo de (shop) repete o alvo do pular-conteúdo", () => {
		expect(filesMatching(shopDir, 'id="main-content"')).toEqual([]);
	});
});
