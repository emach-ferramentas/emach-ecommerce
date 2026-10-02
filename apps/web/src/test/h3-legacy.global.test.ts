import { describe, expect, it } from "vitest";
import { filesUnder, scanForLegacyTokens } from "./h3-legacy-scan";

const LEGACY_EXCEPTIONS: Readonly<Record<string, string>> = {
	"app/(shop)/product/[slug]/_components/product-info.tsx":
		"selo de oferta da PDP com tracking antigo; a PDP não foi migrada",
	"app/(shop)/product/[slug]/_components/product-reviews.tsx":
		"avaliações da PDP ainda não migradas",
	"app/(shop)/product/[slug]/_components/review-card.tsx":
		"avaliações da PDP ainda não migradas",
	"app/(shop)/product/[slug]/_components/review-list.tsx":
		"avaliações da PDP ainda não migradas",
	"app/(shop)/product/[slug]/_components/review-sort.tsx":
		"avaliações da PDP ainda não migradas",
	"app/(shop)/product/[slug]/_components/star-rating.tsx":
		"estrela vazia em gray-20; avaliações da PDP ainda não migradas",
	"app/(shop)/product/[slug]/_components/verified-badge.tsx":
		"selo de compra verificada das avaliações, ainda não migrado",
	"app/(shop)/product/[slug]/loading.tsx":
		"esqueleto da PDP em bg-gray-20, ainda não migrado",
	"components/hero-carousel.tsx":
		"hero congelado por decisão do dono: pontos e setas sobre a foto",
	"components/hero/hero-cta-variants.ts":
		"hero congelado por decisão do dono: cópia do botão antigo",
	"components/hero/hero-element-renders.tsx":
		"hero congelado por decisão do dono",
	"components/product-image.tsx":
		"poço de foto vazia (emach-bg-placeholder, cinema-2), usado no card e no carrinho",
	"components/product-rating.tsx":
		"estrelas do card em gray-20 e white/30, ainda não migradas",
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
