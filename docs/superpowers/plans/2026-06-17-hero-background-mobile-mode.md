# Hero `background_mobile_mode` Implementation Plan

> **Status em 2026-09-28:** implementado. `resolveMobileBg` e `HeroBackground` estão em `apps/web/src/components/hero/hero-slide.tsx`, o tipo `HeroBanner` expõe `backgroundMobileMode` em `hero-carousel.tsx` e os fallbacks em `hero/hero-fallbacks.ts` usam `inherit`. Os caminhos do plano são anteriores ao #210.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o `HeroCarousel` honrar `banner.backgroundMobileMode` (`inherit` | `custom` | `none`) na resolução do fundo no mobile, sem alterar o desktop.

**Architecture:** Mudança isolada em `apps/web/src/components/hero-carousel.tsx`. O tipo `HeroBanner` passa a expor o campo, os fallbacks recebem `inherit`, e `HeroBackground` resolve o fundo mobile por modo (desktop invariante). Schema (owned-by-dashboard) já sincronizado — não tocar.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, `next/image`, framer-motion, Drizzle (tipo `Banner` de `@emach/db/schema/banner`), Tailwind.

## Global Constraints

- **Não editar `packages/db/src/schema/*.ts`** — schema owned-by-dashboard, já sincronizado (ADR-0009).
- **Desktop não muda** — fundo desktop é sempre `backgroundImageUrl` (preto quando null).
- Sem `console.*` (usar evlog se preciso — não é o caso aqui), sem `: any`/`as any`, sem `key={index}`, sempre `next/image`.
- `next/image` props preservadas como no código atual: `fill`, `priority={isFirst}`, `quality={75}`, `sizes="100vw"`, `fetchPriority`.
- Antes de qualquer Edit: ler o arquivo. Rodar `bun check-types` antes de commit.

---

### Task 1: `HeroBackground` honra `backgroundMobileMode`

_Nota 2026-09-28: `HeroBackground` saiu de `hero-carousel.tsx` para `hero/hero-slide.tsx`, e `FALLBACK_BANNERS` para `hero/hero-fallbacks.ts`. O default do enum no schema hoje é `none`, não `inherit`._

**Files:**
- Modify: `apps/web/src/components/hero-carousel.tsx`
  - Tipo `HeroBanner` (`Pick<Banner, ...>`) — adicionar `"backgroundMobileMode"`.
  - `FALLBACK_BANNERS` (2 literais) — adicionar `backgroundMobileMode: "inherit"`.
  - `HeroBackground` — reescrever a resolução do fundo.
- Test: nenhum automatizado (componente client com framer-motion; o repo não tem teste do hero). Verificação = `bun check-types` + smoke visual.

**Interfaces:**
- Consumes: `Banner` (`@emach/db/schema/banner`) já inclui `backgroundMobileMode: "inherit" | "custom" | "none"` (NOT NULL).
- Produces: `HeroBackground` continua com a mesma assinatura `({ banner, isFirst })`; nenhum outro componente muda.

- [ ] **Step 1: Adicionar `backgroundMobileMode` ao tipo `HeroBanner`**

No `Pick<Banner, ...>` (após `"backgroundImageMobileUrl"`):

```ts
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
	| "altText"
	| "badgeText"
	| "ctaLabel"
	| "ctaHref"
	| "ctaVariant"
	| "layout"
	| "productScale"
	| "ctaScale"
	| "countdownTarget"
>;
```

- [ ] **Step 2: Adicionar `backgroundMobileMode: "inherit"` aos 2 `FALLBACK_BANNERS`**

Em cada um dos dois literais, junto de `backgroundImageMobileUrl: null,`:

```ts
		backgroundImageMobileUrl: null,
		backgroundMobileMode: "inherit",
```

- [ ] **Step 3: Reescrever `HeroBackground`**

Substituir a função inteira por:

```tsx
// Fundo: desktop é sempre `backgroundImageUrl`. O mobile segue o modo:
//   inherit → desktop · custom → mobile url (fallback desktop) · none → sem imagem.
function HeroBackground({
	banner,
	isFirst,
}: {
	banner: HeroBanner;
	isFirst: boolean;
}) {
	const desktopBg = banner.backgroundImageUrl;
	const mode = banner.backgroundMobileMode;

	// Resolução do fundo mobile por modo (desktop nunca muda).
	const mobileBg =
		mode === "none"
			? null
			: mode === "custom"
				? (banner.backgroundImageMobileUrl ?? desktopBg)
				: desktopBg;

	// Quando a mesma imagem serve desktop e mobile, um único <Image> cobre tudo.
	const sharedBg = desktopBg != null && mobileBg === desktopBg;
	const fetchPriority = isFirst ? "high" : "auto";

	return (
		<div className="absolute inset-0 bg-black">
			{desktopBg != null && (
				<Image
					alt={banner.altText ?? ""}
					className={cn("object-cover", !sharedBg && "hidden lg:block")}
					fetchPriority={fetchPriority}
					fill
					priority={isFirst}
					quality={75}
					sizes="100vw"
					src={desktopBg}
				/>
			)}
			{!sharedBg && mobileBg != null && (
				<Image
					alt={banner.altText ?? ""}
					className="object-cover lg:hidden"
					fetchPriority={fetchPriority}
					fill
					priority={isFirst}
					quality={75}
					sizes="100vw"
					src={mobileBg}
				/>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Rodar `bun check-types`**

Run: `bun check-types` (na raiz do repo)
Expected: sem erros (exit 0). Em especial, sem `TS2741`/`TS2345` por campo faltando nos `FALLBACK_BANNERS`.

- [ ] **Step 5: Smoke visual na home**

Subir `bun dev:web` e visitar `/` em largura mobile (DevTools responsive ~390px) e desktop (≥1024px). Exercitar os 3 modos via um banner de teste no banco (`UPDATE banner SET background_mobile_mode = '...'`) ou ajuste temporário nos `FALLBACK_BANNERS` (reverter depois):
- `inherit`: fundo desktop aparece no mobile.
- `custom` com mobile url: fundo mobile próprio; sem url: cai pro desktop.
- `none`: sem imagem de fundo no mobile (só preto + glow, + gradiente se houver texto); produto/CTA/countdown seguem.
- Desktop inalterado nos 3 modos.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/hero-carousel.tsx
git commit -m "feat(hero): honra background_mobile_mode no fundo mobile (#142)"
```

---

## Self-Review

**1. Spec coverage:**
- Contrato `inherit`/`custom`/`none` → Step 3 (resolução `mobileBg` + `sharedBg`). ✓
- "custom sem url cai pro desktop" → `?? desktopBg`. ✓
- "none = sem imagem, produto/slots seguem" → `mobileBg = null` + nenhuma imagem mobile; `HeroProduct`/CTA/countdown não tocados. ✓
- "desktop não muda" → imagem desktop sempre `desktopBg`, classe controla só visibilidade mobile. ✓
- Tipo expõe o campo (Step 1); fallbacks preenchem (Step 2). ✓

**2. Placeholder scan:** Sem TBD/TODO; todo código presente. Step 5 não tem teste automatizado por decisão consciente (sem harness de hero no repo), documentada.

**3. Type consistency:** `backgroundMobileMode` (camelCase no TS) bate com `banner.backgroundMobileMode` usado em `HeroBackground`. Valores `"inherit"|"custom"|"none"` batem com o enum `bannerBackgroundMobileMode`. `HeroBackground({ banner, isFirst })` mantém assinatura.
