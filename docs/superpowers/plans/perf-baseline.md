# Performance baseline — 2026-06-17 (pré Fase 1)

> **Status em 2026-09-28:** implementado. É a medição anterior à Fase 1 (#145) e ficou como referência histórica; os números vieram de um build local e não foram reproduzidos hoje (não verificado). Os resultados comparáveis estão em `perf-fase1-results.md` e `perf-fase2-results.md`.

Build: Next 16.2.6 Turbopack, prod build servido em `next start`. Lighthouse 13.4.0, chromium headless, preset mobile (throttled). Números de localhost (mesma máquina) — válidos como comparação relativa antes/depois.

## Route types (pré-cacheComponents)
_Nota 2026-09-28: `/catalog` hoje tem também `/catalog/[cat]` (rota própria por categoria), e `/checkout` mora em `apps/web/src/app/checkout/`, fora de `(shop)`._
`/` e `/cart` → `○ Static`; `/catalog`, `/product/[slug]`, `/checkout`, `/checkout/success`, `/pedidos/[number]`, `/dashboard/*` → `ƒ Dynamic`.

## Bundle (static/chunks)
Total: **2891 kB**. Maiores: 323, 323, 222, 137, 137, 132, 132, 110 kB. framer-motion: 1 chunk ~56 kB (compartilhado home/catálogo/login).

## Lighthouse mobile

| rota | perf | FCP | LCP | TBT | CLS | SI | TTI |
|---|---|---|---|---|---|---|---|
| home | 78 | 1960ms | 5375ms | 38ms | 0 | 3113ms | 6092ms |
| catalog | 82 | 1208ms | 4693ms | 138ms | 0 | 1208ms | 5535ms |
| product | 75 | 1355ms | **10230ms** | 84ms | 0 | 1355ms | 10238ms |

Produto medido: `/product/lixadeira-elp-720`.

## Leitura
- **Produto LCP 10,2s** é o pior número → keystone (T5: shell cacheado) ataca isto diretamente.
- CLS 0 em tudo (sem layout shift); TBT baixo (React Compiler) → gargalo é load/render server-side, não JS bloqueante.
- JSONs completos em `/tmp/lh-base-{home,catalog,product}.json` (efêmeros).
