// Conversão legado (layout/productScale/ctaScale) → composition v1 e resolução
// do que veio do banco — port do derive-legacy.ts do emach-dashboard (mesma
// derivação do backfill oficial). A direção inversa (deriveLegacyLayout) é do
// dual-write do dashboard e não existe aqui.
import type { Banner } from "@emach/db/schema/banner";
import {
	type Anchor9,
	type BannerComposition,
	compositionSchema,
	type ElementPlacement,
} from "./composition-schema";

interface Trio {
	cta: Anchor9;
	product: Anchor9 | null;
	title: Anchor9;
}

// Fonte única do mapeamento (espelha o LAYOUT_CONFIG removido na #210).
const LEGACY_TRIO: Record<Banner["layout"], Trio> = {
	split: { title: "bl", product: "mr", cta: "br" },
	stack_left: { title: "bl", product: "mr", cta: "bc" },
	center_bottom: { title: "bc", product: "tc", cta: "bc" },
	center_mid: { title: "mc", product: null, cta: "bc" },
	center_cta_right: { title: "ml", product: "tc", cta: "br" },
	mirror_split: { title: "mr", product: "ml", cta: "br" },
	hero_center: { title: "tc", product: "mc", cta: "bc" },
	text_right: { title: "tc", product: "mc", cta: "br" },
};

const p = (
	anchor: Anchor9,
	scale = 100,
	maxWidth?: number
): ElementPlacement =>
	maxWidth === undefined
		? { anchor, offsetX: 0, offsetY: 0, scale }
		: { anchor, offsetX: 0, offsetY: 0, scale, maxWidth };

type HasFlagsSource = Pick<
	Banner,
	| "title"
	| "subtitle"
	| "badgeText"
	| "specs"
	| "countdownTarget"
	| "productImageUrl"
	| "ctaLabel"
	| "ctaHref"
>;

export function deriveHasFlagsFromBanner(banner: HasFlagsSource): {
	hasTitle: boolean;
	hasSubtitle: boolean;
	hasBadge: boolean;
	hasSpecs: boolean;
	hasCountdown: boolean;
	hasProduct: boolean;
	hasCta: boolean;
} {
	return {
		hasTitle: banner.title !== null,
		hasSubtitle: banner.subtitle !== null,
		hasBadge: banner.badgeText !== null,
		hasSpecs: banner.specs !== null && banner.specs.length > 0,
		hasCountdown: banner.countdownTarget !== null,
		hasProduct: banner.productImageUrl !== null,
		// AND: elemento cta na composition = renderizável (label+href juntos).
		hasCta: banner.ctaLabel !== null && banner.ctaHref !== null,
	};
}

export function legacyToComposition(input: {
	layout: Banner["layout"];
	productScale: number;
	ctaScale: number;
	hasTitle: boolean;
	hasSubtitle: boolean;
	hasBadge: boolean;
	hasSpecs: boolean;
	hasCountdown: boolean;
	hasProduct: boolean;
	hasCta: boolean;
}): BannerComposition {
	const trio = LEGACY_TRIO[input.layout];
	const elements: BannerComposition["desktop"]["elements"] = {};
	// Badge/specs/countdown/subtítulo acompanham o bloco do título no legado.
	if (input.hasBadge) {
		elements.badge = p(trio.title);
	}
	if (input.hasTitle) {
		elements.title = p(trio.title, 100, 44);
	}
	if (input.hasSpecs) {
		elements.specs = p(trio.title, 100, 44);
	}
	if (input.hasSubtitle) {
		elements.subtitle = p(trio.title, 100, 44);
	}
	if (input.hasCountdown) {
		elements.countdown = p(trio.title);
	}
	if (input.hasProduct && trio.product !== null) {
		// center_mid não tem slot de produto no legado — omitir, não inventar.
		elements.product = p(trio.product, input.productScale);
	}
	if (input.hasCta) {
		elements.cta = p(trio.cta, input.ctaScale);
	}
	return {
		version: 1,
		desktop: { background: { zoom: 100, focal: "mc" }, elements },
		mobile: { elements: {} },
	};
}

export type ResolvableBanner = Pick<
	Banner,
	| "id"
	| "composition"
	| "layout"
	| "productScale"
	| "ctaScale"
	| "title"
	| "subtitle"
	| "badgeText"
	| "specs"
	| "countdownTarget"
	| "productImageUrl"
	| "ctaLabel"
	| "ctaHref"
>;

// Resolve a composition de um banner: válida → usa; NULL (pré-backfill) →
// converte silencioso; inválida não-nula (drift/version futura) → converte E
// loga — sem o log, um drift renderizaria aproximação pra sempre sem ninguém
// perceber (issue #210, adendo 2). Nunca lança, nunca retorna null.
export function resolveComposition(
	banner: ResolvableBanner
): BannerComposition {
	if (banner.composition !== null) {
		const parsed = compositionSchema.safeParse(banner.composition);
		if (parsed.success) {
			return parsed.data;
		}
		// console.error direto (não evlog): roda em client component, evlog é
		// server-only — noConsole está "off" no preset ultracite deste repo
		// (config/biome/core), então nenhum biome-ignore é necessário/efetivo
		// aqui. Único console permitido no app; sinal operacional de schema
		// drift, exceção registrada na spec 2026-07-30.
		console.error("[hero] composition inválida; usando conversão legada", {
			bannerId: banner.id,
			issues: parsed.error.issues.slice(0, 5),
		});
	}
	return legacyToComposition({
		layout: banner.layout,
		productScale: banner.productScale,
		ctaScale: banner.ctaScale,
		...deriveHasFlagsFromBanner(banner),
	});
}
