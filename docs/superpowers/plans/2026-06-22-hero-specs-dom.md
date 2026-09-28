# Hero specs como DOM — Implementation Plan

> **Status em 2026-09-28:** implementado. `resolveHeroSpecs` está em `apps/web/src/lib/hero-specs.ts` (com `hero-specs.test.ts`) e `HeroSpecs` em `apps/web/src/components/hero/hero-element-renders.tsx`. O plano mira `hero-carousel.tsx` e `HeroContentBlock`, que o #210 substituiu por `hero/` e pela composition.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renderizar `banner.specs` (ficha técnica) como `<ul>` semântico no hero, em vez de queimado na arte de background.

**Architecture:** Uma função pura `resolveHeroSpecs` (lib, testável em node) faz o guard/normalização; um sub-componente `HeroSpecs` consome ela e renderiza inline (label fixo "FICHA TÉCNICA" + valores separados por `·`) dentro do `HeroContentBlock` do `hero-carousel.tsx`. Nenhuma mudança de schema, query ou outras rotas.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind, Drizzle, Vitest (environment node), Bun.

## Global Constraints

(Valores verbatim do spec + CLAUDE.md. Toda task herda isto.)

- Schema `packages/db/src/schema/banner.ts` é **owned-by-dashboard** — NÃO editar.
- Proibido: `console.*` (usar `log` do evlog), `: any`, `as any`, `@ts-ignore`, `@ts-expect-error`, `key={index}` em `.map()`, `React.forwardRef`, `useMemo`/`useCallback` manuais (React Compiler ativo), `<img>` puro, barrel files em `apps/web/src`.
- `next/image` para imagens (já em uso no arquivo).
- Comentários em PT (o arquivo usa PT); identificadores em EN.
- Conventional Commits em PT, subject ≤ 50 chars.
- Rodar `bun check-types` antes de cada commit.
- UI não se declara "feita" sem **smoke visual real na rota** (`bun check-types` não pega hook client em Server Component, etc.).
- IDs (se necessário): `crypto.randomUUID()` no caller (não aplicável aqui).

## File Structure

- **Create** `apps/web/src/lib/hero-specs.ts` — função pura `resolveHeroSpecs(specs): string[]` (guard + trim + filtra vazios). Server-safe, sem React.
- **Create** `apps/web/src/lib/hero-specs.test.ts` — teste unit (vitest, node).
- **Modify** `apps/web/src/components/hero-carousel.tsx` — adiciona `"specs"` ao `Pick` do `HeroBanner`; `specs: null` nos 2 `FALLBACK_BANNERS`; novo componente `HeroSpecs`; render no `HeroContentBlock`; inclui specs no cálculo de `hasText`.

Por que `resolveHeroSpecs` em `lib/` e não inline no componente: o `hero-carousel.tsx` é `"use client"` e importa `framer-motion`; importá-lo num teste vitest (env node) carregaria o módulo inteiro. Isolar a lógica pura em `lib/` torna o guard testável sem render — mesmo padrão de `lib/countdown.ts` e `lib/variant-voltages.ts`.

---

### Task 1: `resolveHeroSpecs` (função pura + teste)

**Files:**
- Create: `apps/web/src/lib/hero-specs.ts`
- Test: `apps/web/src/lib/hero-specs.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `resolveHeroSpecs(specs: string[] | null): string[]` — normaliza (trim) e remove entradas vazias; `null`/`[]`/só-vazios → `[]`. Task 2 consome.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/lib/hero-specs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveHeroSpecs } from "./hero-specs";

describe("resolveHeroSpecs", () => {
  it("retorna [] quando specs é null", () => {
    expect(resolveHeroSpecs(null)).toEqual([]);
  });

  it("retorna [] quando specs é vazio", () => {
    expect(resolveHeroSpecs([])).toEqual([]);
  });

  it("preserva valores não-vazios na ordem", () => {
    expect(resolveHeroSpecs(["1200W", "800 RPM", "Ø125mm"])).toEqual([
      "1200W",
      "800 RPM",
      "Ø125mm",
    ]);
  });

  it("faz trim e remove entradas vazias/whitespace", () => {
    expect(resolveHeroSpecs([" 1200W ", "", "   ", "800 RPM"])).toEqual([
      "1200W",
      "800 RPM",
    ]);
  });

  it("retorna [] quando só há entradas vazias", () => {
    expect(resolveHeroSpecs(["", "  "])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `bun run --filter=web test src/lib/hero-specs.test.ts`
Expected: FAIL — `Failed to resolve import "./hero-specs"` (módulo ainda não existe).

- [ ] **Step 3: Implementar o mínimo**

Create `apps/web/src/lib/hero-specs.ts`:

```ts
/**
 * Normaliza a ficha técnica do hero (banner.specs, #158): faz trim e descarta
 * entradas vazias. null/[]/só-vazios → []. Usado pelo HeroSpecs (render) e pelo
 * cálculo de overlay/gradiente do hero-carousel. Sem React: testável em node.
 */
export function resolveHeroSpecs(specs: string[] | null): string[] {
  return specs?.map((s) => s.trim()).filter((s) => s.length > 0) ?? [];
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `bun run --filter=web test src/lib/hero-specs.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: check-types**

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/hero-specs.ts apps/web/src/lib/hero-specs.test.ts
git commit -m "feat: helper resolveHeroSpecs do hero (#158)"
```

---

### Task 2: `HeroSpecs` + integração no `hero-carousel.tsx`

_Nota 2026-09-28: `HeroSpecs` vive em `hero/hero-element-renders.tsx` e é despachado por `renderHeroElement`; `HeroContentBlock` não existe. O gradiente de `hasText` não conta specs (`hero/hero-slide.tsx`)._

**Files:**
- Modify: `apps/web/src/components/hero-carousel.tsx`

**Interfaces:**
- Consumes: `resolveHeroSpecs` (Task 1).
- Produces: nada para tasks posteriores (é a última task).

**Nota de verificação:** o repo não tem testing-library/jsdom (vitest é env node), então não há teste de render automatizado. A verificação desta task é `bun check-types` + **smoke visual** (Steps 6–7). Não inventar teste de componente.

- [ ] **Step 1: Adicionar `"specs"` ao `Pick` do `HeroBanner`**

Em `apps/web/src/components/hero-carousel.tsx`, no `type HeroBanner = Pick<Banner, ...>` (≈ linha 37), adicionar a chave `"specs"` (sugestão: logo após `"subtitle"`):

```ts
	| "subtitle"
	| "specs"
	| "altText"
```

- [ ] **Step 2: Adicionar `specs: null` aos dois `FALLBACK_BANNERS`**

Em cada um dos 2 objetos de `FALLBACK_BANNERS` (≈ linhas 63–102), adicionar a propriedade `specs: null` (ex.: junto de `subtitle: null`):

```ts
		title: null,
		subtitle: null,
		specs: null,
```

(Os fallbacks não têm título nem specs → continuam sem painel; sem risco de duplicar arte queimada.)

- [ ] **Step 3: Importar `resolveHeroSpecs` e criar o componente `HeroSpecs`**

No topo, adicionar o import (junto dos outros `@/` imports, ≈ linha 30):

```ts
import { resolveHeroSpecs } from "@/lib/hero-specs";
```

Adicionar o componente logo **antes** de `HeroContentBlock` (≈ linha 450):

```tsx
// Ficha técnica do hero (#158): valores de banner.specs como <ul> semântico,
// em vez de queimados na arte. "FICHA TÉCNICA" é label fixo de render (não vem
// no dado). null/[]/só-vazios = sem painel. Tratamento inline com "·" (DESIGN.md
// §10): leve, não compete com o vermelho do CTA. O "·" é decorativo (CSS before);
// o label visual é aria-hidden pra não duplicar com o aria-label da lista.
function HeroSpecs({ specs }: { specs: string[] | null }) {
	const values = resolveHeroSpecs(specs);
	if (values.length === 0) {
		return null;
	}
	return (
		<div className="mt-4 max-w-[44ch] font-display text-[13px] text-white/90 uppercase tracking-[0.08em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[15px]">
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
```

- [ ] **Step 4: Renderizar `HeroSpecs` no `HeroContentBlock`**

Em `HeroContentBlock` (≈ linha 451), inserir `<HeroSpecs>` **entre a régua vermelha e o subtítulo** — ou seja, logo após o bloco `{banner.title && (...)}` (que termina com o `<span ... bg-emach-red />`, ≈ linha 481) e **antes** de `{banner.subtitle && (...)}`:

```tsx
				<span aria-hidden="true" className="my-4 h-[3px] w-16 bg-emach-red" />
				</>
			)}
			<HeroSpecs specs={banner.specs} />
			{banner.subtitle && (
```

(Resultado: badge → título → régua → **specs** → subtítulo → countdown → CTA. Herda o alinhamento por layout via `cfg.content`.)

- [ ] **Step 5: Incluir specs no cálculo de `hasText`**

Em `HeroSlideContent` (≈ linha 519), expandir a condição que liga o gradiente de legibilidade para cobrir banners com specs mas sem título/subtítulo:

```tsx
	const cfg = LAYOUT_CONFIG[banner.layout];
	const hasText = Boolean(
		banner.title || banner.subtitle || resolveHeroSpecs(banner.specs).length > 0
	);
```

(Mantém: banner "imagem pura" sem nada → `hasText` false → arte intacta, conforme CLAUDE.md.)

- [ ] **Step 6: check-types**

Run: `bun check-types`
Expected: sem erros (em especial, `banner.specs` agora existe no tipo `HeroBanner`).

- [ ] **Step 7: Smoke visual (obrigatório — UI)**

Subir o dev server: `bun dev:web`.

Preparar um banner com specs por **um** dos caminhos:
- **Dado real (preferido):** `bun db:studio` → tabela `banner` → num registro com `is_active = true`, setar `specs` para `["1200W","800 RPM","Ø125mm"]`.
- **Rápido/local:** temporariamente, num `FALLBACK_BANNER`, trocar `specs: null` por `specs: ["1200W","800 RPM","Ø125mm"]` e `title: null` por um título; conferir; **reverter antes do commit**.

Visitar `/` (home) e confirmar:
1. **Desktop:** painel "FICHA TÉCNICA · 1200W · 800 RPM · Ø125mm" entre a régua e o subtítulo, legível sobre a arte, sem competir com o CTA.
2. **Mobile** (DevTools responsivo ~390px): specs aparecem, quebram em linha sem empurrar o CTA pra fora da dobra.
3. **Edge — sem specs** (`null`): nenhum painel renderiza.
4. **Edge — specs sem título/subtítulo:** painel aparece **e** o gradiente de legibilidade liga (texto contrastado).

Se usou o caminho rápido, reverter as edições temporárias do fallback.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/hero-carousel.tsx
git commit -m "feat: ficha técnica do hero em DOM (#158)"
```

---

## Self-Review

**1. Spec coverage** (cada item do spec → task):
- Tipo `"specs"` no Pick → Task 2 Step 1. ✓
- `specs: null` nos fallbacks → Task 2 Step 2. ✓
- Sub-componente `HeroSpecs` → Task 2 Step 3. ✓
- Posição (régua → specs → subtítulo) → Task 2 Step 4. ✓
- Semântica/a11y (`<ul aria-label>`, label `aria-hidden`, `·` decorativo, `key={spec}`) → Task 2 Step 3. ✓
- Guard null/[]/whitespace → Task 1 (testado) + usado no Step 3. ✓
- Gradiente (`hasText` inclui specs) → Task 2 Step 5. ✓
- Mobile sem gating `lg:` → Task 2 Step 3 (classes responsivas só de tamanho de fonte, sem gate de visibilidade) + smoke Step 7. ✓
- Verificação (check-types + smoke) → Task 1 Step 5; Task 2 Steps 6–7. ✓
- Fora de escopo (schema/query/arte) → respeitado (nenhuma task toca). ✓

**2. Placeholder scan:** nenhum TBD/TODO; todo step de código mostra o código. ✓

**3. Type consistency:** `resolveHeroSpecs(specs: string[] | null): string[]` definido na Task 1 e consumido idêntico na Task 2 (Steps 3 e 5). `HeroSpecs({ specs }: { specs: string[] | null })` casa com o tipo de `banner.specs` (jsonb `$type<string[]>()` → `string[] | null`). ✓

## Rollout (pós-merge, não-código)

Banners de produção cuja arte de background ainda tem specs queimadas vão duplicar (DOM + imagem) até subir nova arte sem specs pelo dashboard. Sinalizar no fechamento do #158. Fallbacks não têm specs → não afetados.
