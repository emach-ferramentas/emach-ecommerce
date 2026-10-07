import { describe, expect, it } from "vitest";
import { filesUnder, scanForLegacyTokens } from "./h3-legacy-scan";

const LEGACY_EXCEPTIONS: Readonly<Record<string, string>> = {
	"components/hero-carousel.tsx":
		"hero congelado por decisão do dono: pontos e setas sobre a foto",
	"components/hero/hero-cta-variants.ts":
		"hero congelado por decisão do dono: cópia do botão antigo",
	"components/hero/hero-element-renders.tsx":
		"hero congelado por decisão do dono",
};

const FILES = filesUnder(".").filter((file) => !file.startsWith("test/"));
const FILES_WITH_HITS = new Set(
	scanForLegacyTokens(FILES).map(({ file }) => file)
);

describe("token visual anterior ao H3 em apps/web/src", () => {
	it("varre a árvore inteira", () => {
		expect(FILES).toContain("app/checkout/_components/checkout-content.tsx");
		expect(FILES).toContain("components/product-image.tsx");
	});

	it("só aparece nos arquivos da lista de exceções", () => {
		const unexpected = [...FILES_WITH_HITS].filter(
			(file) => !(file in LEGACY_EXCEPTIONS)
		);
		expect(unexpected).toEqual([]);
	});

	it("toda exceção ainda tem achado (exceção limpa sai da lista)", () => {
		const clean = Object.keys(LEGACY_EXCEPTIONS).filter(
			(file) => !FILES_WITH_HITS.has(file)
		);
		expect(clean).toEqual([]);
	});
});
