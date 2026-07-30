import { describe, expect, it } from "vitest";
import type { BannerComposition } from "./composition-schema";
import {
	backgroundToStyle,
	focalToObjectPosition,
	GRADIENT_CLASS,
	placementToStyle,
	textSide,
} from "./placement-css";

describe("placementToStyle", () => {
	it("br desktop: base 95/88 + offset, translate -100%, origin 100%", () => {
		const s = placementToStyle(
			{ anchor: "br", offsetX: -2, offsetY: 0, scale: 120 },
			"desktop"
		);
		expect(s.left).toBe("93%");
		expect(s.top).toBe("88%");
		expect(s.transform).toBe("translate(-100%, -100%) scale(1.2)");
		expect(s.transformOrigin).toBe("100% 100%");
		expect(s.maxWidth).toBeUndefined();
	});

	it("mc mobile: base 50/50, translate -50%, scale 1", () => {
		const s = placementToStyle(
			{ anchor: "mc", offsetX: 0, offsetY: 0, scale: 100 },
			"mobile"
		);
		expect(s.left).toBe("50%");
		expect(s.top).toBe("50%");
		expect(s.transform).toBe("translate(-50%, -50%) scale(1)");
		expect(s.transformOrigin).toBe("50% 50%");
	});

	it("linha b no mobile parte de 84; offsets float interpolam", () => {
		const s = placementToStyle(
			{ anchor: "bl", offsetX: 2.5, offsetY: -1.5, scale: 100 },
			"mobile"
		);
		expect(s.left).toBe("7.5%");
		expect(s.top).toBe("82.5%");
	});

	it("maxWidth vira ch", () => {
		const s = placementToStyle(
			{ anchor: "tl", offsetX: 0, offsetY: 0, scale: 100, maxWidth: 44 },
			"desktop"
		);
		expect(s.maxWidth).toBe("44ch");
	});
});

describe("fundo", () => {
	it("focal mapeia pra % nos dois eixos", () => {
		expect(focalToObjectPosition("tl")).toBe("0% 0%");
		expect(focalToObjectPosition("mc")).toBe("50% 50%");
		expect(focalToObjectPosition("br")).toBe("100% 100%");
	});
	it("zoom vira scale com origin no focal", () => {
		const s = backgroundToStyle({ zoom: 150, focal: "tr" });
		expect(s.transform).toBe("scale(1.5)");
		expect(s.transformOrigin).toBe("100% 0%");
	});
});

describe("textSide + gradiente", () => {
	const c = (
		title?: "tl" | "tr" | "tc",
		subtitle?: "bl" | "br"
	): BannerComposition => ({
		version: 1,
		desktop: {
			background: { zoom: 100, focal: "mc" },
			elements: {
				...(title && {
					title: { anchor: title, offsetX: 0, offsetY: 0, scale: 100 },
				}),
				...(subtitle && {
					subtitle: { anchor: subtitle, offsetX: 0, offsetY: 0, scale: 100 },
				}),
			},
		},
		mobile: { elements: {} },
	});
	it("coluna da âncora do título decide", () => {
		expect(textSide(c("tl"))).toBe("left");
		expect(textSide(c("tr"))).toBe("right");
		expect(textSide(c("tc"))).toBe("center");
	});
	it("fallback subtitle; center sem nenhum", () => {
		expect(textSide(c(undefined, "br"))).toBe("right");
		expect(textSide(c())).toBe("center");
	});
	it("mapa do gradiente: l→to-r, r→to-l, c→to-t (classes lg:)", () => {
		expect(GRADIENT_CLASS.left).toContain("lg:bg-gradient-to-r");
		expect(GRADIENT_CLASS.right).toContain("lg:bg-gradient-to-l");
		expect(GRADIENT_CLASS.center).toContain("lg:bg-gradient-to-t");
	});
});
