# Resultados — Fase 1 (Cache Components)

> **Status em 2026-09-28:** implementado. `cacheComponents: true` está em `apps/web/next.config.ts` e as guardas P0 seguem sob Suspense (`app/dashboard/_components/dashboard-chrome.tsx`, `app/checkout/page.tsx`, `app/(shop)/pedidos/[number]/page.tsx`). Os números de build, TTFB e Lighthouse são medições históricas, não reproduzidas hoje (não verificado). O achado 1 (imagem LCP do PDP) foi resolvido na Fase 2 e em #146.

Branch `perfomace`. Build Next 16.2.6 Turbopack, `cacheComponents: true`.

## Route types (antes → depois)

| rota | antes | depois |
|---|---|---|
| `/` | `○` estática | `○` estática (ISR 10m) |
| `/product/[slug]` | `ƒ` dinâmica | **`◐` PPR (ISR 10m) + prebuild dos slugs reais** |
| `/catalog` | `ƒ` | `◐` PPR (árvore cacheada + lista streamed) |
| `/sobre` | `ƒ` | `○` estática (ISR 10m) |
| `/dashboard/*`, `/checkout`, `/checkout/success`, `/pedidos/[number]` | `ƒ` | `◐` PPR (shell + conteúdo dinâmico sob Suspense) |

_Nota 2026-09-28: a árvore e a lista vêm de `getCatalogData` (`use cache` de 600 s, `catalog/_lib/catalog-data.ts`); a Task 6 do plano não criou `lib/catalog-cache.ts`. `/catalog/[cat]` foi adicionada depois, com `generateStaticParams`._

Build: 49/49 páginas prerenderizadas, 0 erros.

## Ganho de servidor (TTFB, build de produção local)

| rota | TTFB depois | antes |
|---|---|---|
| `/product/[slug]` (cache hit) | **~4ms** | SSR + `getToolBySlug` (joins) rodando 2×/acesso |
| `/` | ~7ms | — |

O cacheComponents serve o shell do cache em vez de re-renderizar; `getProductShell` (`use cache`) também elimina a query duplicada (`generateMetadata` + página).

## Guarda P0 (#98) — íntegra

- `GET /dashboard` deslogado → `307 /login?redirect=%2Fdashboard`
- `GET /checkout` deslogado → `307 /login` (proxy agora protege `/checkout` e `/pedidos`)
- `GET /pedidos/123` deslogado → `307 /login`
- `GET /checkout/success?order=X` → `200` (confirmação pública, fora do guard)
- Guarda movida para `DashboardChrome`/`CheckoutPageContent` sob Suspense; teste estrutural endurecido (checa a chamada real).

## Lighthouse mobile (local, ruidoso)

Os números de LCP **não** refletem o ganho da Fase 1: o LCP do PDP (~10s) é dominado pela **imagem principal**, não pelo servidor. Medição local tem variância alta.

## Achados / próximos passos

1. **[ALTO] Imagem LCP do PDP não é otimizada.** _Nota 2026-09-28: resolvido, ver `perf-fase2-results.md` e `srcSet` em `product-gallery.tsx` (#146)._ A galeria (`product-gallery.tsx`) usa `react-inner-image-zoom`, que renderiza um `<img>` cru apontando direto pro Supabase (original, tamanho cheio) — é o LCP de ~10s. `next/image` otimiza as thumbs, mas não a principal. **Esse é o maior gargalo de LCP do produto** e é independente do cache. Candidato nº 1 de follow-up (não estava no escopo da Fase 1).
2. **Testes de integração-DB quebrados (pré-existente, NÃO regressão).** `place-order`, `auto-promo`, `validate-coupon`, `revalidate-cart` falham com "Preços atualizados, refaça o checkout" — confirmado idêntico no commit base (`dab4195`). Há uma auto-promo ativa no DB de teste que altera preços de variante e quebra o snapshot dos testes. Unrelated à Fase 1; precisa de limpeza do DB de teste / isolamento por worker.
3. **Freshness:** PDP/catálogo cacheiam por 600s; sem invalidação ativa do dashboard (cross-repo). Bound documentado.
