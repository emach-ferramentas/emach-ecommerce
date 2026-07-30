// Fallback: a home nunca fica sem hero quando não há banner ativo no banco.
// Cada um carrega composition literal split-equivalente (spec 2026-07-30) e
// passa pelo renderer novo — nenhum caminho legado sobrevive pelos fallbacks.
import type { HeroBanner } from "@/components/hero-carousel";

const FALLBACK_COMPOSITION: NonNullable<HeroBanner["composition"]> = {
	version: 1,
	desktop: {
		background: { zoom: 100, focal: "mc" },
		elements: {
			product: { anchor: "mr", offsetX: -1, offsetY: 0, scale: 100 },
			cta: { anchor: "br", offsetX: -2, offsetY: 0, scale: 100 },
		},
	},
	mobile: { elements: {} },
};

export const FALLBACK_BANNERS: HeroBanner[] = [
	{
		id: "fallback-01",
		backgroundImageUrl: "/images/hero-imagens/emach_hero_01_bg.png",
		backgroundImageMobileUrl: null,
		backgroundMobileMode: "inherit",
		productImageUrl: "/images/hero-imagens/emach_hero_01_product.png",
		productImageMobileUrl: null,
		title: null,
		subtitle: null,
		specs: null,
		altText: "EMACH — Potência redefinida",
		ctaLabel: "Ver Catálogo",
		ctaHref: "/catalog",
		ctaVariant: "red",
		layout: "split",
		badgeText: null,
		productScale: 100,
		ctaScale: 100,
		countdownTarget: null,
		composition: FALLBACK_COMPOSITION,
	},
	{
		id: "fallback-02",
		backgroundImageUrl: "/images/hero-imagens/emach_hero_02_bg.png",
		backgroundImageMobileUrl: null,
		backgroundMobileMode: "inherit",
		productImageUrl: "/images/hero-imagens/emach_hero_02_product.png",
		productImageMobileUrl: null,
		title: null,
		subtitle: null,
		specs: null,
		altText: "EMACH — Linha profissional",
		ctaLabel: "Ver Catálogo",
		ctaHref: "/catalog",
		ctaVariant: "red",
		layout: "split",
		badgeText: null,
		productScale: 100,
		ctaScale: 100,
		countdownTarget: null,
		composition: FALLBACK_COMPOSITION,
	},
];
