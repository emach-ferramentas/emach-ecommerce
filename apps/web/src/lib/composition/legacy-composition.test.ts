import { afterEach, describe, expect, it, vi } from "vitest";
import {
	deriveHasFlagsFromBanner,
	legacyToComposition,
	type ResolvableBanner,
	resolveComposition,
} from "./legacy-composition";

const ALL_ON = {
	productScale: 140,
	ctaScale: 120,
	hasTitle: true,
	hasSubtitle: true,
	hasBadge: true,
	hasSpecs: true,
	hasCountdown: true,
	hasProduct: true,
	hasCta: true,
} as const;

describe("legacyToComposition", () => {
	it("split → título bl (maxWidth 44), produto mr, cta br", () => {
		const c = legacyToComposition({ ...ALL_ON, layout: "split" });
		expect(c.version).toBe(1);
		expect(c.desktop.background).toEqual({ zoom: 100, focal: "mc" });
		expect(c.desktop.elements.title).toEqual({
			anchor: "bl",
			offsetX: 0,
			offsetY: 0,
			scale: 100,
			maxWidth: 44,
		});
		expect(c.desktop.elements.product).toEqual({
			anchor: "mr",
			offsetX: 0,
			offsetY: 0,
			scale: 140,
		});
		expect(c.desktop.elements.cta).toEqual({
			anchor: "br",
			offsetX: 0,
			offsetY: 0,
			scale: 120,
		});
		expect(c.mobile.elements).toEqual({});
	});

	it("badge/specs/subtitle/countdown acompanham a âncora do título", () => {
		const c = legacyToComposition({ ...ALL_ON, layout: "mirror_split" });
		expect(c.desktop.elements.badge?.anchor).toBe("mr");
		expect(c.desktop.elements.specs?.anchor).toBe("mr");
		expect(c.desktop.elements.subtitle?.anchor).toBe("mr");
		expect(c.desktop.elements.countdown?.anchor).toBe("mr");
	});

	it("center_mid não tem slot de produto — omite mesmo com hasProduct", () => {
		const c = legacyToComposition({ ...ALL_ON, layout: "center_mid" });
		expect(c.desktop.elements.product).toBeUndefined();
	});

	it("flag desligada = elemento ausente", () => {
		const c = legacyToComposition({
			...ALL_ON,
			layout: "split",
			hasTitle: false,
			hasBadge: false,
			hasSpecs: false,
			hasSubtitle: false,
			hasCountdown: false,
		});
		expect(Object.keys(c.desktop.elements).sort()).toEqual(["cta", "product"]);
	});

	it("trios dos 8 layouts batem com o mapa legado do LAYOUT_CONFIG", () => {
		const trios: Record<string, [string, string | null, string]> = {
			split: ["bl", "mr", "br"],
			stack_left: ["bl", "mr", "bc"],
			center_bottom: ["bc", "tc", "bc"],
			center_mid: ["mc", null, "bc"],
			center_cta_right: ["ml", "tc", "br"],
			mirror_split: ["mr", "ml", "br"],
			hero_center: ["tc", "mc", "bc"],
			text_right: ["tc", "mc", "br"],
		};
		for (const [layout, [title, product, cta]] of Object.entries(trios)) {
			const c = legacyToComposition({
				...ALL_ON,
				layout: layout as Parameters<typeof legacyToComposition>[0]["layout"],
			});
			expect(c.desktop.elements.title?.anchor, layout).toBe(title);
			expect(c.desktop.elements.product?.anchor ?? null, layout).toBe(product);
			expect(c.desktop.elements.cta?.anchor, layout).toBe(cta);
		}
	});
});

describe("deriveHasFlagsFromBanner", () => {
	it("specs vazio = false; cta exige label E href", () => {
		const flags = deriveHasFlagsFromBanner({
			title: "t",
			subtitle: null,
			badgeText: null,
			specs: [],
			countdownTarget: null,
			productImageUrl: "/p.png",
			ctaLabel: "Ver",
			ctaHref: null,
		});
		expect(flags).toEqual({
			hasTitle: true,
			hasSubtitle: false,
			hasBadge: false,
			hasSpecs: false,
			hasCountdown: false,
			hasProduct: true,
			hasCta: false,
		});
	});
});

const makeBanner = (
	over: Partial<ResolvableBanner> = {}
): ResolvableBanner => ({
	id: "b1",
	composition: null,
	layout: "center_cta_right",
	productScale: 140,
	ctaScale: 100,
	title: null,
	subtitle: null,
	badgeText: null,
	specs: null,
	countdownTarget: null,
	productImageUrl: "/p.png",
	ctaLabel: "Ver Catálogo",
	ctaHref: "/catalog",
	...over,
});

const VALID = {
	version: 1,
	desktop: {
		background: { zoom: 100, focal: "mc" },
		elements: {
			product: { anchor: "tc", offsetX: 0, offsetY: 0, scale: 140 },
			cta: { anchor: "br", offsetX: 0, offsetY: 0, scale: 100 },
		},
	},
	mobile: { elements: {} },
} as const;

describe("resolveComposition", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("composition válida passa direto, sem log", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const c = resolveComposition(makeBanner({ composition: VALID }));
		expect(c.desktop.elements.product?.scale).toBe(140);
		expect(spy).not.toHaveBeenCalled();
	});

	it("NULL converte do legado em silêncio (center_cta_right → tc/br)", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const c = resolveComposition(makeBanner());
		expect(c.desktop.elements.product?.anchor).toBe("tc");
		expect(c.desktop.elements.product?.scale).toBe(140);
		expect(c.desktop.elements.cta?.anchor).toBe("br");
		expect(spy).not.toHaveBeenCalled();
	});

	it("inválida não-nula converte E loga com bannerId", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const bad = {
			...VALID,
			version: 2,
		} as unknown as ResolvableBanner["composition"];
		const c = resolveComposition(makeBanner({ composition: bad }));
		expect(c.desktop.elements.product?.anchor).toBe("tc");
		expect(spy).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(spy.mock.calls[0])).toContain("b1");
	});
});
