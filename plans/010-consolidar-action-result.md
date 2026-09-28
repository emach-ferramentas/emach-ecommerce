# Plan 010: Consolidar o tipo `ActionResult` num módulo único

> **Status em 2026-09-28:** implementado. `apps/web/src/lib/actions/types.ts` define `ActionResult` e `ActionResultWith<T>`. `reviews.ts`, `refunds.ts` e `addresses.ts` importam de `@/lib/actions/types`, e `search.ts` também usa `ActionResultWith`. `orders.ts:14` mantém sua variante `ActionResult<T = undefined>`, como o plano previa.

> **Executor instructions**: Siga passo a passo, rode cada verificação. STOP =
> pare e reporte. Ao terminar, atualize `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- apps/web/src/app/dashboard/dados-pessoais/_actions/addresses.ts apps/web/src/app/dashboard/pedidos/_actions/reviews.ts apps/web/src/app/dashboard/pedidos/_actions/refunds.ts apps/web/src/app/dashboard/pedidos/_actions/orders.ts`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

O tipo `ActionResult` está declarado em 4 arquivos de server action, com variações
sutis. Qualquer mudança no contrato (ex.: adicionar um campo `code`) exige tocar 4
lugares, e um consumidor que importe do arquivo "errado" pega um contrato
levemente diferente. Centralizar num módulo único elimina a divergência **sem
mudar o contrato observável** (re-export preserva os imports atuais).

## Current state

Quatro declarações:
- `apps/web/src/app/dashboard/pedidos/orders.ts:13` (caminho real:
  `dashboard/pedidos/_actions/orders.ts`) — **variante COM data**:
  ```ts
  export type ActionResult<T = undefined> =
  	| { ok: true; data: T }
  	| { ok: false; error: string };
  ```
- `apps/web/src/app/dashboard/pedidos/_actions/reviews.ts:12` — **sem data**:
  ```ts
  export type ActionResult = { ok: true } | { ok: false; error: string };
  ```
- `apps/web/src/app/dashboard/pedidos/_actions/refunds.ts:14` — idêntico a reviews.
- `apps/web/src/app/dashboard/dados-pessoais/_actions/addresses.ts:16-20`:
  ```ts
  export type ActionResult = { ok: true } | { ok: false; error: string };
  export type ActionResultWith<T> =
  	| { ok: true; data: T }
  	| { ok: false; error: string };
  ```

Há, portanto, **duas formas**

_Nota 2026-09-28: os arquivos `reviews.ts`, `refunds.ts` e `addresses.ts` hoje só importam os tipos; o `export type { ... }` do Step 2 não está mais neles, porque nenhum consumidor externo o usava._: sem-data (`ActionResult` em reviews/refunds/addresses)
e com-data (`ActionResultWith<T>` em addresses; `ActionResult<T=undefined>` em orders).

Diretório `apps/web/src/lib/actions/` já existe (contém `search.ts`).

## Decisão de escopo

Para manter risco LOW e zero mudança de caller:
1. Criar `apps/web/src/lib/actions/types.ts` com as **duas** formas canônicas:
   `ActionResult` (sem data) e `ActionResultWith<T>` (com data).
2. Em `reviews.ts`, `refunds.ts`, `addresses.ts`: substituir a declaração local
   por um **re-export** do módulo canônico (consumidores que importam desses
   arquivos continuam funcionando).
3. **`orders.ts` fica de fora** desta consolidação: seu `ActionResult<T=undefined>`
   (com `data` sempre presente) é uma terceira forma com semântica própria
   (`cancelOrderAction` retorna `{ ok: true, data: undefined }`). Unificá-lo
   exigiria mudar retornos de callers — fora do escopo S. Deixe-o como está e
   registre nas maintenance notes.

## Commands you will need

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|----------|
| Typecheck | `bun run --filter=web check-types`   | exit 0   |
| Lint      | `bun check`                          | exit 0   |

## Scope

**In scope**:
- `apps/web/src/lib/actions/types.ts` (criar)
- `apps/web/src/app/dashboard/pedidos/_actions/reviews.ts`
- `apps/web/src/app/dashboard/pedidos/_actions/refunds.ts`
- `apps/web/src/app/dashboard/dados-pessoais/_actions/addresses.ts`

**Out of scope**:
- `orders.ts` — variante distinta, não tocar.
- Qualquer client component que consuma esses tipos — re-export evita mudá-los.

## Git workflow

- Branch: `advisor/010-consolidar-action-result`
- Commit `refactor:` PT, ≤50 chars.

## Steps

### Step 1: Criar o módulo canônico

Crie `apps/web/src/lib/actions/types.ts`:

```ts
/** Resultado padrão de server action sem payload. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Resultado de server action que devolve dados em caso de sucesso. */
export type ActionResultWith<T> =
	| { ok: true; data: T }
	| { ok: false; error: string };
```

**Verify**: `bun run --filter=web check-types` → exit 0.

### Step 2: Re-exportar nos 3 arquivos

**IMPORTANTE:** estes arquivos **usam** `ActionResult`/`ActionResultWith`
localmente (como tipo de retorno). `export type { X } from "mod"` é re-export
PURO — não vincula o nome no escopo local, então o tsc falha com
`TS2304: Cannot find name`. Use `import type` (uso local) **+** `export type {}`
(preserva consumidores externos).

Em `reviews.ts` e `refunds.ts`, troque a linha
`export type ActionResult = ...` por:
```ts
import type { ActionResult } from "@/lib/actions/types";
export type { ActionResult };
```

Em `addresses.ts`, troque as duas declarações (`ActionResult` e
`ActionResultWith`) por:
```ts
import type { ActionResult, ActionResultWith } from "@/lib/actions/types";
export type { ActionResult, ActionResultWith };
```

**Verify**: `bun run --filter=web check-types` → exit 0.
`grep -rn "export type ActionResult\b" apps/web/src` → só `lib/actions/types.ts`
e o `orders.ts` (intencionalmente fora).

## Test plan

- Sem teste de runtime (tipos puros). A verificação é `check-types` passando — se
  algum consumidor dependia de uma forma divergente, o tsc acusa.

## Done criteria

- [ ] `apps/web/src/lib/actions/types.ts` criado com `ActionResult` + `ActionResultWith`
- [ ] `reviews.ts`, `refunds.ts`, `addresses.ts` re-exportam do módulo canônico
- [ ] `orders.ts` intacto (fora do escopo)
- [ ] `bun run --filter=web check-types` → exit 0
- [ ] `bun check` → exit 0
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- O `check-types` falhar após o re-export — significa que um consumidor dependia
  de uma diferença sutil entre as declarações. Reporte o erro do tsc; não force.
- Algum dos arquivos importar `ActionResult` de outro lugar que não a própria
  declaração local (improvável — são auto-contidos).

## Maintenance notes

- Follow-up possível: unificar também a variante de `orders.ts` (`ActionResult<T>`
  com `data`) com `ActionResultWith<T>`, ajustando os retornos de `cancelOrderAction`
  /`rebuyAction`. Deixado fora por exigir mudança de callers.
- Reviewer: novas server actions devem importar de `@/lib/actions/types`, não
  declarar localmente.
