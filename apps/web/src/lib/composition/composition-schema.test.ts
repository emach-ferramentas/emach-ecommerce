import { describe, expect, it } from "vitest";
import {
	anchorBasePosition,
	type BannerComposition,
	compositionSchema,
	partitionMobileElements,
} from "./composition-schema";

const base = (): BannerComposition => ({
	version: 1,
	desktop: {
		background: { zoom: 100, focal: "mc" },
		elements: {
			title: {
				anchor: "bl",
				offsetX: 2,
				offsetY: -2,
				scale: 100,
				maxWidth: 44,
			},
			product: { anchor: "mr", offsetX: -1, offsetY: 0, scale: 140 },
			cta: { anchor: "br", offsetX: -2, offsetY: 0, scale: 100 },
		},
	},
	mobile: { elements: {} },
});

describe("compositionSchema", () => {
	it("aceita composition v1 válida, incl. offsets float", () => {
		const c = base();
		c.desktop.elements.title = {
			anchor: "bl",
			offsetX: -2.41,
			offsetY: 0.5,
			scale: 100,
			maxWidth: 44,
		};
		expect(compositionSchema.safeParse(c).success).toBe(true);
	});

	it("rejeita version 2", () => {
		expect(compositionSchema.safeParse({ ...base(), version: 2 }).success).toBe(
			false
		);
	});

	it("rejeita scale fora da faixa do elemento (cta 150 > 140)", () => {
		const c = base();
		c.desktop.elements.cta = {
			anchor: "br",
			offsetX: 0,
			offsetY: 0,
			scale: 150,
		};
		expect(compositionSchema.safeParse(c).success).toBe(false);
	});

	it("rejeita scale float (contrato: int)", () => {
		const c = base();
		c.desktop.elements.cta = {
			anchor: "br",
			offsetX: 0,
			offsetY: 0,
			scale: 110.5,
		};
		expect(compositionSchema.safeParse(c).success).toBe(false);
	});

	it("rejeita offset fora de -20..20 e âncora inválida", () => {
		const c1 = base();
		c1.desktop.elements.cta = {
			anchor: "br",
			offsetX: 25,
			offsetY: 0,
			scale: 100,
		};
		expect(compositionSchema.safeParse(c1).success).toBe(false);
		const c2 = base();
		c2.desktop.elements.cta = {
			// @ts-expect-error: âncora inválida de propósito
			anchor: "xx",
			offsetX: 0,
			offsetY: 0,
			scale: 100,
		};
		expect(compositionSchema.safeParse(c2).success).toBe(false);
	});

	it("aceita união hidden | placement nos overrides mobile", () => {
		const c = base();
		c.mobile.elements = {
			title: { hidden: true },
			cta: { anchor: "bc", offsetX: 0, offsetY: 0, scale: 100 },
		};
		expect(compositionSchema.safeParse(c).success).toBe(true);
	});

	it("aceita mobile.background opcional (zoom 100..200)", () => {
		const c = base();
		c.mobile.background = { zoom: 200, focal: "tl" };
		expect(compositionSchema.safeParse(c).success).toBe(true);
		c.mobile.background = { zoom: 250, focal: "tl" };
		expect(compositionSchema.safeParse(c).success).toBe(false);
	});
});

describe("anchorBasePosition", () => {
	it("colunas l/c/r → 5/50/95", () => {
		expect(anchorBasePosition("ml", "desktop").x).toBe(5);
		expect(anchorBasePosition("mc", "desktop").x).toBe(50);
		expect(anchorBasePosition("mr", "desktop").x).toBe(95);
	});
	it("linha b: 88 desktop, 84 mobile; t/m: 5/50", () => {
		expect(anchorBasePosition("bc", "desktop").y).toBe(88);
		expect(anchorBasePosition("bc", "mobile").y).toBe(84);
		expect(anchorBasePosition("tc", "mobile").y).toBe(5);
		expect(anchorBasePosition("mc", "mobile").y).toBe(50);
	});
});

describe("partitionMobileElements", () => {
	it("sem override → stacked, na ordem SAFE_STACK_ORDER", () => {
		const p = partitionMobileElements(base());
		expect(p.stacked).toEqual(["title", "product", "cta"]);
		expect(p.positioned).toEqual([]);
		expect(p.hidden).toEqual([]);
	});
	it("hidden e placement saem da pilha", () => {
		const c = base();
		c.mobile.elements = {
			title: { hidden: true },
			cta: { anchor: "bc", offsetX: 0, offsetY: 0, scale: 100 },
		};
		const p = partitionMobileElements(c);
		expect(p.stacked).toEqual(["product"]);
		expect(p.hidden).toEqual(["title"]);
		expect(p.positioned).toEqual([
			["cta", { anchor: "bc", offsetX: 0, offsetY: 0, scale: 100 }],
		]);
	});
	it("override de key ausente no desktop é ignorado", () => {
		const c = base();
		c.mobile.elements = {
			badge: { anchor: "tc", offsetX: 0, offsetY: 0, scale: 100 },
		};
		expect(partitionMobileElements(c).positioned).toEqual([]);
	});
});
