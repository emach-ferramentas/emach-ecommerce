# PDP Redesign (placa técnica) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o redesign aprovado da PDP (`/product/[slug]`): breadcrumb, galeria com thumbs em overlay, card branco de compra, ficha técnica em "placa" com algoritmo de spans testado, empty state de avaliações e reordenação de seções.

**Architecture:** A spec é `docs/superpowers/specs/2026-07-03-pdp-redesign-design.md` (fonte de verdade; em conflito, a spec vence). O coração é uma função pura `buildPlateLayout` (Task 1, TDD) consumida pelo Server Component `ProductSpecs` reescrito (Task 2). O resto são ajustes de composição em componentes existentes da rota.

**Tech Stack:** Next 16 (App Router, Server Components, `typedRoutes`), Tailwind 4 com tokens EMACH (`packages/ui/src/styles/globals.css`), vitest (unit, colocated), Barlow/Barlow Condensed via `font-sans`/`font-display`.

## Global Constraints

- **Read antes de Edit** (`cat`/`sed` não contam). Se Edit falhar com "string not found", re-Read o arquivo antes de tentar de novo.
- `bun check-types` **antes de cada commit** (rodar da raiz do monorepo — CWD é a raiz, paths absolutos).
- Proibido: `console.*`, `any`/`as any`/`@ts-ignore`, `key={index}`, `<img>` puro (usar `next/image`), `React.forwardRef`, `useMemo`/`useCallback` manuais (React Compiler ativo), barrel files.
- Superfície clara única é `--gray-10`; `#fff` SÓ no card de compra (exceção documentada na Task 8). Hairline é `border-border`, **nunca** `border-gray-10`.
- Vermelho (`--emach-red`) 1× por tela como CTA: "Comprar agora". Kickers vermelhos (`SectionLabel tone="accent"`) são label, não CTA — permitidos.
- Radius 2px default (não adicionar rounded-*). Preços/números tabulares: `tabular-nums`, Barlow Condensed (`font-display`).
- Commits: Conventional Commits em PT, subject ≤50 chars.
- Testes unit ficam colocated (`*.test.ts` ao lado do fonte) e NÃO entram na lista `INTEGRATION` de `apps/web/vitest.config.ts` (são puros, rodam no CI).
- O dev server da sessão está em `http://localhost:3010` (HMR ativo). Smoke visual usa as rotas `/product/compressor-de-ar-100l-2hp` (N=2 specs, sem vídeo — pior caso real) e `/product/serra-circular-7-1-4-1400w` (N=3).

---

### Task 1: Algoritmo `buildPlateLayout` (função pura, TDD)

**Files:**
- Create: `apps/web/src/app/(shop)/product/[slug]/_components/plate-layout.ts`
- Test: `apps/web/src/app/(shop)/product/[slug]/_components/plate-layout.test.ts`

**Interfaces:**
- Consumes: nada (função pura, sem dependências).
- Produces: `buildPlateLayout(specCount: number, hasMedia: boolean, cols: 2 | 4): PlateLayout`, tipos `PlateLayout` e `PlateAnchorCell` (usados pela Task 2 exatamente como definidos abaixo).

Regra (da spec §3.4): com mídia no desktop, a célula de mídia ocupa 2×2 no canto direito (colunas 3–4, linhas 1–2) e até 4 specs preenchem as colunas 1–2 com "spans de crescimento"; o resto flui em linhas cheias de `cols` células, e a sobra final (1..cols-1) vira uma linha própria de colunas iguais (sobra 1 = célula horizontal full-width). Sem mídia (ou no mobile, cols=2), não há zona de âncora: só linhas cheias + sobra.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/src/app/(shop)/product/[slug]/_components/plate-layout.test.ts
import { describe, expect, it } from "vitest";

import { buildPlateLayout } from "./plate-layout";

describe("buildPlateLayout", () => {
	it("N=0: placa vazia (a seção decide não renderizar)", () => {
		expect(buildPlateLayout(0, false, 4)).toEqual({
			anchor: null,
			fullRows: [],
			leftoverRow: [],
		});
	});

	it("N=2 sem mídia: sobra vira linha de metades", () => {
		expect(buildPlateLayout(2, false, 4)).toEqual({
			anchor: null,
			fullRows: [],
			leftoverRow: [0, 1],
		});
	});

	it("N=4 sem mídia: uma linha cheia, sem sobra", () => {
		expect(buildPlateLayout(4, false, 4)).toEqual({
			anchor: null,
			fullRows: [[0, 1, 2, 3]],
			leftoverRow: [],
		});
	});

	it("N=7 sem mídia: linha cheia + sobra de 3 (terços)", () => {
		expect(buildPlateLayout(7, false, 4)).toEqual({
			anchor: null,
			fullRows: [[0, 1, 2, 3]],
			leftoverRow: [4, 5, 6],
		});
	});

	it("N=11 sem mídia: 4 + 4 + sobra de 3", () => {
		expect(buildPlateLayout(11, false, 4)).toEqual({
			anchor: null,
			fullRows: [
				[0, 1, 2, 3],
				[4, 5, 6, 7],
			],
			leftoverRow: [8, 9, 10],
		});
	});

	it("N=1 com mídia: célula única cresce pra 2×2 ao lado da mídia", () => {
		expect(buildPlateLayout(1, true, 4)).toEqual({
			anchor: { cells: [{ specIndex: 0, colSpan: 2, rowSpan: 2 }] },
			fullRows: [],
			leftoverRow: [],
		});
	});

	it("N=2 com mídia: duas células largas empilhadas", () => {
		expect(buildPlateLayout(2, true, 4)).toEqual({
			anchor: {
				cells: [
					{ specIndex: 0, colSpan: 2, rowSpan: 1 },
					{ specIndex: 1, colSpan: 2, rowSpan: 1 },
				],
			},
			fullRows: [],
			leftoverRow: [],
		});
	});

	it("N=3 com mídia: larga em cima, duas simples embaixo", () => {
		expect(buildPlateLayout(3, true, 4)).toEqual({
			anchor: {
				cells: [
					{ specIndex: 0, colSpan: 2, rowSpan: 1 },
					{ specIndex: 1, colSpan: 1, rowSpan: 1 },
					{ specIndex: 2, colSpan: 1, rowSpan: 1 },
				],
			},
			fullRows: [],
			leftoverRow: [],
		});
	});

	it("N=5 com mídia: 4 na âncora + sobra 1 full-width", () => {
		expect(buildPlateLayout(5, true, 4)).toEqual({
			anchor: {
				cells: [
					{ specIndex: 0, colSpan: 1, rowSpan: 1 },
					{ specIndex: 1, colSpan: 1, rowSpan: 1 },
					{ specIndex: 2, colSpan: 1, rowSpan: 1 },
					{ specIndex: 3, colSpan: 1, rowSpan: 1 },
				],
			},
			fullRows: [],
			leftoverRow: [4],
		});
	});

	it("N=8 com mídia: 4 na âncora + linha cheia", () => {
		expect(buildPlateLayout(8, true, 4)).toEqual({
			anchor: {
				cells: [
					{ specIndex: 0, colSpan: 1, rowSpan: 1 },
					{ specIndex: 1, colSpan: 1, rowSpan: 1 },
					{ specIndex: 2, colSpan: 1, rowSpan: 1 },
					{ specIndex: 3, colSpan: 1, rowSpan: 1 },
				],
			},
			fullRows: [[4, 5, 6, 7]],
			leftoverRow: [],
		});
	});

	it("mobile (cols=2) ignora mídia e quebra em pares", () => {
		expect(buildPlateLayout(5, true, 2)).toEqual({
			anchor: null,
			fullRows: [
				[0, 1],
				[2, 3],
			],
			leftoverRow: [4],
		});
	});

	it("invariante: todo índice aparece exatamente uma vez (N=0..12 × mídia × cols)", () => {
		for (const cols of [2, 4] as const) {
			for (const hasMedia of [false, true]) {
				for (let n = 0; n <= 12; n++) {
					const layout = buildPlateLayout(n, hasMedia, cols);
					const seen = [
						...(layout.anchor?.cells.map((c) => c.specIndex) ?? []),
						...layout.fullRows.flat(),
						...layout.leftoverRow,
					].sort((a, b) => a - b);
					expect(seen).toEqual(Array.from({ length: n }, (_, i) => i));
					for (const row of layout.fullRows) {
						expect(row).toHaveLength(cols);
					}
					expect(layout.leftoverRow.length).toBeLessThan(cols);
				}
			}
		}
	});
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `bun run --filter=web test plate-layout`
Expected: FAIL — `Cannot find module './plate-layout'` (ou equivalente).

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/app/(shop)/product/[slug]/_components/plate-layout.ts

/** Célula de spec na zona da âncora (desktop com mídia). */
export interface PlateAnchorCell {
	specIndex: number;
	colSpan: 1 | 2;
	rowSpan: 1 | 2;
}

export interface PlateLayout {
	/** Zona das linhas 1–2, com a mídia 2×2 à direita. Null sem mídia ou cols=2. */
	anchor: { cells: PlateAnchorCell[] } | null;
	/** Linhas completas (tamanho === cols) de índices de spec. */
	fullRows: number[][];
	/** Sobra final (1..cols-1 índices) — renderiza como linha de colunas iguais. */
	leftoverRow: number[];
}

const ANCHOR_SLOTS = 4;

/** Spans de crescimento pros slots ao lado da mídia (2 colunas × 2 linhas). */
function anchorCells(k: number): PlateAnchorCell[] {
	switch (k) {
		case 0:
			return [];
		case 1:
			return [{ specIndex: 0, colSpan: 2, rowSpan: 2 }];
		case 2:
			return [
				{ specIndex: 0, colSpan: 2, rowSpan: 1 },
				{ specIndex: 1, colSpan: 2, rowSpan: 1 },
			];
		case 3:
			return [
				{ specIndex: 0, colSpan: 2, rowSpan: 1 },
				{ specIndex: 1, colSpan: 1, rowSpan: 1 },
				{ specIndex: 2, colSpan: 1, rowSpan: 1 },
			];
		default:
			return [0, 1, 2, 3].map((specIndex) => ({
				specIndex,
				colSpan: 1,
				rowSpan: 1,
			}));
	}
}

/**
 * Layout da placa técnica (spec §3.4). `cols` = colunas base do grid
 * (4 desktop, 2 mobile). No mobile a mídia vira bloco full-width fora do
 * grid, então `hasMedia` só produz âncora quando cols === 4.
 */
export function buildPlateLayout(
	specCount: number,
	hasMedia: boolean,
	cols: 2 | 4
): PlateLayout {
	const indices = Array.from({ length: specCount }, (_, i) => i);
	const withAnchor = hasMedia && cols === 4;

	let anchor: PlateLayout["anchor"] = null;
	let rest = indices;

	if (withAnchor) {
		const k = Math.min(specCount, ANCHOR_SLOTS);
		anchor = { cells: anchorCells(k) };
		rest = indices.slice(k);
	}

	const fullRowCount = Math.floor(rest.length / cols);
	const fullRows: number[][] = [];
	for (let i = 0; i < fullRowCount; i++) {
		fullRows.push(rest.slice(i * cols, (i + 1) * cols));
	}
	const leftoverRow = rest.slice(fullRowCount * cols);

	return { anchor, fullRows, leftoverRow };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `bun run --filter=web test plate-layout`
Expected: PASS (11 testes).

- [ ] **Step 5: Gate + commit**

```bash
bun check-types
git add "apps/web/src/app/(shop)/product/[slug]/_components/plate-layout.ts" "apps/web/src/app/(shop)/product/[slug]/_components/plate-layout.test.ts"
git commit -m "feat: algoritmo de layout da placa técnica"
```

---

### Task 2: `ProductSpecs` vira placa técnica

**Files:**
- Create: `apps/web/src/app/(shop)/product/[slug]/_components/plate-media.tsx`
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-specs.tsx` (reescrita completa)
- Modify: `apps/web/src/app/(shop)/product/[slug]/page.tsx` (call site do `ProductSpecs`, linhas ~114–118)

**Interfaces:**
- Consumes: `buildPlateLayout`, `PlateAnchorCell` de `./plate-layout` (Task 1); `fmtSpecNumber`/`fmtSpecRange` de `@/lib/format`; `SectionLabel` de `@/components/section-label`; `Dialog, DialogContent, DialogTitle, DialogTrigger` de `@emach/ui/components/dialog`.
- Produces: `ProductSpecs({ attributes, categoryName, images, tool, video })` (novas props `images: ToolDetail["images"]` e `video: { url: string; poster: string | null } | null`); `PlateMedia({ image, name, video })` (client component interno).

**Morre neste task:** hero-cards `bg-near-black`, painel preto "Especificações completas", `HERO_COUNT` e `heroParts`.

- [ ] **Step 1: Criar `plate-media.tsx`** (client — vídeo abre em Dialog, mesmo padrão do zoom)

```tsx
// apps/web/src/app/(shop)/product/[slug]/_components/plate-media.tsx
"use client";

import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@emach/ui/components/dialog";
import { Play } from "lucide-react";
import Image from "next/image";

interface PlateMediaProps {
	/** Imagem da célula (2ª foto do produto; fallback de poster do vídeo). */
	image: { url: string } | null;
	name: string;
	video: { url: string; poster: string | null } | null;
}

const MEDIA_SIZES = "(min-width: 1024px) 40vw, 100vw";

/**
 * Conteúdo da célula de mídia da placa técnica: vídeo (Dialog) → segunda
 * foto → nada (o caller nem renderiza a célula). Preenche o pai, que dá o
 * tamanho (célula 2×2 no desktop, bloco full-width no mobile).
 */
export function PlateMedia({ image, name, video }: PlateMediaProps) {
	if (video) {
		const posterUrl = video.poster ?? image?.url ?? null;
		return (
			<Dialog>
				<DialogTrigger className="group relative flex h-full w-full cursor-pointer items-center justify-center bg-image-bg focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2">
					{posterUrl ? (
						<Image
							alt={`${name} — vídeo`}
							className="object-contain p-4"
							fill
							sizes={MEDIA_SIZES}
							src={posterUrl}
						/>
					) : (
						<Play
							aria-hidden="true"
							className="size-10 text-gray-60"
							strokeWidth={1.5}
						/>
					)}
					<span className="absolute right-3 bottom-3 z-[1] flex items-center gap-1.5 bg-near-black/85 px-2.5 py-1 font-bold font-display text-[11px] text-white uppercase tracking-[0.08em]">
						<Play aria-hidden="true" className="size-3 fill-white" />
						Ver em ação
					</span>
				</DialogTrigger>
				<DialogContent className="border-none bg-black/95 p-0 ring-0">
					<DialogTitle className="sr-only">{`${name} — vídeo`}</DialogTitle>
					{/* biome-ignore lint/a11y/useMediaCaption: vídeo de produto sem legendas (v1 lean, issue #137) */}
					<video
						autoPlay
						className="h-full w-full"
						controls
						poster={video.poster ?? undefined}
						src={video.url}
					/>
				</DialogContent>
			</Dialog>
		);
	}

	if (image) {
		return (
			<div className="relative flex h-full w-full items-center justify-center bg-image-bg">
				<Image
					alt={name}
					className="object-contain p-4"
					fill
					sizes={MEDIA_SIZES}
					src={image.url}
				/>
			</div>
		);
	}

	return null;
}
```

- [ ] **Step 2: Reescrever `product-specs.tsx`**

Substituir o arquivo inteiro por:

```tsx
// apps/web/src/app/(shop)/product/[slug]/_components/product-specs.tsx
import type { ToolDetail } from "@emach/db/queries/tools";
import { cn } from "@emach/ui/lib/utils";
import type { ReactNode } from "react";
import { SectionLabel } from "@/components/section-label";
import { fmtSpecNumber, fmtSpecRange } from "@/lib/format";
import { buildPlateLayout, type PlateAnchorCell } from "./plate-layout";
import { PlateMedia } from "./plate-media";

interface ProductSpecsProps {
	attributes: ToolDetail["attributes"];
	categoryName?: string | null;
	images: ToolDetail["images"];
	tool: ToolDetail["tool"];
	video: { url: string; poster: string | null } | null;
}

type Attr = ToolDetail["attributes"][number];

// Separa "650 W" → número grande + unidade menor. Valores sem unidade
// numérica ("até 2.800 RPM", "Sim") caem no else e renderizam inteiros.
const HERO_VALUE = /^([\d.,]+)\s*(\S.*)$/;

function fmtAttr(item: Attr): string {
	const { definition, value } = item;
	const unit = definition.unit ?? "";
	switch (definition.inputType) {
		case "boolean": {
			if (value.valueBool == null) {
				return "—";
			}
			return value.valueBool ? "Sim" : "Não";
		}
		case "numeric_range":
			return fmtSpecRange(value.valueNumeric, value.valueNumericMax, unit);
		case "number":
			return fmtSpecNumber(value.valueNumeric, unit);
		default:
			return value.valueText ?? "—";
	}
}

function SpecLabel({ children }: { children: ReactNode }) {
	return (
		<span className="font-display font-semibold text-[10.5px] text-gray-60 uppercase tracking-[0.12em]">
			{children}
		</span>
	);
}

function specValueNode(attr: Attr): ReactNode {
	const formatted = fmtAttr(attr);
	const numeric =
		attr.definition.inputType === "number" ||
		attr.definition.inputType === "numeric_range";
	const match = numeric ? HERO_VALUE.exec(formatted) : null;

	if (match) {
		return (
			<span className="font-bold font-display text-[30px] leading-none tabular-nums sm:text-[36px]">
				{match[1]}
				<span className="ml-1 font-semibold text-[14px] text-gray-60 sm:text-[16px]">
					{match[2]}
				</span>
			</span>
		);
	}
	return (
		<span
			className={cn(
				"font-semibold leading-tight",
				numeric ? "font-display text-[22px]" : "text-[16px]"
			)}
		>
			{formatted}
		</span>
	);
}

/** Célula padrão (label em cima, valor embaixo) ou larga (sobra 1: horizontal). */
function SpecCell({
	attr,
	className,
	wide = false,
}: {
	attr: Attr;
	className?: string;
	wide?: boolean;
}) {
	if (wide) {
		return (
			<div
				className={cn(
					"flex items-baseline justify-between gap-4 px-4 py-3.5 sm:px-5",
					className
				)}
			>
				<SpecLabel>{attr.definition.label}</SpecLabel>
				{specValueNode(attr)}
			</div>
		);
	}
	return (
		<div className={cn("px-4 py-3.5 sm:px-5 sm:py-4", className)}>
			<SpecLabel>{attr.definition.label}</SpecLabel>
			<div className="mt-2">{specValueNode(attr)}</div>
		</div>
	);
}

/** Índice da primeira célula da última "linha" da zona da âncora, por k. */
function anchorLastRowStart(k: number): number {
	if (k <= 1) {
		return 0;
	}
	if (k <= 3) {
		return 1;
	}
	return 2;
}

const LEFTOVER_COLS: Record<number, string> = {
	2: "grid-cols-2",
	3: "grid-cols-3",
};

export function ProductSpecs({
	attributes,
	categoryName,
	images,
	tool,
	video,
}: ProductSpecsProps) {
	const sorted = [...attributes].sort((a, b) => a.sortOrder - b.sortOrder);
	const n = sorted.length;
	const mediaImage = images[1] ?? null;
	const hasMedia = Boolean(video || mediaImage);

	if (n === 0 && !hasMedia && !tool.description) {
		return null;
	}

	const desktop = buildPlateLayout(n, hasMedia, 4);
	const mobile = buildPlateLayout(n, false, 2);

	const renderLeftover = (row: number[], cols: 2 | 4) => {
		if (row.length === 0) {
			return null;
		}
		if (row.length === 1) {
			return <SpecCell attr={sorted[row[0]]} wide />;
		}
		return (
			<div
				className={cn(
					"grid divide-x divide-border",
					LEFTOVER_COLS[row.length]
				)}
			>
				{row.map((i) => (
					<SpecCell attr={sorted[i]} key={sorted[i].definition.id} />
				))}
			</div>
		);
	};

	const anchorCellClass = (
		cell: PlateAnchorCell,
		index: number,
		cells: PlateAnchorCell[]
	) =>
		cn(
			"border-border border-r",
			cell.colSpan === 2 && "col-span-2",
			cell.rowSpan === 2 && "row-span-2",
			index < anchorLastRowStart(cells.length) && "border-border border-b"
		);

	return (
		<section aria-label="Ficha técnica do produto" className="py-14">
			{/* Largura alinhada ao topo (galeria w-1/2 + buy box w-[480px],
			    centrados) — replica 50vw + 480px, com teto p/ telas estreitas. */}
			<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]">
				<div className="mb-5 flex items-baseline justify-between gap-6">
					<SectionLabel tone="accent">Ficha técnica</SectionLabel>
					{categoryName && (
						<span className="font-display font-semibold text-[11.5px] text-gray-60 uppercase tracking-[0.1em]">
							{categoryName}
						</span>
					)}
				</div>

				{tool.description && (
					<p className="mb-7 max-w-[70ch] text-[15px] text-near-black/80 leading-relaxed">
						{tool.description}
					</p>
				)}

				{n === 0 ? (
					hasMedia && (
						<div className="relative aspect-video max-w-[560px] border border-border">
							<PlateMedia image={mediaImage} name={tool.name} video={video} />
						</div>
					)
				) : (
					<>
						{/* Desktop: placa 4 colunas (âncora de mídia quando houver) */}
						<div className="hidden divide-y divide-border border border-border lg:block">
							{desktop.anchor && (
								<div className="grid auto-rows-fr grid-cols-4">
									{desktop.anchor.cells.map((cell, i, cells) => (
										<SpecCell
											attr={sorted[cell.specIndex]}
											className={anchorCellClass(cell, i, cells)}
											key={sorted[cell.specIndex].definition.id}
										/>
									))}
									<div className="col-span-2 col-start-3 row-span-2 row-start-1 min-h-[220px]">
										<PlateMedia
											image={mediaImage}
											name={tool.name}
											video={video}
										/>
									</div>
								</div>
							)}
							{desktop.fullRows.map((row) => (
								<div
									className="grid grid-cols-4 divide-x divide-border"
									key={sorted[row[0]].definition.id}
								>
									{row.map((i) => (
										<SpecCell attr={sorted[i]} key={sorted[i].definition.id} />
									))}
								</div>
							))}
							{renderLeftover(desktop.leftoverRow, 4)}
						</div>

						{/* Mobile: mídia full-width + placa 2 colunas */}
						<div className="lg:hidden">
							{hasMedia && (
								<div className="relative mb-3 aspect-video border border-border">
									<PlateMedia
										image={mediaImage}
										name={tool.name}
										video={video}
									/>
								</div>
							)}
							<div className="divide-y divide-border border border-border">
								{mobile.fullRows.map((row) => (
									<div
										className="grid grid-cols-2 divide-x divide-border"
										key={sorted[row[0]].definition.id}
									>
										{row.map((i) => (
											<SpecCell
												attr={sorted[i]}
												key={sorted[i].definition.id}
											/>
										))}
									</div>
								))}
								{renderLeftover(mobile.leftoverRow, 2)}
							</div>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
```

- [ ] **Step 3: Atualizar o call site em `page.tsx`**

Em `apps/web/src/app/(shop)/product/[slug]/page.tsx`, trocar:

```tsx
				<ProductSpecs
					attributes={detail.attributes}
					categoryName={primaryCategoryName}
					tool={detail.tool}
				/>
```

por:

```tsx
				<ProductSpecs
					attributes={detail.attributes}
					categoryName={primaryCategoryName}
					images={detail.images}
					tool={detail.tool}
					video={video}
				/>
```

(a const `video` já existe no arquivo, linhas ~85–87.)

- [ ] **Step 4: Gates**

Run: `bun check-types` → PASS.
Run: `bun run --filter=web test plate-layout` → PASS.
Smoke: `curl -s http://localhost:3010/product/compressor-de-ar-100l-2hp | grep -o "Ficha técnica" | head -1` → imprime `Ficha técnica`. Abrir a rota no browser: placa uniforme com 2 células de metade (N=2, sem vídeo; a 2ª foto do seed existe → célula de mídia 2×2 à direita e as 2 specs com spans de crescimento à esquerda).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/_components/plate-media.tsx" "apps/web/src/app/(shop)/product/[slug]/_components/product-specs.tsx" "apps/web/src/app/(shop)/product/[slug]/page.tsx"
git commit -m "feat: ficha técnica vira placa na PDP"
```

---

### Task 3: Breadcrumb (componente + página + JSON-LD)

**Files:**
- Create: `apps/web/src/app/(shop)/product/[slug]/_components/breadcrumb.tsx`
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-json-ld.tsx` (adicionar `BreadcrumbJsonLd`)
- Modify: `apps/web/src/app/(shop)/product/[slug]/page.tsx` (renderizar breadcrumb + JSON-LD)

**Interfaces:**
- Consumes: `detail.primaryCategory` (`{ slug, name } | null`), `detail.tool.name`, `detail.tool.slug`.
- Produces: `Breadcrumb({ category, productName })` e `BreadcrumbJsonLd({ category, productName, slug })`.

- [ ] **Step 1: Criar `breadcrumb.tsx`** (Server Component)

```tsx
// apps/web/src/app/(shop)/product/[slug]/_components/breadcrumb.tsx
import Link from "next/link";

interface BreadcrumbProps {
	category: { slug: string; name: string } | null;
	productName: string;
}

/** Trilha estrutural da PDP; no mobile colapsa pra "‹ Categoria". */
export function Breadcrumb({ category, productName }: BreadcrumbProps) {
	return (
		<nav aria-label="Navegação estrutural" className="text-[12px] text-gray-60">
			<ol className="hidden flex-wrap items-center gap-1.5 sm:flex">
				<li>
					<Link className="transition-colors hover:text-near-black" href="/">
						Início
					</Link>
				</li>
				<li aria-hidden="true">/</li>
				<li>
					<Link
						className="transition-colors hover:text-near-black"
						href="/catalog"
					>
						Catálogo
					</Link>
				</li>
				{category && (
					<>
						<li aria-hidden="true">/</li>
						<li>
							<Link
								className="transition-colors hover:text-near-black"
								href={`/catalog?cat=${category.slug}`}
							>
								{category.name}
							</Link>
						</li>
					</>
				)}
				<li aria-hidden="true">/</li>
				<li aria-current="page" className="font-semibold text-near-black">
					{productName}
				</li>
			</ol>
			<div className="sm:hidden">
				<Link
					className="font-semibold text-near-black"
					href={category ? `/catalog?cat=${category.slug}` : "/catalog"}
				>
					‹ {category?.name ?? "Catálogo"}
				</Link>
			</div>
		</nav>
	);
}
```

- [ ] **Step 2: Adicionar `BreadcrumbJsonLd` em `product-json-ld.tsx`** (append no fim do arquivo)

```tsx
export function BreadcrumbJsonLd({
	category,
	productName,
	slug,
}: {
	category: { slug: string; name: string } | null;
	productName: string;
	slug: string;
}) {
	const items = [
		{ name: "Início", item: BASE_URL },
		{ name: "Catálogo", item: `${BASE_URL}/catalog` },
		...(category
			? [
					{
						name: category.name,
						item: `${BASE_URL}/catalog?cat=${category.slug}`,
					},
				]
			: []),
		{ name: productName, item: `${BASE_URL}/product/${slug}` },
	];

	const data = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((entry, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: entry.name,
			item: entry.item,
		})),
	};

	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD exige <script> inline; "<" escapado bloqueia injeção via dados do catálogo
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, "\\u003c"),
			}}
			type="application/ld+json"
		/>
	);
}
```

- [ ] **Step 3: Integrar no `page.tsx`**

Imports novos:

```tsx
import { Breadcrumb } from "./_components/breadcrumb";
import { BreadcrumbJsonLd } from "./_components/product-json-ld";
```

(`BreadcrumbJsonLd` sai do mesmo módulo do `ProductJsonLd` — juntar no import existente.)

No JSX, logo após `<ProductJsonLd detail={detail} />`:

```tsx
			<BreadcrumbJsonLd
				category={detail.primaryCategory}
				productName={detail.tool.name}
				slug={detail.tool.slug ?? detail.tool.id}
			/>
```

E dentro de `<main id="main-content">`, ANTES do `<div className="flex flex-col ...">` do topo:

```tsx
				<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)] pt-6">
					<Breadcrumb
						category={detail.primaryCategory}
						productName={detail.tool.name}
					/>
				</div>
```

E no `<div className="flex flex-col items-center gap-8 px-5 py-8 ...">` do topo, trocar `py-8` por `pt-4 pb-8` (o breadcrumb já dá o respiro superior).

- [ ] **Step 4: Gates**

Run: `bun check-types` → PASS (o `typedRoutes` valida os `href`).
Smoke: abrir `http://localhost:3010/product/compressor-de-ar-100l-2hp` — trilha "Início / Catálogo / Compressores de Ar / Compressor de Ar 100L 2HP" acima da galeria; view-source contém `"@type":"BreadcrumbList"`.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/_components/breadcrumb.tsx" "apps/web/src/app/(shop)/product/[slug]/_components/product-json-ld.tsx" "apps/web/src/app/(shop)/product/[slug]/page.tsx"
git commit -m "feat: breadcrumb na página de produto"
```

---

### Task 4: Galeria com thumbs em overlay

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-gallery.tsx`

**Interfaces:**
- Consumes: `buildSlots`/`slotKey`/`GallerySlot` de `./gallery-slots` (inalterados).
- Produces: mesma API externa (`ProductGallery({ categorySlug, images, name, video })`) — só muda o layout interno.

**Morre neste task:** a coluna lateral de thumbs, o `Carousel` vertical (imports `Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious`), `MAX_STATIC_THUMBS` e `needsCarousel`.

- [ ] **Step 1: Ajustar `ThumbButton`**

Trocar o `className` do `<button>` para chips fixos de overlay (ativo = borda vermelha; inativo = hairline):

```tsx
			className={cn(
				"relative size-11 shrink-0 cursor-pointer overflow-hidden border-2 bg-white focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2",
				isActive ? "border-emach-red" : "border-border"
			)}
```

(remove `aspect-square w-full` e `bg-image-bg`; o resto do componente fica igual.)

- [ ] **Step 2: Substituir o JSX de retorno do `ProductGallery`**

Trocar todo o bloco `return (...)` por:

```tsx
	return (
		<div className="w-full lg:w-1/2">
			<div className="relative aspect-square w-full overflow-hidden bg-image-bg">
				{renderMainSlot()}
				{slots.length > 1 && (
					<div className="absolute bottom-3 left-3 z-[2] flex max-w-[calc(100%-4.5rem)] gap-2 overflow-x-auto">
						{slots.map((slot, i) => renderThumb(slot, i))}
					</div>
				)}
			</div>
		</div>
	);
```

Remover os imports do `Carousel*`, a const `MAX_STATIC_THUMBS` e a const `needsCarousel`.

- [ ] **Step 3: Recalibrar `GALLERY_SIZES`**

A imagem principal agora ocupa a metade esquerda inteira (era ~5/6 dela):

```tsx
const GALLERY_SIZES = "(min-width: 1024px) 50vw, 100vw";
```

- [ ] **Step 4: Gates**

Run: `bun check-types` → PASS (confirma que não sobrou import morto — o lint do hook acusa unused imports).
Run: `bun run --filter=web test gallery-slots` → PASS (lógica de slots intacta).
Smoke: na rota do compressor, thumbs como chips brancos sobrepostos no canto inferior esquerdo da imagem (3 chips), ativo com borda vermelha; clique troca a imagem; lupa de zoom continua no canto direito.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/_components/product-gallery.tsx"
git commit -m "feat: thumbs em overlay na galeria da PDP"
```

---

### Task 5: Card branco de compra no buy box

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-info.tsx` (só o JSX de retorno principal; lógica/handlers intactos)

**Interfaces:**
- Consumes: tudo que o arquivo já importa; nenhuma prop muda.
- Produces: mesma API externa.

O bloco transacional (preço → parcelas → voltagem → quantidade → CTAs) entra num card `bg-white border border-border`; frete, trust strip e compartilhar ficam fora, abaixo. `buyActionsRef` continua no wrapper dos CTAs (dentro do card — o IntersectionObserver da sticky bar não muda).

- [ ] **Step 1: Reestruturar o JSX**

No `return` principal (após o header de título/SKU/rating), substituir a sequência `div.border-y de preço` + `fieldset de voltagem` + `div.space-y-3 dos CTAs` + `button de share` + `FreightCalculator` + `div da trust strip` por:

```tsx
			<div className="border border-border bg-white p-5">
				<div className="flex items-center gap-3">
					{discountPct > 0 && (
						<span className="bg-emach-red px-2 py-1 font-bold font-display text-[14px] text-white tracking-[0.04em]">
							−{discountPct}%
						</span>
					)}
					<span className="font-bold font-display text-[40px] tabular-nums">
						{fmtNumericBRL(finalAmount)}
					</span>
					{discounted != null && (
						<span className="text-[16px] text-gray-60 tabular-nums line-through">
							{fmtNumericBRL(selected.priceAmount)}
						</span>
					)}
				</div>
				{savingsCents > 0 && (
					<div className="mt-1.5 font-semibold text-[13px] text-success-text">
						Você economiza {fmtBRL(savingsCents)}
					</div>
				)}
				<div className="mt-1 text-[13px] text-gray-60">
					Em até <strong>12× de {fmtBRL(installmentCents)}</strong> sem juros
				</div>

				{orderedVariants.length > 1 && (
					<fieldset className="m-0 mt-5 min-w-0 border-0 p-0">
						<legend className="mb-2.5 font-semibold text-base">Voltagem</legend>
						<div className="flex flex-wrap gap-2">
							{orderedVariants.map((v) => {
								const variantStock = stockByVariant[v.id] ?? false;
								const isActive = v.id === selectedVariantId;
								const vPrice =
									applyDiscount(v.priceAmount, activePromotion) ?? v.priceAmount;
								return (
									<button
										aria-pressed={isActive}
										className={cn(
											"flex min-w-[120px] flex-col gap-1 border-2 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2",
											!variantStock &&
												"cursor-not-allowed border-gray-20 border-dashed opacity-45",
											variantStock &&
												isActive &&
												"border-emach-red bg-near-black text-white",
											variantStock &&
												!isActive &&
												"border-gray-20 bg-background text-foreground hover:border-foreground"
										)}
										disabled={!variantStock}
										key={v.id}
										onClick={() => variantStock && setSelectedVariantId(v.id)}
										type="button"
									>
										<span className="flex items-center justify-between gap-2">
											<span className="font-display font-semibold text-[12px] uppercase tracking-[0.12em] opacity-75">
												{v.voltage ?? "Padrão"}
											</span>
											{!variantStock && (
												<span className="opacity-100">
													<span className="border border-emach-red/60 px-1.5 font-display text-[9px] text-emach-red-hover uppercase tracking-[0.08em]">
														Esgotado
													</span>
												</span>
											)}
										</span>
										{variantPricesDiffer && (
											<span
												className={cn(
													"font-bold text-[15px] tabular-nums",
													!variantStock && "line-through"
												)}
											>
												{fmtNumericBRL(vPrice)}
											</span>
										)}
									</button>
								);
							})}
						</div>
					</fieldset>
				)}

				<div className="mt-5 space-y-3" ref={buyActionsRef}>
					<div className="flex items-stretch gap-3">
						<QuantityPicker onChange={setQty} value={qty} />
						<EmachButton
							disabled={!inStock}
							full
							icon={<ShoppingBag size={16} />}
							onClick={handleAddToCart}
							size="md"
							variant="dark"
						>
							{inStock ? "Adicionar ao carrinho" : "Esgotado"}
						</EmachButton>
					</div>
					<EmachButton
						disabled={!inStock}
						full
						icon={<Zap size={16} />}
						onClick={handleBuyNow}
						size="md"
						variant="primary"
					>
						Comprar agora
					</EmachButton>
				</div>
			</div>

			<FreightCalculator
				quantity={qty}
				subtotal={numericToCents(finalAmount) * qty}
				toolId={tool.id}
			/>

			<div className="flex flex-col border border-border sm:flex-row">
				<div className="flex flex-1 items-center gap-2.5 border-border border-b px-4 py-3 sm:border-r sm:border-b-0">
					<Truck size={16} />
					<div>
						<div className="font-semibold text-[12px]">Frete Brasil</div>
						<div className="text-[10.5px] text-gray-60">pelo seu CEP</div>
					</div>
				</div>
				<div className="flex flex-1 items-center gap-2.5 border-border border-b px-4 py-3 sm:border-r sm:border-b-0">
					<CheckCircle size={16} />
					<div>
						<div className="font-semibold text-[12px]">Garantia 2 anos</div>
						<div className="text-[10.5px] text-gray-60">com a marca</div>
					</div>
				</div>
				<div className="flex flex-1 items-center gap-2.5 px-4 py-3">
					<ShieldCheck size={16} />
					<div>
						<div className="font-semibold text-[12px]">Compra segura</div>
						<div className="text-[10.5px] text-gray-60">nota fiscal</div>
					</div>
				</div>
			</div>

			<button
				aria-label="Compartilhar produto"
				className="emach-ghost-btn inline-flex items-center gap-2 font-semibold text-[13px] text-gray-60"
				onClick={handleShare}
				type="button"
			>
				{shared ? (
					<>
						<Check className="text-success" size={14} />
						Link copiado
					</>
				) : (
					<>
						<Share2 size={14} />
						Compartilhar
					</>
				)}
			</button>
```

(`StickyBuyBar` permanece no fim, inalterado. O branch `if (!selected)` também fica como está.)

- [ ] **Step 2: Gates**

Run: `bun check-types` → PASS.
Smoke: card branco com borda hairline envolvendo preço/voltagem/CTAs; frete, trust strip e compartilhar abaixo dele; rolar além dos CTAs faz a `StickyBuyBar` aparecer (o observer continua funcionando); adicionar ao carrinho segue com toast.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/_components/product-info.tsx"
git commit -m "feat: card branco de compra no buy box"
```

---

### Task 6: Avaliações nunca somem (faixa vazia)

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-reviews-section.tsx`

**Interfaces:**
- Consumes: `SectionLabel` de `@/components/section-label` (import novo).
- Produces: mesma API externa; muda só o retorno quando `total === 0`.

- [ ] **Step 1: Trocar o `return null`**

Adicionar o import:

```tsx
import { SectionLabel } from "@/components/section-label";
```

Substituir:

```tsx
	if (reviewsResult.total === 0) {
		return null;
	}
```

por:

```tsx
	if (reviewsResult.total === 0) {
		return (
			<section aria-label="Avaliações do produto" className="py-14">
				<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]">
					<div className="flex flex-col gap-4 bg-near-black px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-6">
						<div>
							<SectionLabel tone="accent">Avaliações</SectionLabel>
							<p className="mt-2 text-[14px] text-white/75">
								Este produto ainda não recebeu avaliações. Avaliações vêm de
								compradores verificados, com nota fiscal.
							</p>
						</div>
						<div
							aria-hidden="true"
							className="shrink-0 text-[18px] text-white/35 tracking-[4px]"
						>
							☆☆☆☆☆
						</div>
					</div>
				</div>
			</section>
		);
	}
```

Atualizar também o comentário do topo do arquivo: trocar a frase "Sem avaliações, não renderiza nada (mesmo comportamento de antes)." por "Sem avaliações, renderiza a faixa escura de confiança (spec 2026-07-03 §3.5).".

- [ ] **Step 2: Gates**

Run: `bun check-types` → PASS.
Smoke: rota do compressor (0 reviews) mostra a faixa escura com kicker vermelho "Avaliações" e 5 estrelas outline — a seção não some mais.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/_components/product-reviews-section.tsx"
git commit -m "feat: faixa de avaliações vazias na PDP"
```

---

### Task 7: Reordenar seções + header dos relacionados

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/page.tsx` (ordem das seções)
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/related-products.tsx` (header com kicker + link)

**Interfaces:**
- Consumes: `SectionHeader` de `@/components/section-header` (props: `label`, `title`, `titleSize`, `link: { href, label, variant }`).
- Produces: mesma API externa dos dois arquivos.

- [ ] **Step 1: Reordenar em `page.tsx`**

Mover o bloco `<RelatedProducts ... />` para DEPOIS do `<Suspense>` das avaliações. Ordem final dentro de `<main>`: breadcrumb → topo (galeria+info) → `<ProductSpecs>` → `<Suspense><ProductReviewsSection/></Suspense>` → `<RelatedProducts>`.

- [ ] **Step 2: Header dos relacionados**

Em `related-products.tsx`, guardar a categoria raiz pro link (o fetch já existe) — trocar o bloco `if (rootSlug) { ... }` por:

```tsx
	let rootCategory: { slug: string; name: string } | null = null;
	const rootSlug = categoryPath?.split("/").filter(Boolean)[0];
	if (rootSlug) {
		const root = await getCategoryBySlug(db, rootSlug);
		if (root) {
			rootCategory = { slug: root.slug, name: root.name };
			const { tools } = await getTools(db, {
				categoryId: root.id,
				excludeToolId: toolId,
				limit: RELATED_LIMIT,
				offset: 0,
				sort: "newest",
			});
			collect(tools);
		}
	}
```

(atenção: a linha `const rootSlug = ...` já existe — não duplicar.)

Adicionar o import:

```tsx
import { SectionHeader } from "@/components/section-header";
```

E trocar o `<h2 className="mb-6 ...">Você também pode gostar</h2>` por:

```tsx
				<SectionHeader
					label="Continue explorando"
					link={{
						href: rootCategory
							? `/catalog?cat=${rootCategory.slug}`
							: "/catalog",
						label: "Ver categoria",
						variant: "arrow",
					}}
					title="Você também pode gostar"
					titleSize="md"
				/>
```

- [ ] **Step 3: Gates**

Run: `bun check-types` → PASS.
Smoke: na rota do compressor, ordem visual = ficha → faixa de avaliações → relacionados (com kicker vermelho "Continue explorando" e link "Ver categoria →" que leva a `/catalog?cat=compressores-de-ar`).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/page.tsx" "apps/web/src/app/(shop)/product/[slug]/_components/related-products.tsx"
git commit -m "feat: reordena seções e header dos relacionados"
```

---

### Task 8: DESIGN.md — exceção do card branco + placa técnica

**Files:**
- Modify: `DESIGN.md` (§2 "Surface Standard" e §10 seção "Página de produto")

- [ ] **Step 1: §2 — registrar a exceção**

Na lista de exceções do Surface Standard (bullet "**Exceções que permanecem `#fff`**..."), acrescentar ao final da frase, antes do ponto final: `, e o **card de compra da PDP** (bloco transacional preço→CTAs em bg-white + border-border — exceção deliberada do redesign 2026-07-03; não usar como precedente pra outros cards de conteúdo)`.

- [ ] **Step 2: §10 — substituir a seção da PDP**

Localizar a seção `### Página de produto (\`product/[slug]\`) — ficha + avaliações (redesign)` e substituir o título e os bullets 2 e 3 (header de seção; hero-cards escuros) — mantendo os bullets de container/linhas edge-to-edge/avaliações — para refletir o novo padrão. Conteúdo final da seção (substituir a seção inteira por isto, preservando o que segue depois dela):

```markdown
### Página de produto (`product/[slug]`) — redesign 2026-07-03 (spec em docs/superpowers/specs/)

Editorial claro: breadcrumb (desktop trilha completa; mobile "‹ Categoria") → galeria (painel `bg-image-bg` full-width na metade esquerda, thumbs em chips brancos overlay no canto inferior esquerdo, ativa `border-emach-red`) → buy box com **card branco de compra** (única superfície `#fff` de conteúdo do sistema — exceção registrada no §2; contém preço/economia/parcelas/voltagem/qty/CTAs; frete, trust strip e share ficam fora) → **placa técnica** → avaliações → relacionados (kicker "Continue explorando" + "Ver categoria", via `SectionHeader`).

- **Container alinhado ao topo (galeria + buy box):** o topo da PDP não é containerizado — a galeria é `w-1/2` (50vw) e o buy box `w-[480px]`, centrados via `justify-center`. Toda seção abaixo usa `mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]` — **não** usar `max-w` fixo (desalinha).
- **Placa técnica** (`product-specs.tsx` + `plate-layout.ts`): grade de células hairline (`divide-x/y divide-border`, moldura `border-border`) na superfície `gray-10`; célula = label uppercase Condensed + valor (numérico: Condensed bold 30–36px + unidade; textual: Barlow semibold 16px). **Mídia** (vídeo → 2ª foto) é célula 2×2 no canto direito (desktop); **sem mídia a placa é uniforme** — sem célula-âncora (decisão do dono: número sozinho num 2×2 vira ar morto). Sobras da última linha esticam (1→linha horizontal full-width, 2→metades, 3→terços). Algoritmo em `buildPlateLayout` (função pura, unit-testada N=0..12 × mídia × cols). **Proibido na ficha:** hero-cards escuros, linhas institucionais (garantia/SKU/NF — vivem na trust strip/título), título editorial sintético.
- **Avaliações nunca somem:** 0 reviews → faixa `bg-near-black` fina (kicker "Avaliações" + copy de compradores verificados + estrelas outline). Com reviews, o bloco preto contínuo (resumo + lista) segue como descrito abaixo.
- **Avaliações = bloco preto único contínuo** (resumo + lista juntos, sem respiro — preferência do dono): um `<div bg-near-black text-white>` envolve o resumo (nota 56px + barras, grid `[300px_1fr]` com `border-b` separando da lista) **e** o `ReviewList`, que retorna um **fragment** (sem wrapper próprio) pra herdar o bg. Divisórias internas edge-to-edge: header da lista (`{n} avaliações` + `ReviewSort`, `border-white/15`) → grid 2-col de reviews (`border-white/12`) → paginação (`border-white/40`, hover `bg-white`). `ReviewSort` (select) usa trigger `border-white/30 text-white` p/ legibilidade no preto. Estrelas vermelhas (`StarRating`).
- **Linhas edge-to-edge:** dentro de painéis/listas as divisórias correm de borda a borda — padding vai nas **células**, não no container. (Na placa, o padrão vive nos `divide-*`; na lista de reviews, nas regras acima.)
- `review-list`/`review-card` só têm o modo dark. **SKU não entra na ficha**: é por-variante (`selected.sku`, muda com a voltagem, client-side) e vive sob o título no buy box.
```

- [ ] **Step 3: Gates + commit**

Conferir com `rg -n "placa técnica" DESIGN.md` que a seção nova existe e `rg -n "hero-cards escuros" DESIGN.md` que só aparece como proibição.

```bash
git add DESIGN.md
git commit -m "docs: atualiza DESIGN.md pro redesign da PDP"
```

---

### Task 9: Verificação final (gates integrados + smoke visual)

**Files:** nenhum novo (correções pontuais se um gate falhar).

- [ ] **Step 1: Gates integrados**

```bash
bun check-types
bun check
bun run --filter=web test:ci
```

Expected: os três PASS. (`test:ci` é unit-only e inclui `plate-layout.test.ts` e `gallery-slots.test.ts`.)

- [ ] **Step 2: Smoke run-time (obrigatório — `check-types` não pega SQL/coluna morta em SSR)**

Com o dev server em `http://localhost:3010`:

1. `/product/compressor-de-ar-100l-2hp` (N=2, sem vídeo, 3 fotos): breadcrumb; galeria com 3 chips overlay; card branco; ficha = placa com célula de mídia 2×2 (2ª foto) + 2 specs com spans de crescimento; faixa escura de avaliações; relacionados por último com kicker.
2. `/product/serra-circular-7-1-4-1400w` (N=3): placa com 3 specs.
3. Mobile (viewport ~400px): stack correto, breadcrumb "‹ Compressores de Ar", mídia full-width acima da placa 2-col, sticky bar aparece ao rolar.
4. Console do browser sem erros novos (`nextjs_call 3010 get_errors` via MCP next-devtools, ou console da aba).

- [ ] **Step 3: Estado final**

`git status` limpo (tudo commitado); reportar divergências visuais achadas no smoke em vez de silenciar.

---

## Self-review (executado na escrita do plano)

- **Cobertura da spec:** §3.1→Task 3 · §3.2→Task 4 · §3.3→Task 5 · §3.4→Tasks 1+2 · §3.5→Task 6 · §3.6+ordem→Task 7 · §6→Task 8 · §8→Tasks 1 e 9. §7 (seed/dados) é follow-up fora do plano — abrir issues à parte.
- **Placeholders:** nenhum TBD; todo step de código mostra o código.
- **Consistência de tipos:** `buildPlateLayout(specCount, hasMedia, cols)` e `PlateLayout {anchor, fullRows, leftoverRow}` idênticos entre Task 1 (produz) e Task 2 (consome); props novas de `ProductSpecs` batem entre Task 2 (componente) e Task 2 Step 3 (call site).
