# Plan 011: Remover `useCallback` manual do `cart-context`

> **Status em 2026-09-28:** implementado. `apps/web/src/lib/cart-context.tsx` não usa `useCallback` (import na linha 3 sem ele) e `apps/web/next.config.ts:7` mantém `reactCompiler: true`.

> **Executor instructions**: Siga passo a passo, rode cada verificação. STOP =
> pare e reporte. Ao terminar, atualize `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- apps/web/src/lib/cart-context.tsx`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

O React Compiler está ativo (`reactCompiler: true` no `next.config.ts`) e o
`CLAUDE.md` bane `useMemo`/`useCallback` manuais — o compiler já memoiza. O
`cart-context.tsx` tem 5 `useCallback` manuais, que adicionam ruído e podem
atrapalhar a análise do compiler. Fix mecânico, risco baixo.

## Current state
_Nota 2026-09-28: o bloco de `useCallback` abaixo é o estado de 2026-06-17, anterior à remoção._

- `apps/web/src/lib/cart-context.tsx` (relevante) — 5 `useCallback` (linhas 54-73):
  ```tsx
  const add = useCallback((item: CartItemSnapshot, qty = 1) => {
  	setItems((prev) => addToCart(prev, item, qty));
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
  	setItems((prev) => updateQty(prev, variantId, qty));
  }, []);

  const remove = useCallback((variantId: string) => {
  	setItems((prev) => removeFromCart(prev, variantId));
  }, []);

  const clear = useCallback(() => {
  	setItems([]);
  	saveCart([]);
  }, []);

  const reconcile = useCallback((priceByVariantId: Map<string, string>) => {
  	setItems((prev) => reconcilePrices(prev, priceByVariantId));
  }, []);
  ```
- `useCallback` é importado no topo (linha 5): `import { createContext, useCallback, useContext, useEffect, useState } from "react";`
- Exemplo de função sem useCallback no mesmo componente — `totalCount` (linha 75):
  `const totalCount = items.reduce((acc, i) => acc + i.quantity, 0);`

## Commands you will need

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|----------|
| Typecheck | `bun run --filter=web check-types`   | exit 0   |
| Lint      | `bun check`                          | exit 0   |
| Grep      | `grep -n "useCallback" apps/web/src/lib/cart-context.tsx` | 0 matches no fim |

## Scope

**In scope**:
- `apps/web/src/lib/cart-context.tsx` (apenas remover os wrappers e o import)

**Out of scope**:
- `cart-store.ts` (lógica pura — `addToCart`/`updateQty`/etc. não muda)
- `cart-store.test.ts`
- Qualquer outro componente com `useMemo`/`useCallback` — fora deste plano.

## Git workflow

- Branch: `advisor/011-cart-context-usecallback`
- Commit `refactor:` PT, ≤50 chars (ex.: `refactor: remove useCallback do cart-context`).

## Steps

### Step 1: Trocar os 5 `useCallback` por funções diretas

Em `cart-context.tsx`, defina as 5 funções como plain functions (o compiler
infere a estabilidade de referência):

```tsx
const add = (item: CartItemSnapshot, qty = 1) => {
	setItems((prev) => addToCart(prev, item, qty));
};

const setQty = (variantId: string, qty: number) => {
	setItems((prev) => updateQty(prev, variantId, qty));
};

const remove = (variantId: string) => {
	setItems((prev) => removeFromCart(prev, variantId));
};

const clear = () => {
	setItems([]);
	saveCart([]);
};

const reconcile = (priceByVariantId: Map<string, string>) => {
	setItems((prev) => reconcilePrices(prev, priceByVariantId));
};
```

### Step 2: Remover o import de `useCallback`

No import do topo, tire `useCallback`:
```tsx
import { createContext, useContext, useEffect, useState } from "react";
```

**Verify**: `grep -n "useCallback" apps/web/src/lib/cart-context.tsx` → 0 matches.
`bun run --filter=web check-types` → exit 0. `bun check` → exit 0 (o lint do repo
proíbe `useCallback` manual; deve passar agora).

## Test plan

- `cart-store.test.ts` (unit, já existente) cobre a lógica do carrinho e continua
  passando: `bun run --filter=web test src/lib/cart-store.test.ts` → passa.
- Sanidade manual opcional: `bun dev:web`, adicionar/remover item no carrinho,
  confirmar que o drawer atualiza (a referência das funções não importa para o
  comportamento; o compiler memoiza).

## Done criteria

- [ ] Os 5 `useCallback` viraram funções diretas
- [ ] `useCallback` removido do import
- [ ] `grep -n "useCallback" apps/web/src/lib/cart-context.tsx` → 0 matches
- [ ] `bun run --filter=web check-types` → exit 0
- [ ] `bun check` → exit 0
- [ ] `bun run --filter=web test src/lib/cart-store.test.ts` → passa
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- `bun check` reclamar de algo NÃO relacionado a `useCallback` no arquivo após a
  mudança (regressão de lint inesperada).
- O `next.config.ts` NÃO tiver `reactCompiler: true` (premissa falsa — sem o
  compiler, remover `useCallback` muda a identidade das funções a cada render).

## Maintenance notes

- Reviewer: confirmar `reactCompiler: true` ativo. Sem ele, este refactor
  regride performance (novas refs por render).
- Mesmo padrão se aplica a `useMemo` manuais em outros componentes (ex.:
  `checkout-content.tsx`) — não incluídos aqui; tratar caso a caso num follow-up.
