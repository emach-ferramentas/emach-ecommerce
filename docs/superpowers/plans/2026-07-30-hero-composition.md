# Hero por `banner.composition` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O hero da home renderiza por `banner.composition` (builder por elemento, issue #210), com renderer único e sem `LAYOUT_CONFIG`.

**Architecture:** Lib pura `apps/web/src/lib/composition/` (schema zod v4, placement CSS, conversão legada + `resolveComposition`) + componentes `apps/web/src/components/hero/` (`hero-element-renders.tsx`, `hero-slide.tsx`, `hero-safe-stack.tsx`, `hero-fallbacks.ts`). `hero-carousel.tsx` emagrece pra orquestrador (carousel/autoplay/dots/pause/parallax/h1 intactos) e resolve a composition **por slide no client**; a query da home não muda (`select()` já traz a coluna).

**Tech Stack:** Next 16 (App Router), React 19 + React Compiler, zod **v4.3.6** (canônico do dashboard é v3 — adaptar idioms: `z.int()` no lugar de `z.number().int()`), framer-motion (LazyMotion), Tailwind v4, vitest (node env).

**Spec:** `docs/superpowers/specs/2026-07-30-hero-composition-design.md` (revisada pelo user — autoridade) · Issue: #210

## Global Constraints

- Monorepo turbo/bun; CWD é a **raiz** — nunca `cd apps/web`; comandos com paths absolutos ou `--filter=web`.
- PROIBIDO: `: any`/`as any`/`@ts-ignore`, `key={index}`, `<img>` puro, `React.forwardRef`, `useMemo`/`useCallback` manuais (React Compiler), barrel files em `apps/web/src`. `console.*` é banido **exceto** o único `console.error` do `resolveComposition` (client code sem logger próprio — exceção prevista na spec, com `biome-ignore` justificado; evlog é server-only).
- **Banco único dev=prod compartilhado.** NENHUM write direto no banco por este plano; os banners de teste da Task 9 são criados/deletados **pela UI do dashboard** (spec F5). Fallback SQL só se a UI travar (writes exatos autorizados pelo user em 2026-07-30, escopo na Task 9). Leituras livres.
- Testes novos são **unit (sem DB)**, colocated (padrão `hero-specs.test.ts`) — NÃO adicionar à lista `INTEGRATION` de `apps/web/vitest.config.ts`; devem rodar no CI.
- Commits: Conventional Commits em PT, subject ≤50 chars. ZERO atribuição de AI em qualquer texto.
- Offsets podem ser **float** (-20..20) — nenhuma validação assume `int`. Escalas/maxWidth/zoom são `int`.
- Ordem de render/z = `SAFE_STACK_ORDER` fixo (nunca `Object.keys` de jsonb).
- Após terminar edits de código: `bun check-types` na raiz.

---

### Task 1: `lib/composition/composition-schema.ts` — contrato zod + partição/âncora

**Files:**
- Create: `apps/web/src/lib/composition/composition-schema.ts`
- Test: `apps/web/src/lib/composition/composition-schema.test.ts`

**Interfaces:**
- Produces: `compositionSchema` (zod v4); tipos `BannerComposition`, `ElementKey`, `ElementPlacement`, `BackgroundConfig`, `MobileOverride`, `Viewport`, `Anchor9`; constantes `ANCHORS`, `ELEMENT_KEYS`, `SCALE_BOUNDS`, `SAFE_STACK_ORDER`; funções `anchorBasePosition(anchor, viewport): {x, y}` e `partitionMobileElements(c): {stacked, positioned, hidden}`. Sem clamps/bounds de editor (`clampOffsets`, `SAFE_AREA`, `DEFAULT_COMPOSITION` NÃO vêm — o dado chega clampado; o parse valida estrutura e faixas).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/composition/composition-schema.test.ts
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
			title: { anchor: "bl", offsetX: 2, offsetY: -2, scale: 100, maxWidth: 44 },
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
		c.desktop.elements.cta = { anchor: "br", offsetX: 0, offsetY: 0, scale: 150 };
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
		c1.desktop.elements.cta = { anchor: "br", offsetX: 25, offsetY: 0, scale: 100 };
		expect(compositionSchema.safeParse(c1).success).toBe(false);
		const c2 = base();
		// @ts-expect-error: âncora inválida de propósito
		c2.desktop.elements.cta = { anchor: "xx", offsetX: 0, offsetY: 0, scale: 100 };
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter=web test src/lib/composition/composition-schema.test.ts`
Expected: FAIL (módulo `./composition-schema` não existe)

- [ ] **Step 3: Write minimal implementation** — port do `composition-schema.ts` do dashboard adaptado a zod v4 (`z.int()`), sem os utilitários de editor:

```ts
// apps/web/src/lib/composition/composition-schema.ts
// Contrato banner.composition v1 (issue #210). Port de leitura do módulo
// composition/ do emach-dashboard — o canônico vive lá (ADR-0009); nomes
// espelhados pra diff futuro. Sem clampOffsets/SAFE_AREA/DEFAULT_COMPOSITION
// (utilitários do editor): o dado chega validado e clampado; aqui o parse
// valida estrutura e faixas.
import { z } from "zod";

export const ANCHORS = [
	"tl",
	"tc",
	"tr",
	"ml",
	"mc",
	"mr",
	"bl",
	"bc",
	"br",
] as const;
export type Anchor9 = (typeof ANCHORS)[number];

export const ELEMENT_KEYS = [
	"badge",
	"title",
	"subtitle",
	"specs",
	"countdown",
	"product",
	"cta",
] as const;
export type ElementKey = (typeof ELEMENT_KEYS)[number];

export const SCALE_BOUNDS: Record<ElementKey, [number, number]> = {
	badge: [60, 160],
	title: [60, 160],
	subtitle: [60, 160],
	specs: [60, 160],
	countdown: [60, 160],
	product: [50, 160],
	cta: [80, 140],
};

// Offsets aceitam float (contrato: number em -20..20; dados antigos carregam
// ex. -2.41). Escalas/maxWidth/zoom são int.
const OFFSET = z.number().min(-20).max(20);

function basePlacementShape(scale: [number, number]) {
	return {
		anchor: z.enum(ANCHORS),
		offsetX: OFFSET,
		offsetY: OFFSET,
		scale: z.int().min(scale[0]).max(scale[1]),
	};
}

function placementSchema(scale: [number, number]) {
	return z.object(basePlacementShape(scale));
}

function textPlacementSchema(scale: [number, number]) {
	return z.object({
		...basePlacementShape(scale),
		maxWidth: z.int().min(12).max(80).optional(),
	});
}

const textPlacement = textPlacementSchema(SCALE_BOUNDS.title);
const productPlacement = placementSchema(SCALE_BOUNDS.product);
const ctaPlacement = placementSchema(SCALE_BOUNDS.cta);

const backgroundSchema = z.object({
	zoom: z.int().min(100).max(200),
	focal: z.enum(ANCHORS),
});

const hidden = z.object({ hidden: z.literal(true) });

const desktopElements = z.object({
	badge: textPlacement.optional(),
	title: textPlacement.optional(),
	subtitle: textPlacement.optional(),
	specs: textPlacement.optional(),
	countdown: textPlacement.optional(),
	product: productPlacement.optional(),
	cta: ctaPlacement.optional(),
});

const mobileElements = z.object({
	badge: z.union([hidden, textPlacement]).optional(),
	title: z.union([hidden, textPlacement]).optional(),
	subtitle: z.union([hidden, textPlacement]).optional(),
	specs: z.union([hidden, textPlacement]).optional(),
	countdown: z.union([hidden, textPlacement]).optional(),
	product: z.union([hidden, productPlacement]).optional(),
	cta: z.union([hidden, ctaPlacement]).optional(),
});

export const compositionSchema = z.object({
	version: z.literal(1),
	desktop: z.object({
		background: backgroundSchema,
		elements: desktopElements,
	}),
	mobile: z.object({
		background: backgroundSchema.optional(),
		elements: mobileElements,
	}),
});

export type BannerComposition = z.infer<typeof compositionSchema>;
export type ElementPlacement = z.infer<typeof textPlacement>;
export type BackgroundConfig = z.infer<typeof backgroundSchema>;
export type MobileOverride = NonNullable<
	z.infer<typeof mobileElements>[ElementKey]
>;
export type Viewport = "desktop" | "mobile";

// Pilha segura mobile e z-order dos posicionados — ordem fixa (issue §pilha,
// adendo 5). Nunca iterar Object.keys de jsonb.
export const SAFE_STACK_ORDER: ElementKey[] = [
	"badge",
	"title",
	"specs",
	"subtitle",
	"countdown",
	"product",
	"cta",
];

const COL_BY_HALIGN: Record<string, number> = { l: 5, c: 50, r: 95 };

function rowByValign(valign: string, bottomRow: number) {
	if (valign === "t") {
		return 5;
	}
	if (valign === "m") {
		return 50;
	}
	return bottomRow;
}

// Posição-base do ponto de referência de cada âncora (% do container).
export function anchorBasePosition(anchor: Anchor9, viewport: Viewport) {
	const col = COL_BY_HALIGN[anchor.charAt(1)] ?? 50;
	const bottomRow = viewport === "desktop" ? 88 : 84;
	const row = rowByValign(anchor.charAt(0), bottomRow);
	return { x: col, y: row };
}

// Divide os elementos do desktop em 3 grupos pro render mobile: sem override →
// pilha segura; override com placement → posicionado absoluto; hidden → fora.
// Só considera keys presentes em desktop.elements.
export function partitionMobileElements(c: BannerComposition): {
	stacked: ElementKey[];
	positioned: [ElementKey, ElementPlacement][];
	hidden: ElementKey[];
} {
	const stacked: ElementKey[] = [];
	const positioned: [ElementKey, ElementPlacement][] = [];
	const hiddenKeys: ElementKey[] = [];
	for (const key of SAFE_STACK_ORDER) {
		if (c.desktop.elements[key] === undefined) {
			continue;
		}
		const override = c.mobile.elements[key];
		if (override === undefined) {
			stacked.push(key);
		} else if ("hidden" in override) {
			hiddenKeys.push(key);
		} else {
			positioned.push([key, override]);
		}
	}
	return { stacked, positioned, hidden: hiddenKeys };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter=web test src/lib/composition/composition-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/composition/composition-schema.ts apps/web/src/lib/composition/composition-schema.test.ts
git commit -m "feat: schema zod da hero composition (#210)"
```

---

### Task 2: `lib/composition/placement-css.ts` — fórmulas de estilo + gradiente

**Files:**
- Create: `apps/web/src/lib/composition/placement-css.ts`
- Test: `apps/web/src/lib/composition/placement-css.test.ts`

**Interfaces:**
- Consumes: `anchorBasePosition` e tipos de `./composition-schema` (Task 1).
- Produces: `placementToStyle(p: ElementPlacement, viewport: Viewport): CSSProperties` · `focalToObjectPosition(focal: Anchor9): string` · `backgroundToStyle(bg: BackgroundConfig): CSSProperties` · `textSide(c: BannerComposition): "left" | "right" | "center"` · `GRADIENT_CLASS: Record<"left" | "right" | "center", string>` (classes **`lg:`** — a base mobile `to-t` é fixa no slide).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/composition/placement-css.test.ts
import { describe, expect, it } from "vitest";
import {
	backgroundToStyle,
	focalToObjectPosition,
	GRADIENT_CLASS,
	placementToStyle,
	textSide,
} from "./placement-css";
import type { BannerComposition } from "./composition-schema";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter=web test src/lib/composition/placement-css.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/composition/placement-css.ts
// Fórmulas de render do contrato composition (issue #210) — port do
// placement-css.ts do emach-dashboard (canônico lá; nomes espelhados).
import type { CSSProperties } from "react";
import {
	type Anchor9,
	anchorBasePosition,
	type BackgroundConfig,
	type BannerComposition,
	type ElementPlacement,
	type Viewport,
} from "./composition-schema";

// Deslocamento de translate p/ ancorar o ponto de referência no elemento
// (col = horizontal, row = vertical), indexado por charAt (noUncheckedIndexedAccess).
const TX_BY_COL: Record<string, string> = { l: "0%", c: "-50%", r: "-100%" };
const TY_BY_ROW: Record<string, string> = { t: "0%", m: "-50%", b: "-100%" };
const PCT_BY_AXIS: Record<string, string> = {
	l: "0%",
	c: "50%",
	r: "100%",
	t: "0%",
	m: "50%",
	b: "100%",
};

function colOf(anchor: Anchor9): string {
	return anchor.charAt(1);
}

function rowOf(anchor: Anchor9): string {
	return anchor.charAt(0);
}

export function placementToStyle(
	p: ElementPlacement,
	viewport: Viewport
): CSSProperties {
	const base = anchorBasePosition(p.anchor, viewport);
	const tx = TX_BY_COL[colOf(p.anchor)] ?? "0%";
	const ty = TY_BY_ROW[rowOf(p.anchor)] ?? "0%";
	const originX = PCT_BY_AXIS[colOf(p.anchor)] ?? "50%";
	const originY = PCT_BY_AXIS[rowOf(p.anchor)] ?? "50%";
	const style: CSSProperties = {
		left: `${base.x + p.offsetX}%`,
		top: `${base.y + p.offsetY}%`,
		transform: `translate(${tx}, ${ty}) scale(${p.scale / 100})`,
		transformOrigin: `${originX} ${originY}`,
	};
	if (p.maxWidth !== undefined) {
		style.maxWidth = `${p.maxWidth}ch`;
	}
	return style;
}

export function focalToObjectPosition(focal: Anchor9): string {
	const x = PCT_BY_AXIS[colOf(focal)] ?? "50%";
	const y = PCT_BY_AXIS[rowOf(focal)] ?? "50%";
	return `${x} ${y}`;
}

export function backgroundToStyle(bg: BackgroundConfig): CSSProperties {
	return {
		transform: `scale(${bg.zoom / 100})`,
		transformOrigin: focalToObjectPosition(bg.focal),
	};
}

export function textSide(c: BannerComposition): "left" | "right" | "center" {
	const a =
		c.desktop.elements.title?.anchor ?? c.desktop.elements.subtitle?.anchor;
	if (a === undefined) {
		return "center";
	}
	const col = colOf(a);
	if (col === "l") {
		return "left";
	}
	if (col === "r") {
		return "right";
	}
	return "center";
}

// Direção do gradiente de legibilidade no DESKTOP pela coluna da âncora do
// título (contrato §gradiente). A base mobile (to-t) é fixa no slide. Classes
// estáticas — Tailwind JIT não vê string montada.
export const GRADIENT_CLASS: Record<"left" | "right" | "center", string> = {
	left: "lg:bg-gradient-to-r lg:from-black/80 lg:via-black/20 lg:to-transparent",
	right:
		"lg:bg-gradient-to-l lg:from-black/80 lg:via-black/20 lg:to-transparent",
	center:
		"lg:bg-gradient-to-t lg:from-black/85 lg:via-black/30 lg:to-transparent",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter=web test src/lib/composition/placement-css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/composition/placement-css.ts apps/web/src/lib/composition/placement-css.test.ts
git commit -m "feat: css de placement da hero composition"
```

---

### Task 3: `lib/composition/legacy-composition.ts` — conversão legada + `resolveComposition`

**Files:**
- Create: `apps/web/src/lib/composition/legacy-composition.ts`
- Test: `apps/web/src/lib/composition/legacy-composition.test.ts`

**Interfaces:**
- Consumes: `compositionSchema` e tipos (Task 1); tipo `Banner` de `@emach/db/schema/banner`.
- Produces:
  - `legacyToComposition(input): BannerComposition` (mapa dos 8 layouts, o mesmo do backfill do dashboard);
  - `deriveHasFlagsFromBanner(banner): { hasTitle, hasSubtitle, hasBadge, hasSpecs, hasCountdown, hasProduct, hasCta }` (`hasCta` = label **E** href);
  - `resolveComposition(banner: ResolvableBanner): BannerComposition` — nunca lança/nunca null. Válida → usa; NULL → converte **silencioso**; inválida não-nula → converte **E** `console.error` com bannerId (único `console` permitido no app — biome-ignore justificado; roda no client, evlog é server-only).
  - `ResolvableBanner` = `Pick<Banner, "id" | "composition" | "layout" | "productScale" | "ctaScale" | "title" | "subtitle" | "badgeText" | "specs" | "countdownTarget" | "productImageUrl" | "ctaLabel" | "ctaHref">` — o `HeroBanner` do carousel satisfaz estruturalmente.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/composition/legacy-composition.test.ts
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
		const bad = { ...VALID, version: 2 } as unknown as ResolvableBanner["composition"];
		const c = resolveComposition(makeBanner({ composition: bad }));
		expect(c.desktop.elements.product?.anchor).toBe("tc");
		expect(spy).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(spy.mock.calls[0])).toContain("b1");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter=web test src/lib/composition/legacy-composition.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/composition/legacy-composition.ts
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
export function resolveComposition(banner: ResolvableBanner): BannerComposition {
	if (banner.composition !== null) {
		const parsed = compositionSchema.safeParse(banner.composition);
		if (parsed.success) {
			return parsed.data;
		}
		// biome-ignore lint/suspicious/noConsole: roda em client component (evlog é server-only; repo sem logger client) — sinal operacional de schema drift, exceção registrada na spec 2026-07-30.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter=web test src/lib/composition/legacy-composition.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/composition/legacy-composition.ts apps/web/src/lib/composition/legacy-composition.test.ts
git commit -m "feat: conversão legada e resolveComposition"
```

---

### Task 4: `components/hero/hero-element-renders.tsx` — markup atual movido

Extração SEM mudança de pixel: o markup vem do `hero-carousel.tsx` de hoje (tipografia da loja — NÃO copiar as classes miniatura do renderer do dashboard). As margens de fluxo (`mb-3`, `mt-4`, `mt-6`) **saem** do conteúdo — no modelo novo o espaçamento é do placement ou da pilha (`gap-3`). Nesta task o arquivo novo apenas compila; o consumo chega nas Tasks 5-7.

**Files:**
- Create: `apps/web/src/components/hero/hero-element-renders.tsx`

**Interfaces:**
- Consumes: `ElementKey` (Task 1); `resolveHeroSpecs` de `@/lib/hero-specs`; `formatCountdown`/`CountdownParts` de `@/lib/countdown`; `EmachButton`/`emachButtonVariants` de `@/components/emach-button`.
- Produces:
  - `HeroElementBanner` = `Pick<Banner, "title" | "subtitle" | "specs" | "badgeText" | "ctaLabel" | "ctaHref" | "ctaVariant" | "countdownTarget">`;
  - `renderHeroElement(key: Exclude<ElementKey, "product">, banner: HeroElementBanner, opts: { headingTag: "h1" | "h2"; ctaFull: boolean }): ReactNode` — `null` quando o dado está vazio;
  - `HeroProductMotion({ url, isActive, isFirst, parallaxX, parallaxY, reduceMotion })` — miolo do produto (parallax + float + realce de slide ativo, inalterados); a **caixa dimensionada** é responsabilidade do chamador (armadilha 2 da issue).

- [ ] **Step 1: Write the implementation** (extração; sem teste unit próprio — JSX em env node; gate é `check-types` + smoke da Task 8)

```tsx
// apps/web/src/components/hero/hero-element-renders.tsx
"use client";

// Conteúdo puro de cada elemento do hero (issue #210): decide SE renderiza
// (dado presente); ONDE renderiza é do chamador (posicionado absoluto no
// hero-slide ou pilha segura mobile). Markup/tipografia ATUAIS da loja — o
// renderer do dashboard é miniatura de card; paridade é de âncora, não de px.
// Sem margens de fluxo: espaçamento é responsabilidade do placement/pilha.
import type { Banner } from "@emach/db/schema/banner";
import { cn } from "@emach/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { m, type MotionValue } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
	EmachButton,
	type emachButtonVariants,
} from "@/components/emach-button";
import { type CountdownParts, formatCountdown } from "@/lib/countdown";
import type { ElementKey } from "@/lib/composition/composition-schema";
import { resolveHeroSpecs } from "@/lib/hero-specs";

export type HeroElementBanner = Pick<
	Banner,
	| "title"
	| "subtitle"
	| "specs"
	| "badgeText"
	| "ctaLabel"
	| "ctaHref"
	| "ctaVariant"
	| "countdownTarget"
>;

interface CtaStyle {
	className?: string;
	variant: VariantProps<typeof emachButtonVariants>["variant"];
}

// Mapeia a variante do banco para a EmachButton. `white` reaproveita primary
// sobrescrevendo as cores; `ghost` = outline-light (ações sobre dark do DESIGN.md).
const CTA_VARIANT_MAP: Record<HeroElementBanner["ctaVariant"], CtaStyle> = {
	red: { variant: "primary" },
	dark: { variant: "dark", className: "border-white/25" },
	white: {
		variant: "primary",
		className: "border-transparent bg-white text-near-black hover:bg-white/90",
	},
	ghost: { variant: "outline-light" },
};

function HeroCta({
	banner,
	full,
}: {
	banner: HeroElementBanner;
	full: boolean;
}) {
	if (!(banner.ctaLabel && banner.ctaHref)) {
		return null;
	}
	const style = CTA_VARIANT_MAP[banner.ctaVariant];
	return (
		// ctaHref vem como string do banco; typedRoutes não valida em runtime.
		<Link
			className={cn("inline-flex", full && "flex w-full")}
			href={banner.ctaHref as Route}
		>
			<EmachButton
				className={style.className}
				full={full}
				icon={<ArrowRight className="size-4" />}
				size="lg"
				variant={style.variant}
			>
				{banner.ctaLabel}
			</EmachButton>
		</Link>
	);
}

// Contador regressivo do hero. Ticker por segundo com auto-hide ao expirar é
// comportamento da loja (issue #210, adendo 7) — a composition só posiciona.
// Calcula só pós-mount pra evitar mismatch de hidratação.
function HeroCountdown({ target }: { target: Date }) {
	const [parts, setParts] = useState<CountdownParts | null>(null);
	useEffect(() => {
		const t = target.getTime();
		const tick = () => setParts(formatCountdown(t - Date.now()));
		tick();
		const id = window.setInterval(tick, 1000);
		return () => window.clearInterval(id);
	}, [target]);
	if (parts === null || parts.done) {
		return null;
	}
	return (
		<span
			aria-live="off"
			className="font-display font-semibold text-[15px] text-white tabular-nums tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[17px]"
			role="timer"
		>
			{parts.days}d {parts.hours}h {parts.minutes}m {parts.seconds}s
		</span>
	);
}

// Ficha técnica do hero (#158): valores de banner.specs como <ul> semântico.
function HeroSpecs({ specs }: { specs: string[] | null }) {
	const values = resolveHeroSpecs(specs);
	if (values.length === 0) {
		return null;
	}
	return (
		<div className="max-w-[44ch] font-display text-[13px] text-white/90 uppercase tracking-[0.08em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[15px]">
			<span aria-hidden="true" className="text-white/55">
				Ficha técnica
			</span>
			<ul aria-label="Ficha técnica" className="inline">
				{values.map((spec) => (
					<li
						className="inline before:mx-1.5 before:text-white/40 before:content-['·']"
						key={spec}
					>
						{spec}
					</li>
				))}
			</ul>
		</div>
	);
}

function HeroTitle({
	banner,
	headingTag,
}: {
	banner: HeroElementBanner;
	headingTag: "h1" | "h2";
}) {
	if (!banner.title) {
		return null;
	}
	const HeadingTag = headingTag;
	return (
		<div className="flex flex-col items-start">
			<HeadingTag className="text-balance font-display font-medium text-[clamp(44px,6vw,84px)] text-white uppercase leading-[0.9] tracking-[-0.01em] drop-shadow-[0_3px_18px_rgba(0,0,0,0.7)]">
				{banner.title}
			</HeadingTag>
			<span aria-hidden="true" className="my-4 h-[3px] w-16 bg-emach-red" />
		</div>
	);
}

// Despacho por elemento (produto NÃO passa aqui — precisa de caixa + motion).
// Retorna null quando o dado de conteúdo está vazio: elemento ligado na
// composition mas sem dado não renderiza caixa vazia.
export function renderHeroElement(
	key: Exclude<ElementKey, "product">,
	banner: HeroElementBanner,
	opts: { headingTag: "h1" | "h2"; ctaFull: boolean }
): ReactNode {
	switch (key) {
		case "badge":
			return banner.badgeText ? (
				<span className="inline-block bg-white px-2.5 py-0.5 font-display font-semibold text-[11px] text-near-black uppercase tracking-[0.06em]">
					{banner.badgeText}
				</span>
			) : null;
		case "title":
			return <HeroTitle banner={banner} headingTag={opts.headingTag} />;
		case "subtitle":
			return banner.subtitle ? (
				<p className="max-w-[44ch] font-sans text-[15px] text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[17px]">
					{banner.subtitle}
				</p>
			) : null;
		case "specs":
			return <HeroSpecs specs={banner.specs} />;
		case "countdown":
			return banner.countdownTarget ? (
				<HeroCountdown target={banner.countdownTarget} />
			) : null;
		case "cta":
			return <HeroCta banner={banner} full={opts.ctaFull} />;
		default:
			return null;
	}
}

export interface HeroProductMotionProps {
	isActive: boolean;
	isFirst: boolean;
	parallaxX: MotionValue<number>;
	parallaxY: MotionValue<number>;
	reduceMotion: boolean;
	url: string;
}

// Miolo do produto: parallax + float + realce de slide ativo — inalterados da
// versão pré-#210. A caixa dimensionada por fora é OBRIGATÓRIA (issue #210,
// armadilha 2): o <Image fill> colapsa a 0×0 sem width/height no wrapper.
export function HeroProductMotion({
	isActive,
	isFirst,
	parallaxX,
	parallaxY,
	reduceMotion,
	url,
}: HeroProductMotionProps) {
	const floatAnimate = reduceMotion ? undefined : { y: [0, -15, 0] };
	const floatTransition = reduceMotion
		? undefined
		: ({
				duration: 5,
				repeat: Number.POSITIVE_INFINITY,
				ease: "easeInOut",
			} as const);
	const animate = reduceMotion
		? { opacity: 1, scale: 1 }
		: {
				opacity: isActive ? 1 : 0.35,
				scale: isActive ? 1 : 0.94,
			};
	return (
		<m.div
			animate={animate}
			className="relative h-full w-full"
			style={{ x: parallaxX, y: parallaxY }}
			transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
		>
			<m.div
				animate={floatAnimate}
				className="relative h-full w-full drop-shadow-[0_30px_24px_rgba(0,0,0,0.55)]"
				transition={floatTransition}
			>
				<Image
					alt=""
					className="object-contain"
					fetchPriority={isFirst ? "high" : "auto"}
					fill
					priority={isFirst}
					quality={85}
					sizes="(max-width: 1024px) 92vw, 42vw"
					src={url}
				/>
			</m.div>
		</m.div>
	);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun check-types`
Expected: verde (arquivo novo compila; nada o consome ainda)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/hero/hero-element-renders.tsx
git commit -m "feat: renders de elemento do hero (#210)"
```

---

### Task 5: `components/hero/hero-safe-stack.tsx` — pilha segura mobile

Formalização do mobile hardcoded atual (spec F3): ordem fixa vinda de `partitionMobileElements`, texto à esquerda, produto centralizado (box própria FORA da pilha), CTA full-width. Itens da pilha **não aplicam escala** (adendo 4).

**Files:**
- Create: `apps/web/src/components/hero/hero-safe-stack.tsx`

**Interfaces:**
- Consumes: `renderHeroElement`, `HeroProductMotion`, `HeroElementBanner`, `HeroProductMotionProps` (Task 4); `ElementKey` (Task 1).
- Produces:
  - `HeroSafeStack({ banner, keys, headingTag }: { banner: HeroElementBanner; keys: ElementKey[]; headingTag: "h1" | "h2" })` — pilha de texto/CTA (`lg:hidden`), ignora `"product"` da lista;
  - `HeroStackProduct({ banner, ...motion }: Omit<HeroProductMotionProps, "url"> & { banner: Pick<Banner, "productImageUrl" | "productImageMobileUrl"> })` — box central absoluta `h-[38%] w-[82%]` sem escala (`lg:hidden`).

- [ ] **Step 1: Write the implementation**

```tsx
// apps/web/src/components/hero/hero-safe-stack.tsx
"use client";

// Pilha segura mobile (issue #210, F3): elementos SEM override mobile empilham
// do terço inferior do 9:16 na ordem fixa recebida (SAFE_STACK_ORDER via
// partitionMobileElements) — texto à esquerda, CTA full-width; o produto
// herdado tem box central própria FORA do fluxo da pilha (comportamento
// hardcoded atual formalizado). Itens da pilha NÃO aplicam scale (adendo 4).
import type { Banner } from "@emach/db/schema/banner";
import type { ElementKey } from "@/lib/composition/composition-schema";
import {
	type HeroElementBanner,
	HeroProductMotion,
	type HeroProductMotionProps,
	renderHeroElement,
} from "./hero-element-renders";

export function HeroSafeStack({
	banner,
	keys,
	headingTag,
}: {
	banner: HeroElementBanner;
	keys: ElementKey[];
	headingTag: "h1" | "h2";
}) {
	const items = keys.filter(
		(k): k is Exclude<ElementKey, "product"> => k !== "product"
	);
	if (items.length === 0) {
		return null;
	}
	return (
		<div className="absolute inset-x-[5%] bottom-[16%] z-20 flex flex-col items-start gap-3 text-left lg:hidden">
			{items.map((key) => {
				const content = renderHeroElement(key, banner, {
					headingTag,
					ctaFull: key === "cta",
				});
				if (content === null) {
					return null;
				}
				return (
					<div className={key === "cta" ? "w-full" : undefined} key={key}>
						{content}
					</div>
				);
			})}
		</div>
	);
}

export function HeroStackProduct({
	banner,
	...motion
}: Omit<HeroProductMotionProps, "url"> & {
	banner: Pick<Banner, "productImageUrl" | "productImageMobileUrl">;
}) {
	const url = banner.productImageMobileUrl ?? banner.productImageUrl;
	if (url == null) {
		return null;
	}
	return (
		<div className="absolute top-[46%] left-1/2 z-15 h-[38%] w-[82%] -translate-x-1/2 -translate-y-1/2 lg:hidden">
			<HeroProductMotion url={url} {...motion} />
		</div>
	);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun check-types`
Expected: verde

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/hero/hero-safe-stack.tsx
git commit -m "feat: pilha segura mobile do hero"
```

---

### Task 6: `components/hero/hero-slide.tsx` — montagem do slide

**Files:**
- Create: `apps/web/src/components/hero/hero-slide.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5. Tipos: `BannerComposition`, `partitionMobileElements`, `SAFE_STACK_ORDER` (T1); `placementToStyle`, `backgroundToStyle`, `focalToObjectPosition`, `textSide`, `GRADIENT_CLASS` (T2); `renderHeroElement`, `HeroProductMotion` (T4); `HeroSafeStack`, `HeroStackProduct` (T5).
- Produces: `HeroSlide({ banner, composition, isActive, isDesktop, isFirst, isH1, parallaxX, parallaxY, reduceMotion })` e o tipo `HeroSlideBanner` = `Pick<Banner, "backgroundImageUrl" | "backgroundImageMobileUrl" | "backgroundMobileMode" | "productImageUrl" | "productImageMobileUrl" | "title" | "subtitle" | "specs" | "altText" | "badgeText" | "ctaLabel" | "ctaHref" | "ctaVariant" | "countdownTarget">`. O `HeroBanner` do carousel (T7) satisfaz.

**Semântica (spec F2):** fundo desktop/mobile pelos modos atuais + zoom/focal novos; glow mantido sempre; gradiente só com título/subtítulo (direção desktop por `textSide`, base mobile `to-t`; scrim mobile de imagem-pura preservado); desktop = todo elemento ligado posicionado na ordem `SAFE_STACK_ORDER` (escala SEM gate `lg:`); mobile = partition (posicionado absoluto com a própria escala / hidden fora / stacked na pilha); `w-max` em todo posicionado exceto produto; produto com box explícita 60/38 desktop, 32/70 mobile posicionado.

- [ ] **Step 1: Write the implementation**

```tsx
// apps/web/src/components/hero/hero-slide.tsx
"use client";

// Um slide do hero montado a partir de banner.composition (issue #210):
// fundo (modos mobile atuais + zoom/focal), glow (assinatura da loja — sempre),
// gradiente de legibilidade, elementos desktop posicionados na ordem
// SAFE_STACK_ORDER (z-order determinístico) e mobile via partition.
import type { Banner } from "@emach/db/schema/banner";
import { cn } from "@emach/ui/lib/utils";
import { m, type MotionValue } from "framer-motion";
import Image from "next/image";
import {
	type BannerComposition,
	type ElementKey,
	type ElementPlacement,
	partitionMobileElements,
	SAFE_STACK_ORDER,
	type Viewport,
} from "@/lib/composition/composition-schema";
import {
	backgroundToStyle,
	focalToObjectPosition,
	GRADIENT_CLASS,
	placementToStyle,
	textSide,
} from "@/lib/composition/placement-css";
import {
	type HeroElementBanner,
	HeroProductMotion,
	type HeroProductMotionProps,
	renderHeroElement,
} from "./hero-element-renders";
import { HeroSafeStack, HeroStackProduct } from "./hero-safe-stack";

export type HeroSlideBanner = Pick<
	Banner,
	| "backgroundImageUrl"
	| "backgroundImageMobileUrl"
	| "backgroundMobileMode"
	| "productImageUrl"
	| "productImageMobileUrl"
	| "title"
	| "subtitle"
	| "specs"
	| "altText"
	| "badgeText"
	| "ctaLabel"
	| "ctaHref"
	| "ctaVariant"
	| "countdownTarget"
>;

// Resolução do fundo mobile por modo (desktop nunca muda):
//   none → sem imagem · custom → mobile url (fallback desktop) · inherit → desktop.
function resolveMobileBg(banner: HeroSlideBanner): string | null {
	switch (banner.backgroundMobileMode) {
		case "none":
			return null;
		case "custom":
			return banner.backgroundImageMobileUrl ?? banner.backgroundImageUrl;
		default:
			return banner.backgroundImageUrl;
	}
}

// Fundo com zoom + ponto focal (#210): o wrapper do <Image> leva o scale
// (transformOrigin = focal) e o <Image> leva object-position = focal. Quando
// URL e config coincidem nos dois viewports, um único <Image> cobre tudo.
function HeroBackground({
	banner,
	composition,
	isFirst,
}: {
	banner: HeroSlideBanner;
	composition: BannerComposition;
	isFirst: boolean;
}) {
	const desktopBg = banner.backgroundImageUrl;
	const mobileBg = resolveMobileBg(banner);
	const desktopCfg = composition.desktop.background;
	const mobileCfg = composition.mobile.background ?? desktopCfg;
	const sharedBg =
		desktopBg != null &&
		mobileBg === desktopBg &&
		composition.mobile.background === undefined;
	const fetchPriority = isFirst ? "high" : "auto";

	return (
		<div className="absolute inset-0 overflow-hidden bg-black">
			{desktopBg != null && (
				<div
					className={cn("absolute inset-0", !sharedBg && "hidden lg:block")}
					style={backgroundToStyle(desktopCfg)}
				>
					<Image
						alt={banner.altText ?? ""}
						className="object-cover"
						fetchPriority={fetchPriority}
						fill
						priority={isFirst}
						quality={75}
						sizes="100vw"
						src={desktopBg}
						style={{ objectPosition: focalToObjectPosition(desktopCfg.focal) }}
					/>
				</div>
			)}
			{!sharedBg && mobileBg != null && (
				<div
					className="absolute inset-0 lg:hidden"
					style={backgroundToStyle(mobileCfg)}
				>
					<Image
						alt={banner.altText ?? ""}
						className="object-cover"
						fetchPriority={fetchPriority}
						fill
						priority={isFirst}
						quality={75}
						sizes="100vw"
						src={mobileBg}
						style={{ objectPosition: focalToObjectPosition(mobileCfg.focal) }}
					/>
				</div>
			)}
		</div>
	);
}

// Glow vermelho — assinatura cinematográfica da loja (a composition não governa
// o glow). Pulse (repaint de blur(40px) por frame) é caro no mobile — anima só
// no desktop; no mobile fica estático.
function HeroGlow({
	isDesktop,
	reduceMotion,
}: {
	isDesktop: boolean;
	reduceMotion: boolean;
}) {
	const animated = !reduceMotion && isDesktop;
	return (
		<m.div
			animate={animated ? { opacity: [0.6, 1, 0.6] } : undefined}
			aria-hidden="true"
			className="pointer-events-none absolute top-1/2 left-1/2 z-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
			style={{
				width: "clamp(400px, 70vw, 900px)",
				height: "clamp(400px, 70vw, 900px)",
				background:
					"radial-gradient(circle, rgba(230,0,18,0.22) 0%, rgba(230,0,18,0.07) 40%, transparent 70%)",
				filter: "blur(40px)",
			}}
			transition={
				animated
					? {
							duration: 4,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						}
					: undefined
			}
		/>
	);
}

type HeroMotion = Omit<HeroProductMotionProps, "url">;

// Produto POSICIONADO (desktop sempre; mobile só override): caixa com dimensão
// explícita (armadilha 2) — a scale do placement multiplica por cima.
function HeroPositionedProduct({
	banner,
	placement,
	viewport,
	...motion
}: HeroMotion & {
	banner: HeroSlideBanner;
	placement: ElementPlacement;
	viewport: Viewport;
}) {
	const url =
		viewport === "mobile"
			? (banner.productImageMobileUrl ?? banner.productImageUrl)
			: banner.productImageUrl;
	if (url == null) {
		return null;
	}
	return (
		<div
			className={cn(
				"absolute z-15",
				viewport === "desktop"
					? "hidden h-[60%] w-[38%] lg:block"
					: "h-[32%] w-[70%] lg:hidden"
			)}
			style={placementToStyle(placement, viewport)}
		>
			<HeroProductMotion url={url} {...motion} />
		</div>
	);
}

// Elemento de texto/CTA posicionado absoluto. `w-max` é obrigatório (armadilha
// 1): sem ele, âncora perto da borda sofre shrink-to-fit e quebra palavra a
// palavra; o maxWidth (ch) do placement segue limitando.
function HeroPositionedElement({
	elementKey,
	placement,
	viewport,
	banner,
	headingTag,
}: {
	elementKey: Exclude<ElementKey, "product">;
	placement: ElementPlacement;
	viewport: Viewport;
	banner: HeroElementBanner;
	headingTag: "h1" | "h2";
}) {
	const content = renderHeroElement(elementKey, banner, {
		headingTag,
		ctaFull: false,
	});
	if (content === null) {
		return null;
	}
	return (
		<div
			className={cn(
				"absolute z-20 w-max",
				viewport === "desktop" ? "hidden lg:block" : "lg:hidden"
			)}
			style={placementToStyle(placement, viewport)}
		>
			{content}
		</div>
	);
}

export interface HeroSlideProps extends HeroMotion {
	banner: HeroSlideBanner;
	composition: BannerComposition;
	isDesktop: boolean;
	isH1: boolean;
}

export function HeroSlide({
	banner,
	composition,
	isDesktop,
	isH1,
	...motion
}: HeroSlideProps) {
	const partition = partitionMobileElements(composition);
	// Contrato §gradiente: só título/subtítulo contam (specs não).
	const hasText = Boolean(banner.title || banner.subtitle);
	const headingTag = isH1 ? "h1" : "h2";

	return (
		<div className="absolute inset-0">
			<HeroBackground
				banner={banner}
				composition={composition}
				isFirst={motion.isFirst}
			/>

			<HeroGlow isDesktop={isDesktop} reduceMotion={motion.reduceMotion} />

			{/* Gradiente de legibilidade — só quando há título/subtítulo a proteger. */}
			{hasText && (
				<div
					aria-hidden="true"
					className={cn(
						"absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent",
						GRADIENT_CLASS[textSide(composition)]
					)}
				/>
			)}

			{/* Banner "imagem pura" (sem texto) COM imagem mobile: scrim inferior
			    só-mobile pra contraste de dots/CTA. Sem bg mobile o backdrop já é preto. */}
			{!hasText && resolveMobileBg(banner) != null && (
				<div
					aria-hidden="true"
					className="absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-black/75 to-transparent lg:hidden"
				/>
			)}

			{/* Desktop: todo elemento ligado é posicionado, na ordem fixa (z estável). */}
			{SAFE_STACK_ORDER.map((key) => {
				const placement = composition.desktop.elements[key];
				if (placement === undefined) {
					return null;
				}
				if (key === "product") {
					return (
						<HeroPositionedProduct
							banner={banner}
							key={key}
							placement={placement}
							viewport="desktop"
							{...motion}
						/>
					);
				}
				return (
					<HeroPositionedElement
						banner={banner}
						elementKey={key}
						headingTag={headingTag}
						key={key}
						placement={placement}
						viewport="desktop"
					/>
				);
			})}

			{/* Mobile: overrides posicionados + produto herdado + pilha segura. */}
			{partition.positioned.map(([key, placement]) =>
				key === "product" ? (
					<HeroPositionedProduct
						banner={banner}
						key={key}
						placement={placement}
						viewport="mobile"
						{...motion}
					/>
				) : (
					<HeroPositionedElement
						banner={banner}
						elementKey={key}
						headingTag={headingTag}
						key={key}
						placement={placement}
						viewport="mobile"
					/>
				)
			)}
			{partition.stacked.includes("product") && (
				<HeroStackProduct banner={banner} {...motion} />
			)}
			<HeroSafeStack
				banner={banner}
				headingTag={headingTag}
				keys={partition.stacked}
			/>
		</div>
	);
}
```

Nota sobre o heading: ele pode renderizar nas duas árvores (desktop posicionado + pilha mobile) — só uma é visível por breakpoint e `display:none` sai da árvore de acessibilidade, então há sempre exatamente um h1 exposto.

- [ ] **Step 2: Verify it compiles**

Run: `bun check-types`
Expected: verde

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/hero/hero-slide.tsx
git commit -m "feat: slide do hero por composition"
```

---

### Task 7: Orquestrador + fallbacks + CLAUDE.md

**Files:**
- Create: `apps/web/src/components/hero/hero-fallbacks.ts`
- Test: `apps/web/src/components/hero/hero-fallbacks.test.ts`
- Modify: `apps/web/src/components/hero-carousel.tsx` (emagrece pra orquestrador)
- Modify: `CLAUDE.md` (gotcha "Hero mobile ≠ desktop")

**Interfaces:**
- Consumes: `resolveComposition` (T3), `HeroSlide` (T6), `compositionSchema` (T1, no teste).
- Produces: `HeroBanner` = Pick ATUAL de `Banner` **+ `"composition"`** no Pick (mantém `layout`/`productScale`/`ctaScale` — o fallback legado do resolve precisa deles). `HeroCarousel({ banners: HeroBanner[] })` — API pública inalterada. `FALLBACK_BANNERS: HeroBanner[]` exportado de `hero-fallbacks.ts`.

- [ ] **Step 1: Write the failing test** (fallbacks validados contra o schema — spec F4)

```ts
// apps/web/src/components/hero/hero-fallbacks.test.ts
import { describe, expect, it } from "vitest";
import { compositionSchema } from "@/lib/composition/composition-schema";
import { FALLBACK_BANNERS } from "./hero-fallbacks";

describe("FALLBACK_BANNERS", () => {
	it("todo fallback tem composition literal VÁLIDA pelo schema", () => {
		expect(FALLBACK_BANNERS.length).toBeGreaterThan(0);
		for (const banner of FALLBACK_BANNERS) {
			const parsed = compositionSchema.safeParse(banner.composition);
			expect(parsed.success, banner.id).toBe(true);
		}
	});

	it("fallbacks são split-equivalentes: produto mr + cta br, sem texto", () => {
		for (const banner of FALLBACK_BANNERS) {
			expect(banner.title).toBeNull();
			// Banner["composition"] é o envelope raso do jsonb (Record<string, unknown>);
			// o shape rico vem do parse — acessar .elements direto não compila.
			const parsed = compositionSchema.parse(banner.composition);
			expect(Object.keys(parsed.desktop.elements).sort()).toEqual([
				"cta",
				"product",
			]);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter=web test src/components/hero/hero-fallbacks.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Create `hero-fallbacks.ts`** (dados puros, sem JSX — importável em teste node)

```ts
// apps/web/src/components/hero/hero-fallbacks.ts
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
```

Nota de tipo: `HeroBanner["composition"]` é o campo do `Banner` (jsonb raso, nullable). O literal acima satisfaz o shape raso; o teste do Step 1 prova que também passa no `compositionSchema` (o cast estrutural é verificado em runtime pelo teste, não por `as`).

- [ ] **Step 4: Emagrecer `hero-carousel.tsx`**

O arquivo mantém APENAS: tipo `HeroBanner`, constantes de autoplay/parallax, o componente `HeroCarousel` (carousel/autoplay/dots/pause/parallax-spring/h1 — **intactos**, incluindo `useIsDesktop`) e o map de slides. Remover: `LAYOUT_CONFIG`, `LayoutConfig`, `CTA_CORNER_RIGHT`/`CTA_CENTER`, `GRADIENT_BY_SIDE`, `CTA_VARIANT_MAP`, `HeroCta`, `resolveMobileBg`, `HeroBackground`, `HeroGlow`, `HeroProduct`, `HeroCountdown`, `HeroSpecs`, `HeroContentBlock`, `HeroSlideContent`, `FALLBACK_BANNERS` local e os imports que ficarem órfãos (`VariantProps`, `ArrowRight`, `Image`, `Link`, `EmachButton`, `formatCountdown`, `resolveHeroSpecs`…). ATENÇÃO: `cn` NÃO é órfão — o bloco de dots (mantido) usa `cn(...)`; conferir cada import contra o arquivo final antes de remover.

Mudanças pontuais no que fica:

```ts
// tipo: Pick atual + "composition"
export type HeroBanner = Pick<
	Banner,
	| "id"
	| "backgroundImageUrl"
	| "backgroundImageMobileUrl"
	| "backgroundMobileMode"
	| "productImageUrl"
	| "productImageMobileUrl"
	| "title"
	| "subtitle"
	| "specs"
	| "altText"
	| "badgeText"
	| "ctaLabel"
	| "ctaHref"
	| "ctaVariant"
	| "layout"
	| "productScale"
	| "ctaScale"
	| "countdownTarget"
	| "composition"
>;
```

Imports novos: `import { resolveComposition } from "@/lib/composition/legacy-composition";` · `import { HeroSlide } from "@/components/hero/hero-slide";` · `import { FALLBACK_BANNERS } from "@/components/hero/hero-fallbacks";`

Resolver as compositions UMA vez por render (antes do `h1Index`), e o `h1Index` passa a exigir elemento `title` LIGADO na composition — a coluna `title` preenchida com elemento desligado não renderiza heading nenhum, e apontar o h1 pra esse slide deixaria a página sem h1 (a `<h1 sr-only>` de fallback só entra com `h1Index === -1`):

```tsx
const compositions = slides.map((b) => resolveComposition(b));
// Primeiro slide com título VISÍVEL (campo preenchido E elemento ligado) vira h1.
const h1Index = slides.findIndex(
	(b, i) =>
		b.title != null && compositions[i]?.desktop.elements.title !== undefined
);
```

No map de slides, o miolo do `<CarouselItem>` vira (composition já resolvida — spec F4):

```tsx
{slides.map((banner, index) => (
	<CarouselItem
		className="relative h-[70svh] min-h-[30rem] pl-0 lg:h-svh lg:min-h-0"
		key={banner.id}
	>
		<HeroSlide
			banner={banner}
			composition={compositions[index] ?? resolveComposition(banner)}
			isActive={index === selectedIndex}
			isDesktop={isDesktop}
			isFirst={index === 0}
			isH1={index === h1Index}
			parallaxX={parallaxX}
			parallaxY={parallaxY}
			reduceMotion={reduceMotion}
		/>
	</CarouselItem>
))}
```

Autoplay, dots, pause, parallax handlers, `<section>`/`<LazyMotion>`: **sem mudança**. (O `?? resolveComposition(banner)` é só pro `noUncheckedIndexedAccess` — `compositions[index]` sempre existe.)

- [ ] **Step 5: Atualizar o gotcha no `CLAUDE.md`** — no bullet "**Hero mobile ≠ desktop (`hero-carousel.tsx`).**", substituir o item "(1)" por:

> (1) Escala por elemento vem de `banner.composition` (#210) e vale nos DOIS viewports: elemento **posicionado** (desktop sempre; mobile só override) aplica a própria `scale` via transform do placement; item **herdado na pilha segura** mobile NÃO aplica escala (box fixa da pilha). O gate `lg:` de escala morreu junto com `LAYOUT_CONFIG` — renderer único em `components/hero/` + lib pura em `lib/composition/`; `NULL`/inválida convertem on-the-fly pro mapa legado (`legacy-composition.ts`, inválida loga bannerId).

Itens (2) e (3) do bullet (bg mobile / glow / banner vazio) continuam valendo — não tocar.

- [ ] **Step 6: Verificar**

Run: `bun check-types && bun check && VITEST_UNIT_ONLY=1 bun run --filter=web test:ci`
Expected: tudo verde. Grep de órfãos: `rg -n "LAYOUT_CONFIG|CTA_CORNER|GRADIENT_BY_SIDE" apps/web/src` → zero resultados.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/hero-carousel.tsx apps/web/src/components/hero/hero-fallbacks.ts apps/web/src/components/hero/hero-fallbacks.test.ts CLAUDE.md
git commit -m "feat: hero renderiza por banner.composition (#210)"
```

---

### Task 8: Smoke visual — banners reais de produção

Sem writes no banco. Provas perceptual + de dados.

**Files:** nenhum (verificação).

- [ ] **Step 1:** Subir o dev server — `bun dev:web` (se a porta estiver em uso, fluxo `/dev-up`).
- [ ] **Step 2:** Screenshots da home local via `agent-browser` (renderer próprio, sempre visível): desktop 1440×900 e mobile 390×844, os 2 slides (banners reais `c20fd73d…` e `3d3691bb…`).
- [ ] **Step 3:** Comparar com a home de **produção** (pré-mudança, mesmo dado): os 2 banners reais têm composition mínima (produto `tc` scale 140/145 + CTA `br`) cujo legado derivado é `center_cta_right` — o render novo deve ficar visualmente equivalente (diferença de poucos % nas âncoras é esperada; divergência grosseira de posição/escala = bug).
- [ ] **Step 4:** Regressões: parallax (mouse no desktop), float do produto, glow pulsando só no desktop, autoplay 9s + botão pause, dots, h1 único (inspecionar DOM: `document.querySelectorAll("h1").length` na árvore visível). `nextjs_call <porta> get_errors` limpo.
- [ ] **Step 5:** Registrar screenshots no relatório (não commitar imagens).

---

### Task 9: Smoke dos 4 templates — banners de teste via dashboard

Banners de teste criados **pela UI do dashboard** (spec F5) — o editor grava composition + dual-write canônicos. A home de produção compartilha o banco (cache da home ~600s) — manter cada banner de teste ativo pelo MENOR tempo possível e **deletar tudo ao final**.

Ferramenta: `claude-in-chrome` (Brave do user, sessão staff logada) no dashboard deployado. Se a UI travar o fluxo, fallback autorizado (user, 2026-07-30): INSERT/UPDATE/DELETE diretos via psql restritos a ids `smoke-210-%`, compositions copiadas dos 4 templates do editor, `is_active=false` por default, ativação um por vez, `DELETE FROM banner WHERE id LIKE 'smoke-210-%'` ao final.

- [ ] **Step 1:** No dashboard (UI), criar 4 banners de teste **inativos**, um por template do editor: "Produto em destaque", "Promo central", "Countdown" (target +3 dias), "Imagem pura". Conteúdo fixture: título/subtítulo/badge/specs onde o template pede; imagens quaisquer do acervo.
- [ ] **Step 2:** Um por vez: ativar no dashboard → recarregar a home **local** → screenshots desktop + mobile → comparar com o canvas/preview do próprio dashboard → **desativar imediatamente**. Conferir por template: âncoras/offsets/escalas; countdown ticando na loja (congelado no canvas — paridade não se aplica ao tique, adendo 7); badge/specs/maxWidth; pilha mobile na ordem fixa com CTA full-width; "imagem pura" sem gradiente de legibilidade e com scrim mobile.
- [ ] **Step 3:** Extra — cobrir a partição que os templates não exercitam: no editor, dar a um dos banners um override mobile (título `hidden` + CTA posicionado `mc` scale 120) → ativar → conferir no mobile local (título some; CTA centralizado escalado, fora da pilha) → desativar.
- [ ] **Step 4:** **CLEANUP OBRIGATÓRIO:** deletar os 4 banners de teste pela UI. Verificar por query read-only: `SELECT count(*) FROM banner;` deve voltar a **2** (os reais).

---

### Task 10: Gates finais e fechamento

- [ ] **Step 1:** Gates: `bun check && bun check-types && VITEST_UNIT_ONLY=1 bun run --filter=web test:ci`. Tudo verde.
- [ ] **Step 2:** Suíte completa local: `bun run --filter=web test` (integração pode flakear por concorrência — re-rodar isolado antes de culpar a mudança, ver CLAUDE.md).
- [ ] **Step 3:** Fechar a branch via `superpowers:finishing-a-development-branch` — decisão de merge/push é do user (NUNCA push espontâneo; deploy = push na main, ADR-0004).
- [ ] **Step 4 (pós-deploy, gated no user):** verificar a home de produção renderizando por composition (paridade dos 2 banners reais) e comentar na #210 sinalizando pro dashboard remover o dual-write (tarefa 5 da issue; fora deste PR). Rascunho (sem atribuição de AI):

> Storefront em produção lendo `banner.composition` (renderer único; NULL/inválida convertem on-the-fly pro mapa legado — inválida loga bannerId). Paridade confirmada nos 2 banners ativos e nos 4 templates do editor (desktop + mobile), zero regressão em autoplay/parallax/float/glow. Podem remover o dual-write (`deriveLegacyLayout` em `createBanner`/`updateBanner`) e marcar `layout`/`product_scale`/`cta_scale` como deprecated.

---

## Self-review (executado na escrita do plano)

- **Cobertura da spec revisada:** F1 lib pura em `lib/composition/` c/ 3 arquivos + testes (T1-T3, incl. `resolveComposition` com `console.error`+biome-ignore — repo não tem logger client, verificado) ✓ · F2 `hero-element-renders.tsx` (produto incluso) + `hero-slide.tsx` + armadilhas + escala mobile + CLAUDE.md (T4, T6, T7) ✓ · F3 `hero-safe-stack.tsx` (T5) ✓ · F4 Pick + orquestrador + fallbacks com teste contra schema (T7); query da home intocada ✓ · F5 gates + smoke 2 reais (T8) + 4 templates via dashboard + override extra (T9) + comentário pós-deploy (T10) ✓ · Fora de escopo respeitado (sem `packages/db`, sem dual-write, sem mudança de query/cache).
- **Placeholder scan:** limpo — todo step de código tem o código.
- **Consistência de tipos:** `ResolvableBanner` (T3) ⊇ satisfeito por `HeroBanner` (T7, mantém layout/scales/composition no Pick) ✓ · `HeroSlideBanner`/`HeroElementBanner` são sub-Picks de `HeroBanner` ✓ · `HeroProductMotionProps` (T4) consumido por T5/T6 via `Omit<…, "url">` ✓ · `GRADIENT_CLASS` definido em T2 e usado em T6 ✓ · zod v4 (`z.int()`) em T1.
- **Divergências deliberadas vs. código antigo (conferir no smoke):** specs não contam mais pro gradiente (contrato §gradiente); pilha mobile em `bottom-[16%]` com CTA dentro (antes: conteúdo `bottom-[22%]` + CTA solto `bottom-[9%]`); box do produto herdado 38/82 (antes 52/92) — tudo do contrato/issue.
