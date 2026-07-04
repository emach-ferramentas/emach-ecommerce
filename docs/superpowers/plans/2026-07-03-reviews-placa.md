# Placa de Avaliações (PDP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** migrar a seção de reviews da PDP do bloco `bg-near-black` para uma placa clara com a gramática da placa técnica, com anatomia adaptativa por N.

**Architecture:** helpers puros de layout (`review-layout.ts`, espelhando `plate-layout.ts`) decidem o modo (`single`/`duo`/`grid`) e a regra de sobras; `product-reviews.tsx` monta a moldura (`border border-border`), o trilho de resumo e os modos; `review-list.tsx`/`review-card.tsx` viram o modo `grid` claro. Spec: `docs/superpowers/specs/2026-07-03-reviews-placa-design.md`.

**Tech Stack:** Next 16 (App Router, Server Components), Tailwind v4 (tokens do design system), vitest, Base UI Select (shadcn `base-lyra`).

## Global Constraints

- Superfície clara = `--gray-10`; hairline = **`border-border`** (nunca `border-gray-10`/`border-card` — divisória invisível).
- Vermelho (`--emach-red`) só em estrelas/barras (dado), nunca decoração nova.
- Sem `console.*` (evlog), sem `: any`/`@ts-ignore`, sem `key={index}`, sem `React.forwardRef`, sem `useMemo`/`useCallback` manuais.
- Tipografia: Barlow (corpo) + Barlow Condensed via `font-display` (labels uppercase + tracking) — não misturar no mesmo bloco.
- Conventional Commits em PT, subject ≤50 chars.
- Antes de cada commit: `bun check-types` (na raiz do monorepo — CWD é a raiz, paths absolutos).
- Empty state n=0 (`product-reviews-section.tsx` linhas 53–75) é **intocável** neste plano.
- Testes novos são unit (sem DB) — NÃO adicionar à lista `INTEGRATION` de `apps/web/vitest.config.ts`.

---

### Task 1: Helpers puros de layout (`review-layout.ts`)

**Files:**
- Create: `apps/web/src/app/(shop)/product/[slug]/_components/review-layout.ts`
- Test: `apps/web/src/app/(shop)/product/[slug]/_components/review-layout.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (usado pela Task 2):
  - `type ReviewLayoutMode = "single" | "duo" | "grid"`
  - `reviewLayoutMode(total: number): ReviewLayoutMode`
  - `lastRowStart(count: number): number`
  - `stretchLast(count: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/(shop)/product/[slug]/_components/review-layout.test.ts
import { describe, expect, it } from "vitest";

import { lastRowStart, reviewLayoutMode, stretchLast } from "./review-layout";

describe("reviewLayoutMode", () => {
	it("n=1 vira depoimento único", () => {
		expect(reviewLayoutMode(1)).toBe("single");
	});

	it("n=2 e n=3 viram depoimentos lado a lado", () => {
		expect(reviewLayoutMode(2)).toBe("duo");
		expect(reviewLayoutMode(3)).toBe("duo");
	});

	it("n>=4 vira grid com resumo completo", () => {
		expect(reviewLayoutMode(4)).toBe("grid");
		expect(reviewLayoutMode(27)).toBe("grid");
	});
});

describe("lastRowStart", () => {
	it("count par: última linha completa começa em count-2", () => {
		expect(lastRowStart(4)).toBe(2);
		expect(lastRowStart(10)).toBe(8);
	});

	it("count ímpar: a sobra esticada é a última linha", () => {
		expect(lastRowStart(1)).toBe(0);
		expect(lastRowStart(5)).toBe(4);
	});
});

describe("stretchLast", () => {
	it("sobra ímpar estica full-width", () => {
		expect(stretchLast(3)).toBe(true);
		expect(stretchLast(5)).toBe(true);
	});

	it("count par não estica", () => {
		expect(stretchLast(2)).toBe(false);
		expect(stretchLast(4)).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter=web test review-layout`
Expected: FAIL — `Cannot find module './review-layout'` (ou equivalente).

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/app/(shop)/product/[slug]/_components/review-layout.ts

export type ReviewLayoutMode = "single" | "duo" | "grid";

// Modo da placa de avaliações por total de reviews aprovadas. O caso 0 nunca
// chega aqui — é o empty state da section (faixa escura, intocada).
export function reviewLayoutMode(total: number): ReviewLayoutMode {
	if (total <= 1) {
		return "single";
	}
	if (total <= 3) {
		return "duo";
	}
	return "grid";
}

// Primeira célula da última linha visual de um grid 2-col — zera a border
// inferior dessa linha. Com sobra ímpar, a própria célula esticada é a linha.
export function lastRowStart(count: number): number {
	return count % 2 === 0 ? count - 2 : count - 1;
}

// Sobra ímpar no fim do grid 2-col estica full-width (col-span-2) — mesma
// regra de sobras da placa técnica (plate-layout.ts); mata a célula fantasma.
export function stretchLast(count: number): boolean {
	return count % 2 === 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter=web test review-layout`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(shop\)/product/\[slug\]/_components/review-layout.ts apps/web/src/app/\(shop\)/product/\[slug\]/_components/review-layout.test.ts
git commit -m "feat(reviews): helpers de layout da placa"
```

---

### Task 2: Placa de avaliações (componentes claros)

**Files:**
- Create: `apps/web/src/app/(shop)/product/[slug]/_components/review-date.ts`
- Create: `apps/web/src/app/(shop)/product/[slug]/_components/verified-badge.tsx`
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-reviews.tsx` (reescrita completa)
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/review-card.tsx` (reescrita completa)
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/review-list.tsx` (toolbar morre, paginação light)
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/review-sort.tsx` (trigger light)

**Interfaces:**
- Consumes (Task 1): `reviewLayoutMode(total)`, `lastRowStart(count)`, `stretchLast(count)` de `./review-layout`.
- Produces: mesma API externa de hoje — `ProductReviews(props)` com props inalteradas (`currentSearchParams, page, pageSize, pathname, reviews, sort, stats, total`); `product-reviews-section.tsx` **não muda**.
- `ReviewList` perde a prop `sort` (o select move pro header da seção); `ReviewCard` ganha prop `stretch: boolean`.

- [ ] **Step 1: Criar `review-date.ts`** (formatter sai de `review-card.tsx` p/ ser compartilhado com o depoimento)

```ts
// apps/web/src/app/(shop)/product/[slug]/_components/review-date.ts

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
	day: "2-digit",
	month: "short",
	year: "numeric",
});
const TRAILING_DOT = /\.$/u;

export function formatReviewDate(date: Date): string {
	return DATE_FORMATTER.format(date).replace(TRAILING_DOT, "").toUpperCase();
}
```

- [ ] **Step 2: Criar `verified-badge.tsx`** (toda review tem `orderId NOT NULL` — selo verdadeiro por construção)

```tsx
// apps/web/src/app/(shop)/product/[slug]/_components/verified-badge.tsx
import { Check } from "lucide-react";

export function VerifiedBadge() {
	return (
		<span className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 font-display font-semibold text-[10.5px] text-gray-60 uppercase leading-none tracking-[0.1em]">
			<Check aria-hidden size={10} strokeWidth={2.5} />
			Compra verificada
		</span>
	);
}
```

- [ ] **Step 3: Reescrever `review-card.tsx`** (modo claro + sobra esticada)

```tsx
// apps/web/src/app/(shop)/product/[slug]/_components/review-card.tsx
import type { Review } from "@emach/db/schema/reviews";
import { cn } from "@emach/ui/lib/utils";

import { formatReviewDate } from "./review-date";
import { StarRating } from "./star-rating";
import { VerifiedBadge } from "./verified-badge";

interface ReviewCardProps {
	index: number;
	lastRowStart: number;
	review: Review & { clientName: string };
	stretch: boolean;
	total: number;
}

export function ReviewCard({
	review,
	index,
	total,
	lastRowStart,
	stretch,
}: ReviewCardProps) {
	const isLast = index === total - 1;

	return (
		<article
			className={cn(
				"border-border border-b px-4 py-5 sm:px-5",
				// Sobra ímpar estica full-width; senão, coluna esquerda ganha border-r.
				stretch && isLast ? "md:col-span-2" : index % 2 === 0 && "md:border-r",
				index >= lastRowStart && "md:border-b-0",
				isLast && "max-md:border-b-0"
			)}
		>
			<header className="mb-2.5 flex items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2.5">
					<StarRating rating={review.rating} />
					<span className="font-semibold text-[13px] text-near-black">
						{review.clientName}
					</span>
					<VerifiedBadge />
				</div>
				<time
					className="font-display text-[11px] text-gray-60 uppercase tracking-[0.08em]"
					dateTime={review.createdAt.toISOString()}
				>
					{formatReviewDate(review.createdAt)}
				</time>
			</header>
			{review.title && (
				<h3 className="mb-1 font-semibold text-[14px] text-near-black">
					{review.title}
				</h3>
			)}
			<p className="text-[13.5px] text-near-black/75 leading-relaxed">
				{review.body}
			</p>
		</article>
	);
}
```

- [ ] **Step 4: Reescrever `review-list.tsx`** — toolbar (`{n} avaliações` + sort) morre (contagem vive no trilho; sort no header da seção); paginação vira vocabulário claro; sobras via Task 1.

```tsx
// apps/web/src/app/(shop)/product/[slug]/_components/review-list.tsx
import type { Review } from "@emach/db/schema/reviews";
import type { Route } from "next";
import Link from "next/link";

import { ReviewCard } from "./review-card";
import { lastRowStart, stretchLast } from "./review-layout";
import type { ReviewSortKey } from "./review-sort";

interface ReviewListProps {
	currentSearchParams: Record<string, string | string[] | undefined>;
	page: number;
	pageSize: number;
	pathname: string;
	reviews: Array<Review & { clientName: string }>;
	total: number;
}

function pickSort(
	currentParams: Record<string, string | string[] | undefined>,
	updates: { reviewSort?: ReviewSortKey | null }
): ReviewSortKey | null {
	if ("reviewSort" in updates) {
		return updates.reviewSort ?? null;
	}
	const raw = currentParams.reviewSort;
	return typeof raw === "string" ? (raw as ReviewSortKey) : null;
}

function pickPage(
	currentParams: Record<string, string | string[] | undefined>,
	updates: { reviewPage?: number | null }
): number | null {
	if ("reviewPage" in updates) {
		return updates.reviewPage ?? null;
	}
	const raw = currentParams.reviewPage;
	return typeof raw === "string" ? Number(raw) : null;
}

function buildHref(
	pathname: string,
	currentParams: Record<string, string | string[] | undefined>,
	updates: { reviewPage?: number | null; reviewSort?: ReviewSortKey | null }
): Route {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(currentParams)) {
		if (key === "reviewPage" || key === "reviewSort") {
			continue;
		}
		if (Array.isArray(value)) {
			for (const v of value) {
				params.append(key, v);
			}
		} else if (typeof value === "string") {
			params.set(key, value);
		}
	}

	const sort = pickSort(currentParams, updates);
	const page = pickPage(currentParams, updates);

	if (sort && sort !== "newest") {
		params.set("reviewSort", sort);
	}
	if (page && page > 1) {
		params.set("reviewPage", String(page));
	}

	const qs = params.toString();
	return (qs ? `${pathname}?${qs}` : pathname) as Route;
}

const PAGE_BTN =
	"border border-near-black px-5 py-2 font-display font-semibold text-[11px] text-near-black uppercase tracking-[0.14em] transition-colors hover:bg-near-black hover:text-white";
const PAGE_BTN_DISABLED =
	"border border-border px-5 py-2 font-display font-semibold text-[11px] text-near-black/30 uppercase tracking-[0.14em]";

export function ReviewList({
	reviews,
	total,
	page,
	pageSize,
	pathname,
	currentSearchParams,
}: ReviewListProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const prevHref =
		page > 1
			? buildHref(pathname, currentSearchParams, { reviewPage: page - 1 })
			: null;
	const nextHref =
		page < totalPages
			? buildHref(pathname, currentSearchParams, { reviewPage: page + 1 })
			: null;

	return (
		<>
			{reviews.length === 0 ? (
				<div className="py-12 text-center text-[14px] text-gray-60">
					Nenhuma avaliação nesta página.
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2">
					{reviews.map((review, index) => (
						<ReviewCard
							index={index}
							key={review.id}
							lastRowStart={lastRowStart(reviews.length)}
							review={review}
							stretch={stretchLast(reviews.length)}
							total={reviews.length}
						/>
					))}
				</div>
			)}

			{totalPages > 1 && (
				<nav
					aria-label="Paginação de avaliações"
					className="flex items-center justify-center gap-3 border-border border-t px-6 py-5"
				>
					{prevHref ? (
						<Link className={PAGE_BTN} href={prevHref} scroll={false}>
							Anterior
						</Link>
					) : (
						<span className={PAGE_BTN_DISABLED}>Anterior</span>
					)}
					<span className="font-display text-[11px] text-gray-60 uppercase tracking-[0.14em]">
						Página {page} de {totalPages}
					</span>
					{nextHref ? (
						<Link className={PAGE_BTN} href={nextHref} scroll={false}>
							Próxima
						</Link>
					) : (
						<span className={PAGE_BTN_DISABLED}>Próxima</span>
					)}
				</nav>
			)}
		</>
	);
}
```

- [ ] **Step 5: Trigger light no `review-sort.tsx`** — só o JSX final muda (handler/labels intactos):

```tsx
	return (
		<div
			aria-busy={isPending}
			className="flex items-center gap-2"
			role="status"
		>
			<span className="font-display text-[10px] text-gray-60 uppercase tracking-[0.14em]">
				Ordenar
			</span>
			<Select onValueChange={handleChange} value={current}>
				<SelectTrigger className="h-8 min-w-[160px]">
					<SelectValue>
						{(value) => SORT_LABELS[value as ReviewSortKey]}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="newest">Mais recentes</SelectItem>
					<SelectItem value="rating-desc">Melhor avaliadas</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
```

(Remove `border-white/30 text-white` do trigger e `text-white/50` do label — default do sistema já é o vocabulário claro.)

- [ ] **Step 6: Reescrever `product-reviews.tsx`** (moldura + trilho + modos)

```tsx
// apps/web/src/app/(shop)/product/[slug]/_components/product-reviews.tsx
import type { ToolDetail } from "@emach/db/queries/tools";
import type { Review } from "@emach/db/schema/reviews";
import { cn } from "@emach/ui/lib/utils";

import { SectionLabel } from "@/components/section-label";

import { formatReviewDate } from "./review-date";
import { reviewLayoutMode, stretchLast } from "./review-layout";
import { ReviewList } from "./review-list";
import { ReviewSort, type ReviewSortKey } from "./review-sort";
import { StarRating } from "./star-rating";
import { VerifiedBadge } from "./verified-badge";

interface ProductReviewsProps {
	currentSearchParams: Record<string, string | string[] | undefined>;
	page: number;
	pageSize: number;
	pathname: string;
	reviews: Array<Review & { clientName: string }>;
	sort: ReviewSortKey;
	stats: ToolDetail["reviewStats"];
	total: number;
}

function recommendPct(distribution: ToolDetail["reviewStats"]["distribution"]) {
	const positive = distribution[4] + distribution[5];
	const total =
		distribution[1] +
		distribution[2] +
		distribution[3] +
		distribution[4] +
		distribution[5];
	if (total === 0) {
		return 0;
	}
	return Math.round((positive / total) * 100);
}

interface SummaryRailProps {
	avg: number;
	count: number;
	// "% recomendam" só no modo grid — com n baixo o percentual mente (spec).
	recommend?: number;
}

function SummaryRail({ avg, count, recommend }: SummaryRailProps) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-border border-b px-4 py-3.5 sm:px-5 md:flex-col md:items-start md:justify-center md:gap-1.5 md:border-r md:border-b-0 md:py-6">
			<div className="flex items-baseline gap-1.5 font-display font-medium text-[42px] tabular-nums leading-none">
				{avg.toFixed(1).replace(".", ",")}
				<span className="text-[15px] text-gray-60">/ 5</span>
			</div>
			<StarRating rating={avg} size={15} />
			<div className="text-[12.5px] text-gray-60">
				{count} {count === 1 ? "avaliação" : "avaliações"}
				{recommend !== undefined && (
					<>
						{" · "}
						<strong className="text-near-black">{recommend}%</strong>{" "}
						recomendam
					</>
				)}
			</div>
		</div>
	);
}

interface TestimonialCellProps {
	className?: string;
	review: Review & { clientName: string };
	// n=1: sem estrelas na célula — a nota do trilho já é a da única avaliação.
	// n=2–3: estrelas voltam (notas individuais diferem da média do trilho).
	showStars: boolean;
	size: "lg" | "md";
}

function TestimonialCell({
	className,
	review,
	showStars,
	size,
}: TestimonialCellProps) {
	return (
		<article
			className={cn("flex flex-col justify-center px-4 py-6 sm:px-6", className)}
		>
			{showStars && <StarRating className="mb-2.5" rating={review.rating} />}
			{review.title && (
				<h3
					className={cn(
						"mb-1 font-semibold text-near-black",
						size === "lg" ? "text-[16px]" : "text-[14px]"
					)}
				>
					{review.title}
				</h3>
			)}
			<p
				className={cn(
					"text-near-black leading-relaxed",
					size === "lg"
						? "max-w-[52ch] font-medium text-[19px]"
						: "max-w-[60ch] text-[15px]"
				)}
			>
				{review.body}
			</p>
			<footer className="mt-3.5 flex flex-wrap items-center gap-3">
				<span className="font-display font-semibold text-[12.5px] text-near-black uppercase tracking-[0.1em]">
					{review.clientName}
				</span>
				<VerifiedBadge />
				<time
					className="font-display text-[11px] text-gray-60 uppercase tracking-[0.08em]"
					dateTime={review.createdAt.toISOString()}
				>
					{formatReviewDate(review.createdAt)}
				</time>
			</footer>
		</article>
	);
}

function DistributionBars({
	distribution,
}: {
	distribution: ToolDetail["reviewStats"]["distribution"];
}) {
	const totalReviews =
		distribution[1] +
		distribution[2] +
		distribution[3] +
		distribution[4] +
		distribution[5];
	const bars = ([5, 4, 3, 2, 1] as const).map((star) => ({
		star,
		pct:
			totalReviews > 0
				? Math.round((distribution[star] / totalReviews) * 100)
				: 0,
	}));

	return (
		<div className="flex flex-col justify-center gap-2 px-4 py-4 sm:px-5">
			{bars.map((b) => (
				<div
					aria-label={`${b.star} estrelas: ${b.pct}%`}
					className="flex items-center gap-3 text-[12.5px] text-near-black"
					key={b.star}
					role="img"
				>
					<span aria-hidden="true" className="w-8 flex-none font-semibold">
						{b.star} ★
					</span>
					<span aria-hidden="true" className="h-[6px] flex-1 bg-near-black/10">
						<span
							className="block h-full bg-emach-red"
							style={{ width: `${b.pct}%` }}
						/>
					</span>
					<span
						aria-hidden="true"
						className="w-10 text-right text-gray-60 tabular-nums"
					>
						{b.pct}%
					</span>
				</div>
			))}
		</div>
	);
}

export function ProductReviews({
	stats,
	reviews,
	total,
	page,
	pageSize,
	sort,
	pathname,
	currentSearchParams,
}: ProductReviewsProps) {
	const avg = stats.avg ?? 0;
	const mode = reviewLayoutMode(total);
	const firstReview = reviews[0];

	return (
		<section aria-label="Avaliações dos clientes" className="py-14">
			{/* Largura alinhada ao topo (galeria w-1/2 + buy box w-[480px],
			    centrados) — replica 50vw + 480px, com teto p/ telas estreitas. */}
			<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]">
				<div className="mb-5 flex items-center justify-between gap-6">
					<SectionLabel tone="accent">O que dizem os clientes</SectionLabel>
					{mode === "grid" && <ReviewSort current={sort} />}
				</div>

				<div className="border border-border">
					{mode === "grid" ? (
						<>
							<div className="grid grid-cols-1 border-border border-b md:grid-cols-[240px_1fr]">
								<SummaryRail
									avg={avg}
									count={stats.count}
									recommend={recommendPct(stats.distribution)}
								/>
								<DistributionBars distribution={stats.distribution} />
							</div>
							<ReviewList
								currentSearchParams={currentSearchParams}
								page={page}
								pageSize={pageSize}
								pathname={pathname}
								reviews={reviews}
								total={total}
							/>
						</>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
							<SummaryRail avg={avg} count={stats.count} />
							{firstReview === undefined ? (
								// ?reviewPage fora do alcance com n baixo (URL manipulada).
								<div className="py-12 text-center text-[14px] text-gray-60">
									Nenhuma avaliação nesta página.
								</div>
							) : mode === "single" ? (
								<TestimonialCell
									review={firstReview}
									showStars={false}
									size="lg"
								/>
							) : (
								<div className="grid md:grid-cols-2">
									{reviews.map((review, index) => (
										<TestimonialCell
											className={cn(
												index % 2 === 0 &&
													index < reviews.length - 1 &&
													"md:border-border md:border-r",
												stretchLast(reviews.length) &&
													index === reviews.length - 1 &&
													"md:col-span-2 md:border-border md:border-t",
												index < reviews.length - 1 &&
													"max-md:border-border max-md:border-b"
											)}
											key={review.id}
											review={review}
											showStars
											size="md"
										/>
									))}
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
```

- [ ] **Step 7: Verificar tipos e testes**

Run: `bun check-types` — Expected: PASS (todos os pacotes).
Run: `bun run --filter=web test:ci` — Expected: PASS (nenhum teste existente quebra; `ReviewList` sem prop `sort` não é usado em teste algum).

- [ ] **Step 8: Smoke visual n=1** (dev server já roda em `localhost:3004` nesta sessão; se não, `bun dev:web`)

Visitar `http://localhost:3004/product/furadeira-de-impacto-650w`. Esperado: placa clara `border-border`; trilho com `4,0 / 5` + estrelas + "1 avaliação"; depoimento 19px sem estrelas na célula; assinatura "ROBERTO A. · ✓ COMPRA VERIFICADA · 20 DE JUN. DE 2026"; sem sort no header; console limpo. Empty state: `http://localhost:3004/product/compressor-de-ar-100l-2hp` — faixa escura intacta.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/\(shop\)/product/\[slug\]/_components/
git commit -m "feat(reviews): placa clara de avaliações na PDP"
```

---

### Task 3: DESIGN.md, smoke duo/grid com dados reais e verificação final

**Files:**
- Modify: `DESIGN.md` (§10, bullets de avaliações)

**Interfaces:**
- Consumes: Tasks 1–2 completas no filesystem.
- Produces: documentação atualizada + branch verificado.

- [ ] **Step 1: Atualizar `DESIGN.md` §10.** Localizar (`rg -n "bloco preto" DESIGN.md`) e substituir os DOIS bullets de avaliações (o "Avaliações nunca somem" e o "Avaliações = bloco preto único contínuo") e o bullet "review-list/review-card só têm o modo dark" por:

```markdown
- **Avaliações nunca somem:** 0 reviews → faixa `bg-near-black` fina (kicker "Avaliações" + copy de compradores verificados + estrelas outline) — único eco escuro da seção. Com reviews, a placa clara abaixo.
- **Avaliações = placa clara (2026-07-03; revoga o "bloco preto único" do #180 — decisão do dono):** moldura `border border-border` sobre `gray-10`, gramática da placa técnica. Anatomia adaptativa por N (`review-layout.ts`, espelha `plate-layout.ts`): **n=1** trilho `[240px_1fr]` (nota 42px Condensed + estrelas + "1 avaliação" seco) + depoimento 19px **sem estrelas na célula** (a nota do trilho já é a dela; verificação só no selo — estrelas 2× e "verificado" no contador foram rejeitados pelo dono); **n=2–3** células de depoimento com estrelas individuais, 3ª estica full-width; **n≥4** linha de resumo (trilho com "% recomendam" + barras `bg-emach-red`) + grid 2-col compacto + paginação (botões outline `near-black`, hover fill) — review ímpar final estica (`col-span-2`, sem célula fantasma). `ReviewSort` vive no header da seção (linha do `SectionLabel`), visível só em n≥4; trigger no vocabulário claro default. Selo "✓ Compra verificada" (`verified-badge.tsx`) em toda review — `review.orderId NOT NULL`, verdadeiro por construção.
```

E no bullet remanescente sobre SKU, remover a frase "review-list/review-card só têm o modo dark" mantendo o resto ("**SKU não entra na ficha**…").

- [ ] **Step 2: Seed temporário p/ smoke `duo`/`grid`** (via `mcp__supabase__execute_sql` ou `psql "$DATABASE_URL"`; reviews marcadas com `SMOKE` p/ cleanup). Pré-checagem: `select count(*) from "order";` — precisa ≥4 (senão testar só n=2/n=3 com os pedidos que houver). A unique de `review` envolve `orderId`, por isso cada seed usa um pedido distinto:

```sql
with t as (select id from tool where slug = 'furadeira-de-impacto-650w'),
     c as (select id from client limit 1),
     o as (select id, row_number() over () as rn from "order" limit 4),
     seed(rn, rating, title, body, days_ago) as (
       values
         (1, 5, null, 'SMOKE Motor forte, não esquenta mesmo em uso contínuo na obra.', 3),
         (2, 4, 'SMOKE Boa pegada', 'SMOKE Veio bem embalada e chegou antes do prazo.', 9),
         (3, 5, null, 'SMOKE Uso na obra todo dia, aguenta o tranco.', 15),
         (4, 3, null, 'SMOKE Cumpre o prometido, mas o cabo podia ser mais comprido.', 21)
     )
insert into review (id, tool_id, client_id, order_id, rating, title, body, status, created_at, updated_at)
select gen_random_uuid()::text, t.id, c.id, o.id, s.rating, s.title, s.body, 'approved',
       now() - make_interval(days => s.days_ago), now()
from seed s
join o on o.rn = s.rn
cross join t
cross join c;
```

Inserir **incrementalmente** (rodar com `limit 1`, smoke, depois `limit 2`… ou inserir tudo e deletar por partes) para cobrir: **n=2** (1 real + 1 SMOKE — duo lado a lado, estrelas por célula), **n=3** (duo com 3ª esticada `col-span-2` + `border-t`), **n=5** (grid: barras, "% recomendam" no trilho, sort no header, célula ímpar esticada).

- [ ] **Step 3: Smoke visual duo/grid** em `http://localhost:3004/product/furadeira-de-impacto-650w` (recarregar a cada mudança de N; `?reviewSort=rating-desc` p/ conferir o sort no n=5). Mobile 414px: trilho colapsa em linha horizontal; células empilham com `border-b`. Console limpo (`nextjs_call 3004 get_errors` se algo estourar).

- [ ] **Step 4: Cleanup do seed**

```sql
delete from review where body like 'SMOKE%' or title like 'SMOKE%';
```

Conferir: `select count(*) from review where status = 'approved';` volta ao valor pré-seed (6).

- [ ] **Step 5: Gate integrado**

Run: `bun check-types` — PASS.
Run: `bun run --filter=web test:ci` — PASS (inclui `review-layout.test.ts`).
Run: `bun check` — sem erro novo no escopo do branch.

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md
git commit -m "docs: placa de avaliações no DESIGN.md §10"
```
