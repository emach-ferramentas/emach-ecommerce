# Design — Hero Builder Fidelity (preview ↔ storefront)

> **Status em 2026-09-28:** parcial. F2 (badge e countdown) está implementada em `apps/web/src/components/hero/hero-element-renders.tsx`, reusando `formatCountdown` de `lib/countdown.ts`. F1 (calibrar `LAYOUT_CONFIG`) foi substituída: o #210 removeu `LAYOUT_CONFIG` e o hero posiciona por `banner.composition` (`2026-07-30-hero-composition-design.md`); os 8 layouts sobrevivem só como mapa de conversão em `lib/composition/legacy-composition.ts`. F3 (return-issue no dashboard) não foi verificada.

> Status: **aprovado** (brainstorming 2026-06-16). Sucessor do Hero Builder v2 (`2026-06-16-hero-builder-v2-design.md`, dashboard) e do #123 (badge/countdown no storefront).
> Escopo: spec único, **3 fatias** (F2 → F1 → F3). Cross-repo (storefront `emach-ecommerce` + preview/builder `emach-dashboard`).

## Contexto

O hero da home (`apps/web/src/components/hero-carousel.tsx`) renderiza banners da tabela compartilhada `banner`. O builder (`emach-dashboard`, `app/dashboard/site/banners/`) deixa o staff compor banners com um **preview ao vivo**. Hoje o preview promete coisas que o hero real não entrega:

- **A — Badge e countdown:** o schema tem `badge_text` e `countdown_target`; o preview do dashboard renderiza os dois (pílula + contador) e dois presets giram em torno deles (Promo, Countdown). O hero os **descarta**: `HeroBanner = Pick<Banner, …>` omite ambos (dívida registrada no #123, nunca fechada).
- **B — Posições:** os mapas de posição (texto/produto/CTA por layout) são **duplicados à mão** — `banner-layout-pos.ts` no dashboard, `LAYOUT_CONFIG` no storefront. Divergem em vários layouts.
- **Causa raiz:** duplicação manual cross-repo + feature (badge/countdown) entregue só de um lado.

**Decisão (brainstorming 2026-06-16):** fidelidade total + features. Storefront é a render real (versão tunada). O preview se ajusta à verdade do storefront. Schema **não muda** (colunas já existem). Trabalho do storefront mora **neste repo**; preview e guard-rail viram **return-issue** no `emach-dashboard` (ADR-0009 / não editar o dashboard a partir daqui).

## Conjunto canônico de layouts (8, todos distintos — aprovado visualmente)

Fonte da verdade das posições. Cada preset define âncora de conteúdo, produto e CTA (e se o CTA é *inline*, colado ao bloco de texto, ou *separado* num canto).

| layout | conteúdo (texto) | produto | CTA | gradiente |
|---|---|---|---|---|
| `split` | baixo-esquerda | direita-meio | separado, **baixo-direita** | esquerda |
| `stack_left` | baixo-esquerda | direita-meio | inline (sob o texto) | esquerda |
| `center_bottom` | centro, baixo | **topo-centro** | inline | inferior |
| `center_mid` | centro, meio | **nenhum** | inline | inferior (leve) |
| `center_cta_right` | meio-esquerda | **topo-centro** | separado, baixo-direita | esquerda |
| `mirror_split` | **direita-meio** | esquerda-meio | separado, **baixo-direita** | direita |
| `hero_center` | topo-centro | dominante centro | separado, baixo-centro | topo+base |
| `text_right` | topo-centro | **dominante centro** | separado, **baixo-direita** | topo+base |

Notas de design (DESIGN.md):
- CTA vermelho aparece **uma vez** por slide; badge é **pílula clara** (branco/#181818), nunca vermelho.
- Título em Barlow Condensed uppercase; régua vermelha 3px; subtítulo em Barlow.
- `text_right` foi redefinido nesta rodada: variação do `hero_center` com o botão à direita (não é mais "produto-esq/texto-dir").

## Fatia F2 — Badge + Countdown no hero (storefront, este repo)

`hero-carousel.tsx` (_Nota 2026-09-28: badge e countdown hoje vivem em `hero/hero-element-renders.tsx`; a posição vem da composition, não mais "acima do título" ou "abaixo do subtítulo" fixos_):

- Adicionar `badgeText` e `countdownTarget` ao `HeroBanner` Pick. A query (`getActiveBanners`, `(shop)/page.tsx`) já faz `select()` de todas as colunas — só parar de descartar. `FALLBACK_BANNERS` recebem ambos como `null`.
- **Badge:** renderizado no topo do `HeroContentBlock`, **acima do título**. Pílula clara: `bg-white text-near-black`, Barlow Condensed uppercase, tracking ~.06em, radius 2px. Só quando `badgeText` presente. (Não compete com o CTA vermelho.)
- **Countdown:** novo subcomponente client `HeroCountdown` no bloco de conteúdo, **abaixo do subtítulo**. **Reaproveita o util existente** `formatCountdown(remainingMs): CountdownParts` (`@/lib/countdown`, o mesmo que o `PromoCountdown` da home usa) — **não** duplicar a lógica de tempo.
  - **Hidratação:** mesmo padrão do `PromoCountdown` — estado inicia `null`, calcula **só após o mount** (`useEffect` + `setInterval` 1s, com cleanup). Render inicial (server + primeiro paint) **não** mostra número — evita mismatch SSR.
  - **Formato:** `Xd Xh Xm Ss`, `tabular-nums`, **branco** (o vermelho da tela é o CTA — DESIGN.md).
  - **Expiração:** quando `parts.done`, **esconder só o contador**; o slide permanece (sem auto-desativação; staff controla via `isActive`).
- `prefers-reduced-motion`: o contador continua atualizando (é informação, não decoração); sem animação adicional.

> **As-built:** descoberto durante a execução que `lib/countdown.ts` (+ `CountdownParts`) já existia (PR #62, consumido por `promo-countdown.tsx`). O plano original criava um `formatCountdown(target, now)` duplicado — descartado. O hero reusa o util existente; não há função/teste novos.

## Fatia F1 — Alinhar os 8 layouts (storefront)

_Nota 2026-09-28: `LAYOUT_CONFIG`, `GRADIENT_BY_SIDE` e `textSide` de `hero-carousel.tsx` não existem mais; ver o status acima. O texto abaixo é o registro da calibração da época._

Atualizar `LAYOUT_CONFIG` em `hero-carousel.tsx` para casar com o conjunto canônico. **Diff por layout** (atual → alvo):

| layout | muda no storefront? | o quê |
|---|---|---|
| `split` | **não** | já é texto baixo-esq + produto dir + CTA baixo-dir |
| `stack_left` | **não** | já correto |
| `center_bottom` | **sim** | produto `top-[34%]` → topo (~`top-[8%]`) |
| `center_mid` | **não** | já correto (sem produto) |
| `center_cta_right` | **sim** | produto `top-[34%]` → topo (~`top-[8%]`) |
| `mirror_split` | **sim** | conteúdo `bottom-[18%]` → meio (`top-1/2 -translate-y-1/2`); CTA `CORNER_LEFT` → `CORNER_RIGHT` |
| `hero_center` | **não** | já correto |
| `text_right` | **sim (maior)** | conteúdo → topo-centro; produto `left-[34%]/h-64%` → dominante centro (≈ `left-1/2 top-1/2 h-[68%] w-[46%]`); CTA `inline` → separado `CORNER_RIGHT`; `textSide` → center; gradiente → topo+base |

`GRADIENT_BY_SIDE` e `textSide` acompanham as mudanças (ex.: `mirror_split` segue `right`; `text_right` passa a `center`).

**Escala (já implementada, manter):** `productScale`/`ctaScale` (`scale = valor/100`) continuam aplicados — não fazem parte deste diff.

> **As-built (calibração visual):** só `mirror_split` e `text_right` precisaram mudar. `center_bottom` e `center_cta_right` ficaram **inalterados** — o `top-[34%]` com o `-translate-y-1/2` base já coloca o produto no topo-centro (borda superior ~8%); a hipótese de "subir o produto" era desnecessária. Confirmado ciclando um banner descartável pelos 8 layouts na home.

## Fatia F3 — Guard-rail (dashboard, return-issue) — menor prioridade

Com F1+F2 fechados, preview e hero passam a casar, então a urgência cai. O return-issue no `emach-dashboard` cobre:

1. **Atualizar `banner-layout-pos.ts`** (`CONTENT_POS`/`PRODUCT_POS`/`CTA_POS`) para as posições canônicas desta tabela — o preview passa a refletir o hero. **Obrigatório** (senão o preview volta a mentir).
2. (Opcional) Guard-rail de publicação: se um campo novo do builder ainda não for honrado pelo storefront, marcar "preview pode divergir". Hoje, com badge/countdown fechados, não há gap pendente — manter como nota.

## Contrato cross-repo

- **Neste repo (`emach-ecommerce`):** F2 (render badge/countdown) + F1 (LAYOUT_CONFIG) + testes.
- **Return-issue no `emach-dashboard`:** F3.1 (posições do preview = tabela canônica) + F3.2 (guard-rail opcional). Referenciar a **tabela de conjunto canônico** acima como contrato.

## Verificação

- `bun check-types` + `bun check` verdes.
- **Smoke visual** (`/dev-here` na home): badge e countdown renderizam; posições dos 8 layouts batem com os mockups aprovados. Ver os 8 exige ciclar o `layout` de um banner — usar **banner de dev/descartável** ou seed temporário, **nunca** mexer nos 2 banners de prod no ar.
- **Countdown:** sem warning de hidratação (`read_console_messages`); tick a cada 1s; ao expirar, some só o contador.
- **Unit test:** `formatCountdown` (dias/horas/min/seg + caso expirado).

## Fora de escopo

- Mudança de schema (colunas já existem; sem campo novo).
- Remover valores do enum `banner_layout` (push-only, ADR-0006 — enum só cresce).
- **Fonte única de posições compartilhada cross-repo** (descritor semântico em `packages/db` sincronizado): descartado nesta rodada — a duplicação fica, mitigada pela tabela canônica como contrato. Candidato a melhoria futura se os layouts voltarem a divergir.
