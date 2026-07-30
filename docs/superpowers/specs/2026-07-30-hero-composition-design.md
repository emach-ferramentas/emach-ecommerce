# Hero por composition (banner builder por elemento) — design

> Status: **aprovado** (brainstorming 2026-07-30) · Issue: #210 (+ adendo nos comentários) · Contraparte: emach-dashboard#361 (mergeado; backfill executado — 100% dos banners de produção têm `composition` v1)

## Contexto

O dashboard trocou o modelo de composição do hero: em vez do enum `layout` (8 opções) + escalas, cada elemento (badge, título, descrição, specs, countdown, produto, CTA) tem posição própria — âncora 3×3 + offset % + escala — numa coluna `banner.composition` (jsonb, **já sincronizada** via #211). O contrato completo (tipos, fórmulas de âncora→CSS, área segura, pilha segura, gradiente, armadilhas de render) vive na **issue #210 e em `docs/integration/admin-ecommerce.md` do repo do dashboard** — esta spec não o repete; define como a loja o implementa.

Hoje o `hero-carousel.tsx` renderiza pelos campos legados (`layout` + `LAYOUT_CONFIG`), que o dashboard mantém por dual-write (aproximação). Este trabalho faz a loja ler `composition` e **mata o `LAYOUT_CONFIG` de vez** — fim do ciclo de paridade manual (#130).

## Decisões (brainstorming 2026-07-30)

1. **Port dos módulos puros do dashboard** (não reimplementação): `composition-schema` + `placement-css` + conversão legada, adaptados a zod v4 e enxugados pra leitura (sem clamps/bounds de editor — o dado chega validado e clampado; o parse ainda valida estrutura e faixas). Testes puros portados junto.
2. **Um único caminho de render**: banner com `composition` NULL ou inválida converte on-the-fly pra composition via mapa legado (mesma técnica do card do dashboard). O renderer legado inteiro NÃO é mantido como fallback.
3. **`FALLBACK_BANNERS` ganham composition literal** (equivalente ao split) e passam pelo renderer novo.
4. **Escopo**: só o renderer + atualização do gotcha de CLAUDE.md. Remoção do dual-write é do dashboard, DEPOIS de paridade confirmada em produção (protocolo da #210, tarefa 5).

## F1 — Lib pura (`apps/web/src/lib/composition/`)

- `composition-schema.ts`: tipos (`Anchor9`, `ElementKey`, `ElementPlacement`, `BackgroundConfig`, `MobileOverride`, `BannerComposition`), `compositionSchema` (zod v4; `version: 1` literal; faixas do contrato — offsets −20..20 aceitando float, escalas por elemento, maxWidth 12–80, zoom 100–200), `SAFE_STACK_ORDER`, `anchorBasePosition(anchor, viewport)` (bases x 5/50/95; y 5/50/88 desktop, 84 mobile), `partitionMobileElements(c)` → `{stacked, positioned, hidden}`.
- `placement-css.ts`: `placementToStyle(p, viewport)` (left/top = base+offset; translate 0/−50/−100% por coluna/linha; transformOrigin espelhado; `scale(scale/100)`; `maxWidth` em `ch`), `focalToObjectPosition`, `backgroundToStyle` (zoom+origin no focal), `textSide(c)` e mapa de classe do gradiente (l→to-r, r→to-l, c→to-t).
- `legacy-composition.ts`: `legacyToComposition(input)` (mapa dos 8 layouts → placements, o mesmo do backfill do dashboard), `deriveHasFlagsFromBanner(banner)` (flags de conteúdo; `hasCta` = label **E** href) e `resolveComposition(banner)`: `composition` válida → usa; NULL → converte silencioso (caso esperado pré-backfill); **inválida não-nula → converte E loga erro com bannerId** (sinal operacional de schema drift — regra do adendo da #210). Mecanismo de log: o que o repo já usa pra erro em client code; se não houver logger próprio, `console.error` com biome-ignore inline justificado — o plano identifica qual dos dois na leitura do código, mas o REQUISITO (logar, com bannerId, só no caso inválido-não-nulo) é fixo.
- Testes (padrão `hero-specs.test.ts`, puros, CI unit-only): parse (faixas/âncoras/version/união hidden), bases de âncora e fórmulas de estilo, partition, textSide, conversão legada dos 8 layouts, `resolveComposition` nos 3 caminhos.

## F2 — Elementos e slide (`apps/web/src/components/hero/`)

- `hero-element-renders.tsx`: markup ATUAL da loja movido (badge pill, título display + régua, specs via `resolveHeroSpecs`, subtítulo, `HeroCountdown` com ticker + auto-hide, produto com float/parallax/realce, `HeroCta` com `EmachButton`/`CTA_VARIANT_MAP`). Pixel igual ao de hoje — muda só COMO é posicionado.
- `hero-slide.tsx`: monta um slide a partir de `(banner, composition, extras de motion)`: fundo desktop/mobile (modos `inherit/custom/none` atuais + zoom/focal novos), `HeroGlow` mantido sempre (assinatura da loja — composition não governa glow), gradiente de legibilidade só com título/descrição presentes (direção por `textSide`), elementos desktop posicionados na ordem `SAFE_STACK_ORDER` (z-order determinístico — nunca `Object.keys` de jsonb), mobile via partition (`positioned` absoluto + `hidden` fora + `stacked` no F3).
- **Armadilhas do contrato aplicadas**: `width: max-content` em todo posicionado exceto produto; box do produto com dimensão explícita (desktop 60%/38%; posicionado mobile 32%/70%; pilha — verdade shipped, ver F3 — box absoluto 1:1 com o incumbente: `top-[46%]`/`h-[52%]`/`w-[92%]` centralizado; a aproximação 38%/82% era do preview do dashboard, não a fonte de verdade).
- **Escala no mobile (mudança deliberada)**: override posicionado aplica a própria `scale` (o gate `lg:` do CSS atual sai); item na pilha segura não aplica escala (box fixo). O trecho "Hero mobile ≠ desktop / escalas desktop-only" do `CLAUDE.md` raiz é atualizado pra regra nova.

## F3 — Pilha segura mobile (`hero-safe-stack.tsx`)

Formalização do mobile hardcoded atual: ordem fixa `badge → título → specs → descrição → countdown → produto → CTA`, empilhado do terço inferior (texto à esquerda, produto centralizado, CTA full-width na base), reusando as mesmas renders do F2. Elementos sem override caem aqui; com `{hidden:true}` somem; com placement saem da pilha (F2).

## F4 — Integração e fallbacks

- `HeroBanner` (tipo do carousel) ganha `"composition"` no Pick; a query da home (`(shop)/page.tsx`, select sem projeção, cache 600s) já traz a coluna — sem mudança de query.
- `hero-carousel.tsx` emagrece pra orquestrador: carousel/autoplay/dots/pause/parallax-spring/h1 intactos; por slide, `resolveComposition(banner)` + `<HeroSlide/>`. `LAYOUT_CONFIG`, `LayoutConfig`, `CTA_CORNER_RIGHT`/`CTA_CENTER` e `GRADIENT_BY_SIDE` removidos.
- `FALLBACK_BANNERS`: cada um ganha `composition` literal equivalente ao split (validada por teste contra o `compositionSchema`).

## F5 — Verificação e paridade

- `bun check-types` + `bun check` + `bun run --filter=web test:ci` verdes.
- Smoke visual (controller, browser real): home local desktop + mobile × canvas do dashboard — nos 2 banners ativos de produção e nos 4 templates (criando banners de teste temporários via dashboard e deletando depois). Zero regressão em autoplay/parallax/float/glow/dots/h1.
- Pós-deploy em produção com paridade confirmada: comentar na #210 pro dashboard remover o dual-write (fora deste PR).

## Fora de escopo

Remoção do dual-write (dashboard), mudanças de query/cache da home, novos efeitos de motion, edição de `packages/db/src/schema/*` (já sincronizado — regra dura do repo), qualquer alteração no editor do dashboard.
