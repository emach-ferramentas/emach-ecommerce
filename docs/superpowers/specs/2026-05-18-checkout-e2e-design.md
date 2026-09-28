# Verificação do checkout end-to-end + teste de integração — Design

> **Status em 2026-09-28:** implementado, com a parte de estoque substituída pelo ADR-0003. `placeOrder` vive em `apps/web/src/app/checkout/_lib/place-order.ts` (commit `10f4b32`), o teste de integração em `place-order.test.ts` ao lado dele (com `withRollback`) e o vitest em `apps/web/vitest.config.ts`. O débito de `stock_level` e o `stock_movement` que este spec descreve saíram do checkout em `0149a44`; hoje `placeOrder` só valida o estoque agregado e grava `order.branchId = null` (`docs/adr/0003-estoque-multi-filial.md`, `2026-05-20-estoque-multi-filial-design.md`).

> Issue: [#17](https://github.com/othavioquiliao/emach-ecommerce/issues/17) — `ready-for-human`.
> Data: 2026-05-18.

## Goal

Verificar o fluxo de checkout do storefront end-to-end após a sincronização de schema, e travar a lógica de criação de pedido com um teste de integração automatizado.

## Contexto

O commit `fix: sincronizar schema Drizzle com a DB real` corrigiu colunas-fantasma que quebravam o `createOrderAction`. A correção foi verificada em nível de coluna, tsc, lint e aceitação dos INSERTs pelo Postgres — mas a jornada real do checkout não foi percorrida, e não há teste que trave a regressão da lógica de negócio.

Estado de teste do repo (apurado na exploração):

- `apps/web` (onde vive `createOrderAction`) **não tem** framework de teste.
- `packages/db` tem `vitest` + scripts `test:supabase:*` + `supabase/config.toml` — um rig de integração meio-montado e nunca exercitado.
- `packages/auth` tem um único teste (`google.test.ts`).

O drift de schema que originou o bug **já está coberto** pelo `bun --cwd packages/db db:check-drift` (o script existe só no pacote, não na raiz). Este teste protege a **lógica de negócio** do checkout (recálculo de preço, débito de estoque, coerência transacional), não o drift.

## Componentes

### 1. Refactor — extrair `placeOrder`

`createOrderAction` (`apps/web/src/app/checkout/_actions/create-order.ts`) hoje mistura plumbing do Next (`safeParse`, `requireCurrentClient`, `getDefaultBranchId`, `headers()`) com a lógica de domínio. Para tornar a lógica testável sem o runtime Next:

- **Criar** `apps/web/src/app/checkout/_lib/place-order.ts` exportando:

  ```ts
  placeOrder(tx, {
    clientId: string;
    branchId: string;
    input: CreateOrderInput;   // já validado pelo action
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<{ orderId: string; orderNumber: string }>
  ```

  _Nota 2026-09-28: `branchId` saiu dos parâmetros de `placeOrder` e os parâmetros ganharam os campos de frete (`shippingUnverified`, `shippingMethod`, `shippingServiceCode`, `verifiedShippingCents`). O débito de `stock_level` e o insert de `stock_movement` descritos abaixo foram removidos (ADR-0003); `checkStock` virou `checkAggregateStock`._

  `placeOrder` recebe o `tx` (não abre transação própria) e executa, sobre ele: recálculo de preço/promoção, verificação de estoque, `update` do `client`, snapshot de endereço, inserts de `consent_log`, `order`, `order_item`, débito de `stock_level` e insert de `stock_movement`. Em estoque insuficiente, lança erro (a transação reverte).

- **Mover** para `_lib/` os helpers que a lógica usa: `prepareLines`, `checkStock`, `buildAddressSnapshot`, `fetchDiscountPctByToolId`, `centsFromString`, `formatOrderNumber`, e os tipos `CreateOrderInput`/`PreparedLine`/`AddressSnapshot`. As leituras passam a usar o `tx` recebido (hoje `prepareLines`/`checkStock` usam o singleton `db`).

- **`createOrderAction` vira wrapper fino**: `safeParse` do input → `requireCurrentClient` → `getDefaultBranchId` → ler `headers()` → `db.transaction((tx) => placeOrder(tx, …))` → mapear para `ActionResult<{ orderId; orderNumber }>`. Nenhuma lógica de domínio permanece no action.

  _Nota 2026-09-28: `getDefaultBranchId` não existe mais (`lib/default-branch.ts` foi removido em `a096c28`). O action de hoje também exige e-mail verificado, aplica rate limit (`orderLimiter`) e roda o anti-fraude de frete fora da transação (`assertShippingQuoted`)._

Refactor puro: comportamento observável idêntico. Único efeito colateral aceito — `prepareLines`/`checkStock` passam a rodar dentro da transação (snapshot mais consistente).

### 2. Infraestrutura de teste — vitest em `apps/web`

- Adicionar `vitest` como devDependency de `apps/web`.
- _Nota 2026-09-28: `vitest.config.ts` hoje também exclui a lista `INTEGRATION` quando `VITEST_UNIT_ONLY=1` (script `test:ci`); `place-order.test.ts` está nessa lista porque usa o banco._
- Adicionar `apps/web/vitest.config.ts` mínimo (ambiente `node`; `place-order.ts` é TS puro — sem React, sem `next/*`, então não precisa de plugins do Next).
- Adicionar script `"test": "vitest run"` ao `apps/web/package.json`.
- Helper `withRollback(fn)`: abre `db.transaction`, executa `fn(tx)`, e força ROLLBACK ao final lançando um erro sentinela que é capturado e descartado. Garante zero resíduo no banco.

### 3. Teste de integração — `_lib/place-order.test.ts`

Roda contra o DB Supabase de dev (via `DATABASE_URL`), cada caso dentro de uma transação revertida por `withRollback`.

_Nota 2026-09-28: os asserts de `stockLevel` decrementado e de `stockMovement` abaixo não valem mais; o teste atual afirma `order.branchId` nulo e nenhum `stock_movement` (cenário 1 do `place-order.test.ts`)._

**Caso feliz:** semeia, dentro da transação, um `client`, um `branch`, um `tool` + `toolVariant` (com `priceAmount`) + `stockLevel` (com `quantity` suficiente). Monta um `CreateOrderInput` válido. Chama `placeOrder(tx, …)`. Asserts:

- `order` criado com `status = 'pending_payment'`, `subtotalAmount`/`totalAmount` corretos.
- `orderItem` com `toolId`/`variantId`/`sku`/`unitPrice`/`quantity`/`lineTotal` coerentes (snapshot).
- `stockLevel.quantity` decrementado pela quantidade comprada.
- `stockMovement` com `reason = 'saida_venda'`, `actorType = 'system'`, `delta` negativo, `orderId`/`orderItemId` preenchidos.
- 3 linhas em `consentLog` (`tos`, `privacy`, `marketing_email`) para o `clientId`.

**Caso de borda — estoque insuficiente:** semeia `stockLevel.quantity` abaixo do pedido; `placeOrder` lança; nenhum `order`/`stockMovement` permanece (a transação reverteria de qualquer forma; o teste verifica que o erro é lançado).

### 4. Smoke manual (uma vez)

_Nota 2026-09-28: a página do pedido está em `apps/web/src/app/(shop)/pedidos/[number]/page.tsx`._

Subir `bun dev:web` e percorrer no browser: login como cliente → adicionar variante ao cart → checkout → confirmar redirect para `/pedidos/[number]` e o render da página sem erro. Executável via `agent-browser` ou manualmente pelo usuário.

Cobre o que o teste de integração não cobre: o wrapper Next (`createOrderAction`) e o **render do server component** `/pedidos/[number]` (critério 3). Deixa um pedido real no dev DB — aceitável, é ambiente de dev.

## Cobertura dos acceptance criteria

| Critério | Coberto por |
|---|---|
| #1 — pedido real criado | Teste de integração (caso feliz) + smoke manual |
| #2 — `order`/`order_item`/`stock_movement`/`consent_log` coerentes na mesma transação | Asserts do teste de integração |
| #3 — `/pedidos/[number]` renderiza sem erro | Smoke manual |
| #4 — decisão de cobertura registrada | Este spec; cobertura escolhida = teste de integração automatizado, que passa a existir e rodar via `bun --cwd apps/web test` |

## Caveat conhecido

`order_number_seq` é uma sequência Postgres — `nextval` **não** reverte no ROLLBACK. Cada execução do teste consome um número de pedido, deixando gaps na numeração. Gaps são inofensivos (números de pedido não precisam ser contíguos).

## Fora de escopo

- CI para rodar o teste automaticamente (não há CI no repo — ver CLAUDE.md §9). _Nota 2026-09-28: hoje há CI em `.github/workflows/ci.yml`; ele roda só o `test:ci`, que exclui este teste por depender do banco._
- Teste do rig `test:supabase` de `packages/db` (Supabase local) — preterido em favor de transação revertida no dev DB.
- Cobertura de UI do cart/checkout além do smoke manual.
