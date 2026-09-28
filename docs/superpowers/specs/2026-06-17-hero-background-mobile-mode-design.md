# Hero: honrar `background_mobile_mode` (fundo opcional no mobile)

> **Status em 2026-09-28:** implementado. `resolveMobileBg` em `apps/web/src/components/hero/hero-slide.tsx` resolve `none`, `custom` e `inherit`, e `HeroBackground` renderiza uma única `<Image>` quando desktop e mobile compartilham a URL. O código saiu de `hero-carousel.tsx` no #210 e ganhou zoom e ponto focal por composition.

**Issue:** #142 · **Data:** 2026-06-17 · **Branch:** `feat/142-hero-background-mobile-mode`

## Contexto

Handoff do dashboard (`emach-dashboard`, commit `b9fd44a4` — `feat(banners): fundo opcional no mobile`). O dashboard ganhou controle de como o fundo do banner se comporta no mobile, via nova coluna na tabela compartilhada `banner`:

- **`background_mobile_mode`** — enum `banner_background_mobile_mode`: `inherit` | `custom` | `none` (`NOT NULL`, default `inherit`). _Nota 2026-09-28: o default virou `none` no sync #159 (`9085bd1`, `packages/db/src/schema/banner.ts:44-46`). Só os `FALLBACK_BANNERS` ainda fixam `inherit`._

A coluna **já chegou** ao schema TS deste repo via PR de sync (`sync-db-schema.yml`, ADR-0009) — confirmado em `packages/db/src/schema/banner.ts`:

```ts
export const bannerBackgroundMobileMode = pgEnum(
  "banner_background_mobile_mode",
  ["inherit", "custom", "none"]
);
// ...
backgroundMobileMode: bannerBackgroundMobileMode("background_mobile_mode")
  .notNull()
  .default("inherit"), // hoje: .default("none")
```

No banco compartilhado a coluna existe como `USER-DEFINED` (`banner_background_mobile_mode`), `NOT NULL default 'inherit'`. Os 2 banners atuais estão em `inherit`.

## Problema

`hero-carousel.tsx` (`HeroBackground`) resolve o fundo do mobile apenas por presença de URL — efetivamente `mobileUrl ?? desktopUrl`. Ignora o modo. Sem honrar `background_mobile_mode`, o storefront recria a divergência preview↔storefront que a issue dashboard#204 corrigiu (o admin marca "Sem fundo no mobile" e o storefront ignora).

## Contrato (do issue)

| modo | mobile |
|---|---|
| `inherit` | usar `background_image_url` (desktop) |
| `custom` | usar `background_image_mobile_url`; se nulo, cair pro desktop |
| `none` | **não** exibir imagem de fundo (só o gradiente/fundo sólido da marca). Produto e demais slots continuam |

**Desktop não muda** — sempre `background_image_url` (preto quando null).

## Escopo

Mudança em **um arquivo**: `apps/web/src/components/hero-carousel.tsx` (_Nota 2026-09-28: hoje `hero/hero-slide.tsx` e `hero/hero-fallbacks.ts`_). Owned-by-ecommerce. Schema (owned-by-dashboard) já sincronizado — não tocar.

Fora de escopo: desktop, glow, produto, CTA, countdown, gradiente de legibilidade — intactos. Doc do contrato (`docs/integration/admin-ecommerce.md`) vive no dashboard, não neste repo.

## Design

### 1. Tipo `HeroBanner`

Adicionar `"backgroundMobileMode"` ao `Pick<Banner, ...>`. A query da home (`page.tsx > getActiveBanners`) faz `db.select().from(banner)`, que já traz a coluna; só o tipo do componente precisa expô-la.

### 2. `FALLBACK_BANNERS`

Os 2 literais de fallback ganham `backgroundMobileMode: "inherit"` — preserva o comportamento atual (sem mobile url → desktop no mobile) quando não há banner ativo no banco.

### 3. `HeroBackground` — resolução por modo

Desktop é invariante (`backgroundImageUrl`). A lógica de modo só decide o fundo do **mobile**:

```ts
const desktopBg = banner.backgroundImageUrl;
const mode = banner.backgroundMobileMode;

// Resolução do fundo mobile por modo (desktop nunca muda):
//   none   → sem imagem (só fundo/gradiente da marca)
//   custom → mobile url; se nula, cai pro desktop
//   inherit → desktop
const mobileBg =
  mode === "none"   ? null
  : mode === "custom" ? (banner.backgroundImageMobileUrl ?? desktopBg)
  :                     desktopBg;

// Quando a mesma imagem serve desktop e mobile, 1 <Image> cobre tudo (sem
// duplo download).
const sharedBg = desktopBg != null && mobileBg === desktopBg;
```

Render dentro de um base `<div className="absolute inset-0 bg-black">` (garante fundo sólido onde não houver imagem):

- **Imagem desktop** (`src={desktopBg}`, só quando `desktopBg != null`): classe `object-cover` + (`sharedBg` ? `block` : `hidden lg:block`).
- **Imagem mobile** (`src={mobileBg}`, `object-cover lg:hidden`): só quando `!sharedBg && mobileBg != null`.

`fill`, `priority={isFirst}`, `quality={75}`, `sizes="100vw"`, `fetchPriority` preservados como no código atual.

### Tabela de verdade resultante

| modo | desktopBg | mobile url | desktop renderiza | mobile renderiza |
|---|---|---|---|---|
| `inherit` | tem | — | desktop | desktop (`sharedBg`, 1 img) |
| `custom` | tem | tem | desktop | mobile image |
| `custom` | tem | null | desktop | desktop (fallback) |
| `none` | tem | qualquer | desktop | **nada** → preto + glow + gradiente |
| qualquer | null | — | preto (base) | preto (base) |
| `custom` | null | tem | preto (base) | mobile image |

A última linha (sem desktop bg, mas com mobile url custom) é um ganho marginal coerente com o contrato — desktop segue `background_image_url` (null → preto), mobile usa a url custom. Não é regressão: hoje `!desktopBg` pinta preto em tudo, e esse caso é raro/inexistente nos dados atuais.

## Verificação

1. `bun check-types` (raiz) — sem erros.
2. **Smoke visual real** na home (`/`) em largura mobile, exercitando os 3 modos via um banner de teste no banco (ou ajuste temporário em `FALLBACK_BANNERS`):
   - `inherit` → fundo desktop aparece no mobile.
   - `custom` com mobile url → fundo mobile próprio; sem url → cai pro desktop.
   - `none` → sem imagem de fundo no mobile, só preto + glow (+ gradiente se houver texto); produto/CTA/countdown seguem.
   - Desktop inalterado nos 3.
3. `/code-review` antes de finalizar (pedido do usuário).

## Riscos

- **Baixo.** Mudança isolada num componente de apresentação; sem schema, sem query, sem server action. Dados atuais todos em `inherit` (= comportamento pré-existente). Sem teste automatizado do hero hoje (componente client com framer-motion) — cobertura é o smoke visual.
