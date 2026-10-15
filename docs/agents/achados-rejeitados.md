# Achados rejeitados

Achados que a auditoria do skill `improve` de 2026-06-17 (commit `feafcfa`) avaliou e não levou adiante. Servem para a próxima auditoria não refazer o mesmo trabalho. A lista original estava em `plans/README.md` e saiu com o #276. Código vence: se o código mudou e o motivo abaixo não vale mais, o achado volta a ser candidato.

Reconferido contra a `main` em `86e38b5`.

- **Lock de cupom "fora da janela"** (`apps/web/src/app/checkout/_lib/place-order.ts`, no `SELECT ... FOR UPDATE` da `promotion`): o re-check de `redemption_count` contra `max_redemptions` depois do lock fecha a corrida. Não é bug.
- **Guarda do `/dashboard` via Suspense**: a guarda saiu do `layout.tsx` para o `DashboardChrome`, que o layout monta sob `Suspense` por causa do `cacheComponents`. O `apps/web/src/app/dashboard/layout.guard.test.ts` falha se a chamada a `requireCurrentClient()` sumir. Informativo.
- **`drizzle-orm` declarado em mais de um pacote** (`apps/web`, `packages/db` e `packages/email`): de propósito, porque esses pacotes importam `eq`, `inArray` e outros helpers direto. Baixo valor.
- **Baixo leverage, reabrir se virar dor**: `select()` sem projeção no checkout (`checkout/page.tsx` e `place-order.ts`), inserts de `orderItem` um por linha no laço do `place-order.ts` e `listClientOrders` buscando todos os itens de todos os pedidos.
- **vitest `^2.1.8`** (advisory GHSA-5xrq-8626-4rwp): só é explorável com `@vitest/ui`, que o repo não instala. Subir para v3 é manutenção, não urgência.

Dois itens da lista original saíram porque o código mudou: o `form: any` do TanStack (não há mais `any` em `apps/web/src` e o Biome barra o tipo) e a falta de hook de pre-commit (o `lefthook.yml` roda Biome e oxlint no pre-commit).
