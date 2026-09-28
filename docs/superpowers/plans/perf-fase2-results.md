# Resultados — Fase 2 (bundle, imagem, transições)

> **Status em 2026-09-28:** implementado, sem a Task 10 (abandonada, como o próprio documento registra). No código: `optimizedSrc` e `srcSet` em `app/(shop)/product/[slug]/_components/product-gallery.tsx`, `LazyMotion` em `components/hero-carousel.tsx` e `app/login/_components/login-brand-panel.tsx`, `@keyframes emach-reveal` em `apps/web/src/index.css`, `dynamic()` do `BranchMap` em `components/branch-map-section.tsx`, `Barlow_Condensed` com 3 pesos em `app/layout.tsx`. Os números de KB e LCP são medições históricas (não verificado).

Branch `perfomace`, sobre a Fase 1 (cacheComponents). Build verde, lint + check-types limpos, smoke visual OK (home/PDP/catálogo).

## Imagem principal do PDP (o maior ganho de LCP)

A galeria (`product-gallery.tsx`) servia a imagem principal crua do Supabase via `<img>` do `react-inner-image-zoom`. Agora o `src` exibido passa pelo otimizador do Next (`/_next/image?...&w=1080&q=75`, `fetchPriority: high`); o original em alta-res fica só no `zoomSrc` (zoom preservado).

| | antes (cru) | depois (AVIF) |
|---|---|---|
| imagem LCP | **913 KB** (PNG) | **31 KB** | 
| LCP do PDP (Lighthouse mobile local) | **10230ms** | **5643ms** (−45%) |
| TTI do PDP | 10238ms | 5658ms |

## framer-motion enxugado

- `category-grid` e `product-grid` não importam mais `framer-motion` — entrada via CSS (`@keyframes emach-reveal` em `index.css`, stagger index-driven `--i` com teto, respeita `prefers-reduced-motion`). framer saiu do First-Load do catálogo.
- `hero-carousel` e `login-brand-panel` migrados para `LazyMotion` + `m` + `domAnimation` (features carregam lazy).
- Bundle total: **2891 KB → 2789 KB** (−102 KB).
- (Correção de lint pega no caminho: `category-grid` trocou handlers de mouse no `<div>` por listeners via ref — a11y; removido dead code `CTA_CORNER_LEFT` no hero, pré-existente.)

## Lazy-load + fontes

- `BranchMap` (below-the-fold) via `next/dynamic` — code-split do JS de interatividade do mapa (SSR preservado, sem `ssr:false`).
- `Barlow_Condensed` reduzido para `["500","600","700"]` (zero uso de `font-normal` no display); `Barlow` manteve os 4 pesos (todos em uso).

## Pulado (com justificativa)

- **SiteHeader no layout (T10):** conflita com cacheComponents. O `overlay` da home depende da rota → exigiria `usePathname` (client) num wrapper sob Suspense, fazendo o header inteiro virar fallback do Suspense (sumir do HTML inicial) — regressão de SSR/SEO pior que o ganho modesto de persistência. Não vale.

## Follow-ups sugeridos (fora desta branch)

- Imagem do PDP: `srcSet` responsivo (servir menor em mobile) baixaria mais o LCP. _Nota 2026-09-28: feito em #146 (`NEXT_IMG_WIDTHS` e `GALLERY_SIZES` em `product-gallery.tsx`)._
- Testes de integração-DB (`place-order`/`auto-promo`/`validate-coupon`/`revalidate-cart`) quebrados por estado do DB de teste (pré-existente, não regressão) — limpar a auto-promo do banco de teste / isolar por worker.
