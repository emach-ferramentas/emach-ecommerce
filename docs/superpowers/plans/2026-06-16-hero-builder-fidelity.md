# Hero Builder Fidelity Implementation Plan

> **Status em 2026-09-28:** parcial. As Tasks 2 e 3 (countdown e badge) estão implementadas, hoje em `apps/web/src/components/hero/hero-element-renders.tsx`. A Task 1 foi abandonada como escrita: `apps/web/src/lib/countdown.ts` já existia (#62) com a assinatura `formatCountdown(remainingMs): CountdownParts`. A Task 4 foi substituída pelo #210, que removeu `LAYOUT_CONFIG` (`2026-07-30-hero-composition.md`). A Task 5 (issue no dashboard) não foi verificada.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o hero do storefront honrar tudo que o builder do dashboard promete — badge, countdown e as posições dos 8 layouts batendo com os mockups aprovados.

**Architecture:** Três fatias. **F2** (badge + countdown) é render novo no `hero-carousel.tsx` + uma função pura testável de formatação. **F1** alinha o `LAYOUT_CONFIG` aos mockups (calibração visual). **F3** é um return-issue no `emach-dashboard` (não se edita o outro repo daqui). Schema **não muda** — colunas já existem; a query já as traz.

**Tech Stack:** Next 16, React 19 (Client Component), framer-motion, Tailwind v4, Drizzle, Vitest.

## Global Constraints

- **Sem mudança de schema.** `badge_text` e `countdown_target` já existem em `banner`; `getActiveBanners` já faz `select()` de todas as colunas.
- **DESIGN.md:** vermelho aparece **uma vez** por slide (é o CTA). Badge = **pílula clara** (`bg-white text-near-black`), **nunca** vermelha. Título em `font-display` (Barlow Condensed) uppercase; régua vermelha 3px. Radius 2px em interativos.
- **Countdown hidratação-safe:** nada de `Date.now()` no render do server. Calcular só pós-mount (`useEffect`); render inicial não mostra número.
- **Sem `console.*`** (usar `log` do evlog se precisar logar), **sem `: any`/`as any`**, IDs `crypto.randomUUID()`, sem `key={index}`.
- **Cross-repo:** F1/F2 neste repo (`emach-ecommerce`); o lado preview/guard-rail vira **issue no `emach-dashboard`** — nunca editar o outro repo a partir daqui (ADR-0009).
- **Enum push-only (ADR-0006):** não remover valores de `banner_layout`.
- **Verdade visual:** os mockups aprovados estão em `.superpowers/brainstorm/361597-1781656091/content/layouts-real-v2.html` (gitignored). A tabela canônica está no spec `docs/superpowers/specs/2026-06-16-hero-builder-fidelity-design.md`.

---

### Task 1: Função pura `formatCountdown`

_Nota 2026-09-28: abandonada. O util já existia com outra assinatura (`formatCountdown(remainingMs): CountdownParts`, `apps/web/src/lib/countdown.ts`); o código e o teste abaixo não foram criados._

**Files:**
- Create: `apps/web/src/lib/countdown.ts`
- Test: `apps/web/src/lib/countdown.test.ts`

**Interfaces:**
- Produces: `formatCountdown(target: Date, now: number): string | null` — retorna `"Xd Xh Xm Ss"`; `null` quando expirado (`target <= now`).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/countdown.test.ts
import { describe, expect, it } from "vitest";
import { formatCountdown } from "./countdown";

describe("formatCountdown", () => {
	const now = Date.UTC(2026, 0, 1, 0, 0, 0); // 2026-01-01T00:00:00Z

	it("formata dias/horas/min/seg restantes", () => {
		const target = new Date(now + (((2 * 24 + 3) * 60 + 4) * 60 + 5) * 1000);
		expect(formatCountdown(target, now)).toBe("2d 3h 4m 5s");
	});

	it("zera os segmentos quando faltam menos de 1s", () => {
		const target = new Date(now + 500);
		expect(formatCountdown(target, now)).toBe("0d 0h 0m 0s");
	});

	it("retorna null quando já expirou", () => {
		expect(formatCountdown(new Date(now - 1000), now)).toBeNull();
	});

	it("retorna null no instante exato do alvo", () => {
		expect(formatCountdown(new Date(now), now)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter=web test src/lib/countdown.test.ts`
Expected: FAIL — `formatCountdown` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/countdown.ts
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;
const SECOND = 1000;

/**
 * Tempo restante até `target` formatado como "Xd Xh Xm Ss".
 * `null` quando já expirou (alvo <= agora) — o caller esconde o contador.
 * `now` é injetado (ms epoch) pra manter a função pura e testável.
 */
export function formatCountdown(target: Date, now: number): string | null {
	const ms = target.getTime() - now;
	if (ms <= 0) {
		return null;
	}
	const d = Math.floor(ms / DAY);
	const h = Math.floor((ms % DAY) / HOUR);
	const m = Math.floor((ms % HOUR) / MINUTE);
	const s = Math.floor((ms % MINUTE) / SECOND);
	return `${d}d ${h}h ${m}m ${s}s`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter=web test src/lib/countdown.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/countdown.ts apps/web/src/lib/countdown.test.ts
git commit -m "feat: formatCountdown puro pra contador do hero"
```

---

### Task 2: Countdown no hero (`HeroCountdown` + Pick + fallback)

**Files:**
- Modify: `apps/web/src/components/hero-carousel.tsx`

**Interfaces:**
- Consumes: `formatCountdown` (Task 1).
- Produces: subcomponente `HeroCountdown({ target: Date })`; `HeroBanner` passa a incluir `countdownTarget`.

- [ ] **Step 1: Adicionar `countdownTarget` ao Pick**

No `HeroBanner` (hoje termina em `| "ctaScale"`), adicionar a linha:

```ts
export type HeroBanner = Pick<
	Banner,
	| "id"
	| "backgroundImageUrl"
	| "backgroundImageMobileUrl"
	| "productImageUrl"
	| "productImageMobileUrl"
	| "title"
	| "subtitle"
	| "altText"
	| "ctaLabel"
	| "ctaHref"
	| "ctaVariant"
	| "layout"
	| "productScale"
	| "ctaScale"
	| "countdownTarget"
>;
```

Atualizar o comentário do bloco (linha ~30): remover a parte "countdown chega no #123" referente ao countdown (badge sai na Task 3).

- [ ] **Step 2: Adicionar `countdownTarget: null` aos dois `FALLBACK_BANNERS`**

Em cada objeto de `FALLBACK_BANNERS`, após `ctaScale: 100,` adicionar:

```ts
		countdownTarget: null,
```

- [ ] **Step 3: Importar `formatCountdown` e `useEffect`/`useState`**

No topo, garantir o import de `useEffect, useState` (já existem) e adicionar:

```ts
import { formatCountdown } from "@/lib/countdown";
```

- [ ] **Step 4: Criar o subcomponente `HeroCountdown` (acima de `HeroContentBlock`)**

```tsx
// Contador regressivo. Calcula só pós-mount pra evitar mismatch de hidratação
// (server e primeiro paint não mostram número). Some quando expira (#123).
function HeroCountdown({ target }: { target: Date }) {
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, []);
	if (now === null) {
		return null;
	}
	const label = formatCountdown(target, now);
	if (label === null) {
		return null;
	}
	return (
		<span className="mt-4 font-display font-semibold text-[15px] text-white tabular-nums tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[17px]">
			{label}
		</span>
	);
}
```

- [ ] **Step 5: Renderizar o countdown no `HeroContentBlock`**

Dentro de `HeroContentBlock`, **depois** do bloco de `{banner.subtitle && (...)}` e **antes** de `{cfg.cta === "inline" && (...)}`, inserir:

```tsx
			{banner.countdownTarget && (
				<HeroCountdown target={banner.countdownTarget} />
			)}
```

- [ ] **Step 6: check-types**

Run: `bun run --filter=web check-types`
Expected: sem erros.

- [ ] **Step 7: Smoke visual**

Setar um alvo futuro num banner de dev e conferir o tick na home:

```sql
-- via psql/Drizzle Studio, banco de DEV; pega um banner existente
UPDATE banner SET countdown_target = now() + interval '2 days' WHERE is_active = true LIMIT 1;
```

Run: `/dev-here 3002` → abrir a home → confirmar o contador descendo de segundo em segundo no slide. Conferir o console (`read_console_messages`, `onlyErrors`): **sem** warning de hidratação. Reverter o UPDATE depois (`SET countdown_target = NULL`).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/hero-carousel.tsx
git commit -m "feat: countdown no hero (hidratação-safe, some ao expirar)"
```

---

### Task 3: Badge no hero (`badgeText` + Pick + fallback)

**Files:**
- Modify: `apps/web/src/components/hero-carousel.tsx`

**Interfaces:**
- Produces: `HeroBanner` passa a incluir `badgeText`; badge renderizado no topo do `HeroContentBlock`.

- [ ] **Step 1: Adicionar `badgeText` ao Pick**

No `HeroBanner`, adicionar `| "badgeText"` (depois de `"countdownTarget"`). Remover do comentário do bloco a menção residual a badge/#123.

- [ ] **Step 2: Adicionar `badgeText: null` aos dois `FALLBACK_BANNERS`**

Após `countdownTarget: null,` em cada objeto:

```ts
		badgeText: null,
```

- [ ] **Step 3: Renderizar o badge no topo do `HeroContentBlock`**

Como **primeiro** filho do `<div>` do `HeroContentBlock` (antes de `{banner.title && (...)}`):

```tsx
			{banner.badgeText && (
				<span className="mb-3 inline-block bg-white px-2.5 py-0.5 font-display font-semibold text-[11px] text-near-black uppercase tracking-[0.06em]">
					{banner.badgeText}
				</span>
			)}
```

- [ ] **Step 4: check-types**

Run: `bun run --filter=web check-types`
Expected: sem erros.

- [ ] **Step 5: Smoke visual**

```sql
UPDATE banner SET badge_text = 'BLACK WEEK' WHERE is_active = true LIMIT 1;
```

Run: na home (`/dev-here 3002`), confirmar a pílula branca acima do título, em Barlow Condensed uppercase. Conferir contraste do texto na pílula. Reverter (`SET badge_text = NULL`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/hero-carousel.tsx
git commit -m "feat: badge (pílula clara) no hero"
```

---

### Task 4: Calibrar os 8 layouts (`LAYOUT_CONFIG`) — visual

_Nota 2026-09-28: substituída. `LAYOUT_CONFIG` foi removido no #210; a posição vem de `banner.composition` e os 8 layouts são só o mapa legado em `apps/web/src/lib/composition/legacy-composition.ts`._

**Files:**
- Modify: `apps/web/src/components/hero-carousel.tsx` (const `LAYOUT_CONFIG`, e `CTA_CORNER_*`/`CTA_CENTER` se preciso)

**Interfaces:**
- Consumes: tabela canônica (spec) + mockups aprovados (`.superpowers/brainstorm/.../layouts-real-v2.html`).

> **Nota:** posição CSS não se testa por unidade — é calibração visual contra os mockups. O storefront usa `-translate-y-1/2` no produto e `-translate-*` no conteúdo, convenção diferente do preview; logo, os `%` exatos saem do ajuste-e-olha, não de cópia direta. A tabela abaixo é a **hipótese de partida** (do spec); confirme cada um na tela.

Alvo canônico por layout (âncoras):

| layout | conteúdo | produto | CTA |
|---|---|---|---|
| `split` | baixo-esq | dir-meio | separado baixo-dir |
| `stack_left` | baixo-esq | dir-meio | inline |
| `center_bottom` | centro-baixo | topo-centro | inline |
| `center_mid` | centro-meio | — | inline |
| `center_cta_right` | meio-esq | topo-centro | separado baixo-dir |
| `mirror_split` | dir-meio | esq-meio | separado **baixo-dir** |
| `hero_center` | topo-centro | dominante centro | separado baixo-centro |
| `text_right` | topo-centro | **dominante centro** | separado **baixo-dir** |

- [ ] **Step 1: Subir o storefront e um banner de teste**

Run: `/dev-here 3002`. Criar **um banner de dev descartável** (não mexer nos 2 de prod) com produto e CTA preenchidos, pra poder ciclar o `layout`:

```sql
INSERT INTO banner (id, background_image_url, product_image_url, alt_text, title, subtitle, cta_label, cta_href, layout, is_active, sort_order)
VALUES (gen_random_uuid(), '/images/hero-imagens/emach_hero_01_bg.png', '/images/hero-imagens/emach_hero_01_product.png', 'teste', 'Furadeira de Impacto', '850W · 13mm · Bivolt', 'Ver Catálogo', '/catalog', 'split', true, 99);
```

- [ ] **Step 2: Para cada layout, comparar storefront × mockup e ajustar**

Ciclar `UPDATE banner SET layout = '<layout>' WHERE sort_order = 99;` e abrir a home. Para cada um, comparar com o card correspondente do mockup e ajustar a entrada em `LAYOUT_CONFIG`. Mudanças esperadas (confirmar/ajustar):

- `split`, `stack_left`, `center_mid`, `hero_center`: provavelmente **já corretos** — só confirmar.
- `center_bottom` / `center_cta_right`: produto deve ficar no **topo** (borda superior ~6–10%). Se estiver baixo, subir o `lg:top-[..]` lembrando do `-translate-y-1/2` (top-edge = top% − altura/2).
- `mirror_split`: conteúdo passa pro **meio** (`lg:top-1/2 lg:-translate-y-1/2`, tirar `lg:bottom-[18%]`); CTA de `CTA_CORNER_LEFT` → `CTA_CORNER_RIGHT`; `textSide` segue `right`.
- `text_right`: conteúdo → **topo-centro** (espelhar o `content` de `hero_center`); produto → **dominante centro** (copiar o `product` de `hero_center`: `lg:left-1/2 lg:top-1/2 lg:h-[68%] lg:w-[46%]`); CTA de `inline` → `CTA_CORNER_RIGHT`; `textSide` → `center`.

Ajustar `GRADIENT_BY_SIDE`/`textSide` conforme cada mudança (`text_right` vira `center`).

- [ ] **Step 3: Conferir os 8 de ponta a ponta**

Ciclar os 8 valores mais uma vez e confirmar visualmente que cada um casa com o mockup (texto/produto/CTA na âncora certa, sem sobreposição, CTA legível). Conferir mobile (base full-width) num viewport estreito.

- [ ] **Step 4: check-types + limpar o banner de teste**

Run: `bun run --filter=web check-types` (sem erros).
Run SQL: `DELETE FROM banner WHERE sort_order = 99;`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/hero-carousel.tsx
git commit -m "fix: alinhar posições dos 8 layouts do hero aos mockups aprovados"
```

---

### Task 5: Return-issue no `emach-dashboard` (F3)

**Files:**
- Nenhum neste repo. Cria uma issue no repo irmão via `gh`.

- [ ] **Step 1: Abrir a issue de contrato cross-repo**

Run (ajustar `--repo` ao slug real do dashboard):

```bash
gh issue create --repo <owner>/emach-dashboard \
  --title "Hero builder: preview ↔ storefront (posições + guard-rail)" \
  --body "Return-issue do spec de fidelidade do hero (emach-ecommerce, docs/superpowers/specs/2026-06-16-hero-builder-fidelity-design.md).

**F3.1 (obrigatório):** atualizar \`_components/banner-layout-pos.ts\` (CONTENT_POS/PRODUCT_POS/CTA_POS) pras posições canônicas, espelhando o que o storefront agora renderiza:
- split: conteúdo baixo-esq · produto dir-meio · CTA baixo-dir
- stack_left: conteúdo baixo-esq · produto dir-meio · CTA inline
- center_bottom: conteúdo centro-baixo · produto topo-centro · CTA inline
- center_mid: conteúdo centro-meio · sem produto · CTA inline
- center_cta_right: conteúdo meio-esq · produto topo-centro · CTA baixo-dir
- mirror_split: conteúdo dir-meio · produto esq-meio · CTA baixo-dir
- hero_center: conteúdo topo-centro · produto dominante centro · CTA baixo-centro
- text_right: conteúdo topo-centro · produto DOMINANTE CENTRO · CTA baixo-dir (redefinido: variação do hero_center com botão à direita)

**F3.2 (opcional):** guard-rail de publicação — hoje sem gap pendente (badge/countdown já honrados pelo storefront), manter como nota."
```

- [ ] **Step 2: Confirmar criação**

Run: `gh issue list --repo <owner>/emach-dashboard --limit 3`
Expected: a issue aparece no topo. Anotar o número pra rastrear.

---

## Self-Review

- **Cobertura do spec:** F2 badge → Task 3; F2 countdown → Tasks 1-2; F1 8 layouts → Task 4; F3 return-issue → Task 5. ✓
- **Placeholders:** sem TBD; F1 é calibração visual declarada (não placeholder — CSS de posição não tem código exato a priori). Os `<owner>` na Task 5 são pra preencher com o slug real no momento.
- **Consistência de tipos:** `formatCountdown(target: Date, now: number): string | null` usado igual em Task 1 e 2. `HeroCountdown({ target: Date })` consistente. Pick cresce com `countdownTarget` (Task 2) e `badgeText` (Task 3) sem colisão.
