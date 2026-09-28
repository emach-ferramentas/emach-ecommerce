# Layout adaptativo da seção de promoção — Plano de Implementação

> **Status em 2026-09-28:** implementado. Existem `apps/web/src/lib/promo-card-helpers.ts` e o teste ao lado, `promo-product-card.tsx`, o `tone="light"` de `product-rating.tsx:8`, o switch por contagem em `promo-highlight.tsx` e o gate `>= 2` em `apps/web/src/app/(shop)/page.tsx`. Os checkboxes ficam como estavam no plano original.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seção de promoção da home renderiza layouts editoriais distintos para 2, 3 e 4 produtos (e some com menos de 2), reusando a estética atual e os dados que o produto já carrega.

**Architecture:** Lógica de seleção de layout e cálculos extraídos para um helper puro testável. Um novo Client Component `PromoProductCard` (card horizontal text/img) cobre os casos de 2 e 3; o caso de 4 mantém o `ProductGrid` vertical atual. O `PromoHighlight` faz o switch por contagem; o `page.tsx` gateia o mínimo de 2.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Tailwind v4 (Base UI), Vitest (environment `node`), Drizzle.

## Global Constraints

Copiados verbatim do CLAUDE.md / spec — valem para toda task:

- Sem `console.log/warn/error` (não há logging em componentes; N/A aqui, mas nada de console).
- Proibido `: any`, `as any`, `@ts-ignore`, `@ts-expect-error`.
- `key` em `.map()` = ID estável (`tool.id`), nunca `index`.
- Imagens via `next/image` (já encapsulado em `ProductImage`).
- Sem `React.forwardRef` (React 19 usa `ref` como prop), sem `useMemo`/`useCallback` (React Compiler ativo).
- Sem `async function` em Client Component.
- Sem barrel files novos em `apps/web/src`.
- Superfície clara = `--gray-10`; aqui a seção é **escura** (`bg-black`), cards `bg-surface-elevated` (#242424) — usar os mesmos tokens do `ProductCard` atual.
- **Não editar** `packages/db/src/queries/promotions.ts` (owned-by-dashboard, sincronizado — a regra de mínimo mora no storefront).
- `bun check-types` antes de cada commit. Ler cada arquivo antes de `Edit`.
- Verificação de UI = smoke visual real na rota (`check-types` não pega layout quebrado). O projeto **não** tem testing-library/jsdom — componentes não têm unit test de render; a lógica testável vai em helpers puros.

---

## Preparação para smoke visual (dev) — pré-requisito dos testes manuais

Para ver a seção, a promoção precisa de `featured = true` (hoje nenhuma está). Em dev, antes dos smokes:

```sql
-- Marca a "Liquidação de Ferramentas Elétricas" (4 produtos) como destacada
UPDATE promotion SET featured = true
WHERE title = 'Liquidação de Ferramentas Elétricas';
```

Para testar os layouts de 2 e 3, varie a contagem em dev (ex.: remova/adicione linhas de `promotion_tool` dessa promoção, ou marque outra promoção `featured` com 2/3 produtos). Reverter ao final do smoke. `featured` é dashboard-owned — em produção a marcação é feita no dashboard.

---

## File Structure

- **Create** `apps/web/src/lib/promo-card-helpers.ts` — funções puras: `selectPromoLayout`, `computeDiscountPercent`, `computeSavings`. Responsabilidade: regras/cálculos sem JSX.
- **Create** `apps/web/src/lib/promo-card-helpers.test.ts` — testes unitários (Vitest, node).
- **Create** `apps/web/src/components/promo-product-card.tsx` — Client Component: card horizontal text/img.
- **Modify** `apps/web/src/components/product-rating.tsx` — adicionar `tone?: "default" | "light"` (estrelas brancas sobre fundo escuro).
- **Modify** `apps/web/src/components/promo-highlight.tsx` — switch de layout por contagem.
- **Modify** `apps/web/src/app/(shop)/page.tsx` — gate de mínimo (`tools.length >= 2`).

---

## Task 1: Helpers puros de layout e cálculo

**Files:**
- Create: `apps/web/src/lib/promo-card-helpers.ts`
- Test: `apps/web/src/lib/promo-card-helpers.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type PromoLayout = "hidden" | "pair" | "trio" | "grid"`
  - `selectPromoLayout(count: number): PromoLayout`
  - `computeDiscountPercent(price: string, discounted: string | null): number | null`
  - `computeSavings(price: string, discounted: string | null): number | null`

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/lib/promo-card-helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	computeDiscountPercent,
	computeSavings,
	selectPromoLayout,
} from "./promo-card-helpers";

describe("selectPromoLayout", () => {
	it("esconde a seção com menos de 2 produtos", () => {
		expect(selectPromoLayout(0)).toBe("hidden");
		expect(selectPromoLayout(1)).toBe("hidden");
	});
	it("usa 'pair' com 2 produtos", () => {
		expect(selectPromoLayout(2)).toBe("pair");
	});
	it("usa 'trio' com 3 produtos", () => {
		expect(selectPromoLayout(3)).toBe("trio");
	});
	it("usa 'grid' com 4 ou mais", () => {
		expect(selectPromoLayout(4)).toBe("grid");
		expect(selectPromoLayout(5)).toBe("grid");
	});
});

describe("computeDiscountPercent", () => {
	it("calcula o percentual arredondado", () => {
		expect(computeDiscountPercent("559", "449")).toBe(20);
	});
	it("retorna null sem desconto", () => {
		expect(computeDiscountPercent("559", null)).toBeNull();
	});
	it("retorna null quando discounted >= price", () => {
		expect(computeDiscountPercent("100", "120")).toBeNull();
	});
});

describe("computeSavings", () => {
	it("calcula a economia em reais", () => {
		expect(computeSavings("559", "449")).toBe(110);
	});
	it("retorna null sem desconto", () => {
		expect(computeSavings("559", null)).toBeNull();
	});
	it("preserva centavos", () => {
		expect(computeSavings("100.50", "90.25")).toBe(10.25);
	});
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `bun run --filter=web test src/lib/promo-card-helpers.test.ts`
Expected: FAIL — `Failed to resolve import "./promo-card-helpers"`.

- [ ] **Step 3: Implementar o helper**

Create `apps/web/src/lib/promo-card-helpers.ts`:

```ts
export type PromoLayout = "hidden" | "pair" | "trio" | "grid";

/** Decide o arranjo da seção de promoção pela contagem de produtos.
 * < 2 → "hidden" (não renderiza); 2 → "pair" (horizontais alternados);
 * 3 → "trio" (3 horizontais iguais); >= 4 → "grid" (grid vertical atual). */
export function selectPromoLayout(count: number): PromoLayout {
	if (count < 2) {
		return "hidden";
	}
	if (count === 2) {
		return "pair";
	}
	if (count === 3) {
		return "trio";
	}
	return "grid";
}

/** Percentual de desconto inteiro (ex.: 20). null se não há desconto válido. */
export function computeDiscountPercent(
	price: string,
	discounted: string | null
): number | null {
	if (discounted == null) {
		return null;
	}
	const p = Number(price);
	const d = Number(discounted);
	if (!(p > 0 && d >= 0) || d >= p) {
		return null;
	}
	return Math.round((1 - d / p) * 100);
}

/** Economia em reais (price - discounted). null se não há desconto válido. */
export function computeSavings(
	price: string,
	discounted: string | null
): number | null {
	if (discounted == null) {
		return null;
	}
	const p = Number(price);
	const d = Number(discounted);
	if (!(p > 0 && d >= 0) || d >= p) {
		return null;
	}
	return Math.round((p - d) * 100) / 100;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `bun run --filter=web test src/lib/promo-card-helpers.test.ts`
Expected: PASS (12 asserts).

- [ ] **Step 5: check-types e commit**

Run: `bun check-types`
Expected: sem erros.

```bash
git add apps/web/src/lib/promo-card-helpers.ts apps/web/src/lib/promo-card-helpers.test.ts
git commit -m "feat(promo): helpers de layout e cálculo da seção de promoção"
```

---

## Task 2: Tom claro no ProductRating

**Files:**
- Modify: `apps/web/src/components/product-rating.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `ProductRating` aceita `tone?: "default" | "light"` (default `"default"`). `"light"` = estrelas e número brancos, para fundo escuro.

**Contexto:** o componente atual usa `fill-foreground text-foreground` (escuro) — invisível sobre `#242424`. Sem testing-library, a verificação é `check-types` + smoke na Task 3.

- [ ] **Step 1: Substituir o corpo do componente**

Modify `apps/web/src/components/product-rating.tsx` — substituir a interface e a função inteiras por:

```tsx
import { cn } from "@emach/ui/lib/utils";
import { Star } from "lucide-react";

interface ProductRatingProps {
	average: number;
	className?: string;
	size?: number;
	tone?: "default" | "light";
}

const STARS = [1, 2, 3, 4, 5] as const;

export function ProductRating({
	average,
	className,
	size = 14,
	tone = "default",
}: ProductRatingProps) {
	const filled = Math.round(average);
	const filledClass =
		tone === "light" ? "fill-white text-white" : "fill-foreground text-foreground";
	const emptyClass = tone === "light" ? "text-white/30" : "text-gray-20";

	return (
		<div
			aria-label={`Avaliação ${average.toFixed(1)} de 5`}
			className={cn("flex items-center gap-2", className)}
			role="img"
		>
			<div aria-hidden className="flex items-center gap-0.5">
				{STARS.map((position) => {
					const isFilled = position <= filled;
					return (
						<Star
							className={isFilled ? filledClass : emptyClass}
							key={position}
							size={size}
							strokeWidth={1.5}
						/>
					);
				})}
			</div>
			<span
				className={cn(
					"font-semibold text-[13px] tabular-nums",
					tone === "light" && "text-white"
				)}
			>
				{average.toFixed(1)}
			</span>
		</div>
	);
}
```

- [ ] **Step 2: check-types**

Run: `bun check-types`
Expected: sem erros (uso atual sem `tone` continua válido — default preservado).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/product-rating.tsx
git commit -m "feat(rating): tom claro no ProductRating para fundo escuro"
```

---

## Task 3: PromoProductCard (card horizontal)

**Files:**
- Create: `apps/web/src/components/promo-product-card.tsx`

**Interfaces:**
- Consumes: `selectPromoLayout` não; usa `computeDiscountPercent`, `computeSavings` (Task 1); `ProductRating` com `tone="light"` (Task 2); `ProductImage`, `QuickAddButton`, `SectionLabel`, `fmtNumericBRL`, `CartItemSnapshot` (existentes).
- Produces: `PromoProductCard({ tool, voltages?, mirrored? })`.

**Tipos existentes (referência):**
- `ToolListItem` tem `id, slug, name, inStock, avgRating, reviewCount, primaryCategory?, primaryImage?, defaultVariant{ id, sku, voltage, priceAmount, discountedAmount }`.
- `CartItemSnapshot` (ver `ProductCard` atual) — montar idêntico.

- [ ] **Step 1: Implementar o componente**

Create `apps/web/src/components/promo-product-card.tsx`:

```tsx
"use client";

import type { ToolListItem } from "@emach/db/queries/tools";
import type { Voltage } from "@emach/db/schema/tools";
import { cn } from "@emach/ui/lib/utils";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { ProductRating } from "@/components/product-rating";
import { QuickAddButton } from "@/components/quick-add-button";
import { SectionLabel } from "@/components/section-label";
import type { CartItemSnapshot } from "@/lib/cart-store";
import { fmtNumericBRL } from "@/lib/format";
import {
	computeDiscountPercent,
	computeSavings,
} from "@/lib/promo-card-helpers";

interface PromoProductCardProps {
	tool: ToolListItem;
	voltages?: Voltage[];
	/** Espelha o card no desktop (imagem à direita). Usado no 2º card do caso de 2. */
	mirrored?: boolean;
}

export function PromoProductCard({
	tool,
	voltages,
	mirrored = false,
}: PromoProductCardProps) {
	const categorySlug = tool.primaryCategory?.slug ?? "";
	const categoryName = tool.primaryCategory?.name ?? "";
	const hasDiscount = tool.defaultVariant.discountedAmount != null;
	const discount = computeDiscountPercent(
		tool.defaultVariant.priceAmount,
		tool.defaultVariant.discountedAmount
	);
	const savings = computeSavings(
		tool.defaultVariant.priceAmount,
		tool.defaultVariant.discountedAmount
	);

	const snapshot: CartItemSnapshot = {
		categoryName: tool.primaryCategory?.name ?? null,
		categorySlug: tool.primaryCategory?.slug ?? null,
		imageUrl: tool.primaryImage?.url ?? null,
		name: tool.name,
		priceAmount:
			tool.defaultVariant.discountedAmount ?? tool.defaultVariant.priceAmount,
		sku: tool.defaultVariant.sku,
		slug: tool.slug,
		toolId: tool.id,
		variantId: tool.defaultVariant.id,
		voltage: tool.defaultVariant.voltage,
	};

	return (
		<div
			className={cn(
				"group relative grid h-full overflow-hidden rounded-[2px] border border-white/14 bg-surface-elevated transition-[transform,border-color] duration-[var(--card-dur)] ease-[var(--card-ease)] hover:-translate-y-1 hover:border-white/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
				mirrored ? "md:grid-cols-[1fr_40%]" : "md:grid-cols-[40%_1fr]"
			)}
		>
			{/* Imagem — mobile aspect-square no topo; desktop preenche a altura (elástica). */}
			<div
				className={cn(
					"relative aspect-square overflow-hidden bg-image-bg md:aspect-auto md:h-full",
					mirrored && "md:order-2"
				)}
			>
				<ProductImage
					alt={tool.name}
					categorySlug={categorySlug}
					sizes="(max-width: 768px) 100vw, 40vw"
					src={tool.primaryImage?.url}
					zoom
				/>

				{discount != null && (
					<span className="absolute top-0 right-0 z-10 inline-flex items-center bg-emach-red px-2.5 py-1 font-bold font-display text-lg text-white uppercase tracking-[0.06em]">
						-{discount}%
					</span>
				)}

				{voltages && voltages.length > 0 && (
					<div className="absolute bottom-2 left-2 z-[2] flex flex-wrap gap-1.5">
						{voltages.map((v) => (
							<span
								className="rounded-[2px] bg-near-black/85 px-2 py-0.5 font-bold font-display text-[11px] text-white uppercase tracking-[0.06em]"
								key={v}
							>
								{v}
							</span>
						))}
					</div>
				)}

				{tool.inStock ? (
					<QuickAddButton
						className="absolute inset-x-0 bottom-0 z-[3] flex translate-y-full items-center justify-center gap-2 bg-emach-red py-2.5 font-bold font-display text-[13px] text-white uppercase tracking-[0.1em] transition-transform duration-[var(--card-dur)] ease-[var(--card-ease)] hover:bg-emach-red-hover group-hover:translate-y-0 motion-reduce:transition-none"
						item={snapshot}
					/>
				) : (
					<div className="absolute inset-0 z-10 flex items-center justify-center bg-near-black/60">
						<span className="font-display font-semibold text-[12px] text-white uppercase tracking-[0.14em]">
							Esgotado
						</span>
					</div>
				)}
			</div>

			{/* Texto — distribuído com justify-between pra não deixar vazio. */}
			<div
				className={cn(
					"flex flex-col justify-between gap-3 p-5",
					mirrored && "md:order-1 md:items-end md:text-right"
				)}
			>
				<div className="flex flex-col gap-1.5">
					<SectionLabel tone="light">{categoryName}</SectionLabel>
					<p className="font-medium text-[16px] text-white leading-tight">
						{tool.name}
					</p>
					{tool.reviewCount > 0 && tool.avgRating != null && (
						<ProductRating
							average={tool.avgRating}
							className="mt-1"
							tone="light"
						/>
					)}
				</div>

				<div className={cn("flex flex-col gap-2", mirrored && "md:items-end")}>
					<div className="flex items-baseline gap-2">
						<span className="font-bold text-[18px] text-white tabular-nums">
							{fmtNumericBRL(
								hasDiscount
									? tool.defaultVariant.discountedAmount
									: tool.defaultVariant.priceAmount
							)}
						</span>
						{hasDiscount && (
							<span className="text-[12px] text-white/60 tabular-nums line-through">
								{fmtNumericBRL(tool.defaultVariant.priceAmount)}
							</span>
						)}
					</div>
					{savings != null && savings > 0 && (
						<span className="inline-flex w-fit items-center rounded-[2px] bg-white/10 px-2 py-1 font-bold font-display text-[11px] text-white uppercase tracking-[0.06em]">
							Economize {fmtNumericBRL(String(savings))}
						</span>
					)}
				</div>
			</div>

			{/* Stretched link: cobre o card pra navegação, abaixo do quick-add (z-[3]). */}
			<Link className="absolute inset-0 z-[1]" href={`/product/${tool.slug}`}>
				<span className="sr-only">{tool.name}</span>
			</Link>
		</div>
	);
}
```

- [ ] **Step 2: check-types**

Run: `bun check-types`
Expected: sem erros. (Se acusar import de `ToolListItem`, confirmar que vem de `@emach/db/queries/tools`, igual ao `ProductCard`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/promo-product-card.tsx
git commit -m "feat(promo): card horizontal PromoProductCard"
```

---

## Task 4: PromoHighlight adaptativo por contagem

**Files:**
- Modify: `apps/web/src/components/promo-highlight.tsx`

**Interfaces:**
- Consumes: `selectPromoLayout` (Task 1), `PromoProductCard` (Task 3), `ProductGrid` (existente, caso de 4).
- Produces: `PromoHighlight` retorna `null` quando `layout === "hidden"`; senão renderiza o arranjo certo.

- [ ] **Step 1: Substituir o componente**

Modify `apps/web/src/components/promo-highlight.tsx` — substituir o arquivo inteiro por:

```tsx
import type { PromotionWithTools } from "@emach/db/queries/promotions";
import type { Voltage } from "@emach/db/schema/tools";
import Link from "next/link";
import { emachButtonVariants } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { ProductGrid } from "@/components/product-grid";
import { PromoCountdown } from "@/components/promo-countdown";
import { PromoProductCard } from "@/components/promo-product-card";
import { SectionLabel } from "@/components/section-label";
import { selectPromoLayout } from "@/lib/promo-card-helpers";

interface PromoHighlightProps {
	promotion: PromotionWithTools;
	voltagesByTool?: Map<string, Voltage[]>;
}

export function PromoHighlight({
	promotion,
	voltagesByTool,
}: PromoHighlightProps) {
	const layout = selectPromoLayout(promotion.tools.length);
	if (layout === "hidden") {
		return null;
	}

	return (
		<section aria-label="Promoções" className="bg-black text-white">
			<PageContainer className="px-5 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-18">
				<div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
					<div className="flex flex-col gap-3">
						<SectionLabel tone="accent">Ofertas</SectionLabel>
						<h2 className="font-display font-medium text-[clamp(30px,6vw,44px)] text-white leading-[1.02] tracking-[-0.01em]">
							{promotion.title}
						</h2>
					</div>
					{promotion.endsAt && (
						<PromoCountdown endsAt={promotion.endsAt.toISOString()} />
					)}
				</div>

				<div className="pt-10">
					{layout === "pair" && (
						<div className="grid grid-cols-1 gap-5 md:grid-cols-2">
							{promotion.tools.map((tool, i) => (
								<PromoProductCard
									key={tool.id}
									mirrored={i === 1}
									tool={tool}
									voltages={voltagesByTool?.get(tool.id)}
								/>
							))}
						</div>
					)}

					{layout === "trio" && (
						<div className="grid grid-cols-1 gap-5 md:grid-cols-3">
							{promotion.tools.map((tool) => (
								<PromoProductCard
									key={tool.id}
									tool={tool}
									voltages={voltagesByTool?.get(tool.id)}
								/>
							))}
						</div>
					)}

					{layout === "grid" && (
						<ProductGrid
							surface="elevated"
							tools={promotion.tools}
							voltagesByTool={voltagesByTool}
						/>
					)}
				</div>

				<div className="mt-10 flex justify-center">
					<Link
						className={emachButtonVariants({
							size: "lg",
							variant: "outline-light",
						})}
						href="/catalog?promo=1"
					>
						Ver todas as ofertas
					</Link>
				</div>
			</PageContainer>
		</section>
	);
}
```

- [ ] **Step 2: check-types**

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 3: Smoke visual (dev) — os 3 layouts**

Com o dev server (`bun dev:web`) e a promoção `featured` preparada (ver seção "Preparação"):
- Ajustar a contagem para **2** → visitar `/` → confirmar 2 cards horizontais **alternados** (o 2º com imagem à direita), sem buraco, com avaliação/voltagem/economia.
- Ajustar para **3** → 3 cards horizontais iguais inline, imagem ~40%, alturas casadas.
- Ajustar para **4** → grid vertical igual ao de hoje.
- Reduzir o viewport (mobile) → todos empilham (imagem em cima, texto embaixo), o `mirrored` some.
- Stack trace, se houver: `nextjs_call <port> get_errors`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/promo-highlight.tsx
git commit -m "feat(promo): PromoHighlight adapta layout por contagem (2/3/4)"
```

---

## Task 5: Gate de mínimo de 2 produtos na home

**Files:**
- Modify: `apps/web/src/app/(shop)/page.tsx` (bloco de render do `PromoHighlight`, ~linha 160)

**Interfaces:**
- Consumes: `featuredPromotion.tools.length` (já disponível).
- Produces: a `<section>` da promoção não é renderizada quando há < 2 produtos (gate no caller, além da guarda interna do `PromoHighlight`).

- [ ] **Step 1: Ajustar a condição de render**

Modify `apps/web/src/app/(shop)/page.tsx` — substituir:

```tsx
{featuredPromotion && (
	<PromoHighlight
		promotion={featuredPromotion}
		voltagesByTool={voltagesByTool}
	/>
)}
```

por:

```tsx
{featuredPromotion && featuredPromotion.tools.length >= 2 && (
	<PromoHighlight
		promotion={featuredPromotion}
		voltagesByTool={voltagesByTool}
	/>
)}
```

- [ ] **Step 2: check-types**

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 3: Smoke visual (dev) — caso de 1 produto**

Com a promoção `featured` ajustada para **1 produto**: visitar `/` → a seção de promoção **não aparece**; a home segue para "Novidades"/mapa normalmente; o produto continua acessível pelo catálogo. Reverter os dados de teste ao final.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(shop)/page.tsx"
git commit -m "feat(promo): home não exibe seção de promoção com menos de 2 produtos"
```

---

## Verificação final

- [ ] `bun check-types` limpo.
- [ ] `bun run --filter=web test src/lib/promo-card-helpers.test.ts` passa.
- [ ] Smoke visual cobriu 1 (oculto), 2 (alternado), 3 (trio), 4 (grid) + mobile.
- [ ] `git status` limpo (dados de teste em dev revertidos; `featured` deixado conforme o desejado).

## Notas de escopo

- A regra `featured` (marcar promoção como destacada) é **dashboard-owned** — fora deste plano. Sem ela a seção não aparece em produção.
- Refatorar o `ProductCard` vertical para reusar `computeDiscountPercent` é oportunidade futura (DRY), **fora de escopo** aqui para não tocar componente estável.
