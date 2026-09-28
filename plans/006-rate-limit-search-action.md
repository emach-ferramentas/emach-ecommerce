# Plan 006: Rate limit em `searchToolsAction`

> **Status em 2026-09-28:** implementado, com contrato de retorno diferente do plano. `searchLimiter = createLimiter(30)` está em `apps/web/src/lib/rate-limit.ts:62` e `searchToolsAction` o aplica por IP em `apps/web/src/lib/actions/search.ts:31`. Desde o #226 a action retorna `ActionResultWith<SearchResult[]>` e, ao estourar o limite, devolve `{ ok: false, error }` em vez de `[]`.

> **Executor instructions**: Siga passo a passo, rode cada verificação. STOP =
> pare e reporte. Ao terminar, atualize `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- apps/web/src/lib/actions/search.ts apps/web/src/lib/rate-limit.ts apps/web/src/lib/client-ip.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

`searchToolsAction` é uma server action **pública** (sem sessão), chamada a cada
keystroke do overlay de busca, que dispara um `ILIKE` no catálogo. O debounce de
300ms é só client-side — qualquer bot ou chamada direta pode emitir buscas
ilimitadas, estressando o pool de conexões do Supabase. O padrão de rate limit
por IP já existe no repo (`quote-shipping.ts`); este plano o aplica à busca.

## Current state

- `apps/web/src/lib/actions/search.ts` (atual, completo):
  ```ts
  "use server";

  import { db } from "@emach/db";
  import { searchTools, type ToolSearchResult } from "@emach/db/queries/catalog";

  export async function searchToolsAction(
  	q: string
  ): Promise<ToolSearchResult[]> {
  	const trimmed = q.trim();
  	if (trimmed.length < 2) {
  		return [];
  	}
  	return await searchTools(db, trimmed, 8);
  }
  ```
- **Padrão de rate limit por IP** já usado — `quote-shipping.ts:44-52`:
  ```ts
  const ip = getClientIp(await headers());
  if (ip) {
  	const { success } = await shippingLimiter.limit(`shipping:${ip}`);
  	if (!success) {
  		return { ok: false, error: RATE_LIMIT_MESSAGE };
  	}
  } else {
  	log.warn({ action: "shipping_rate_limit_skipped_no_ip" });
  }
  ```
- `apps/web/src/lib/rate-limit.ts` exporta limiters prontos:
  `couponLimiter` (10), `orderLimiter` (5), `shippingLimiter` (20),
  `RATE_LIMIT_MESSAGE`, e a factory interna `createLimiter(max)`. A busca é
  alto-volume (por keystroke) → use um limite **generoso**.
- `getClientIp` vem de `@/lib/client-ip`; `headers` de `next/headers`; `log` de `@/lib/evlog`.

## Decisão de contrato de retorno

_Nota 2026-09-28: decisão superada pelo #226 (`fix(busca): erro, corrida, Enter e paginação`). `searchToolsAction` agora retorna `ActionResultWith<SearchResult[]>`, e o caller `components/search-overlay.tsx` trata `res.ok`. Ao estourar o limite a action devolve `{ ok: false, error: "Muitas buscas seguidas. Aguarde alguns segundos." }`. O import de `searchTools` vem de `@emach/db/queries/tools`, não mais de `queries/catalog`._

Hoje `searchToolsAction` retorna `ToolSearchResult[]` direto (sem envelope
`{ok}`). Para não quebrar o caller (`search-overlay.tsx`), **mantenha o tipo de
retorno `ToolSearchResult[]`** e, quando estourar o limite, retorne `[]` (lista
vazia) + um `log.warn`. Não introduza envelope `{ok:false}` aqui — isso exigiria
mudar o caller (fora de escopo).

## Commands you will need

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|----------|
| Typecheck | `bun run --filter=web check-types`   | exit 0   |
| Lint      | `bun check`                          | exit 0   |
| Caller    | `grep -rn "searchToolsAction" apps/web/src` | confirma os call sites |

## Scope

**In scope**:
- `apps/web/src/lib/actions/search.ts`
- `apps/web/src/lib/rate-limit.ts` (adicionar um `searchLimiter`)

**Out of scope**:
- `apps/web/src/components/search-overlay.tsx` e qualquer caller — não mudar o
  contrato de retorno, logo não tocar o caller.
- `searchTools` em `@emach/db/queries/catalog` — dashboard-owned, não editar.

## Git workflow

- Branch: `advisor/006-search-rate-limit`
- Commit `feat:` ou `fix:` PT, ≤50 chars.

## Steps

### Step 1: Exportar um `searchLimiter` generoso

Em `apps/web/src/lib/rate-limit.ts`, junto dos outros limiters (após
`shippingLimiter`), adicione:

```ts
export const searchLimiter = createLimiter(30);
```

(30 por janela — busca é por keystroke; generoso para não atrapalhar UX legítima.)

**Verify**: `bun run --filter=web check-types` → exit 0.

### Step 2: Aplicar o limiter na action

Reescreva `apps/web/src/lib/actions/search.ts` aplicando o padrão de IP
(retornando `[]` quando estourar):

```ts
"use server";

import { db } from "@emach/db";
import { searchTools, type ToolSearchResult } from "@emach/db/queries/catalog";
import { headers } from "next/headers";

import { getClientIp } from "@/lib/client-ip";
import { log } from "@/lib/evlog";
import { searchLimiter } from "@/lib/rate-limit";

export async function searchToolsAction(
	q: string
): Promise<ToolSearchResult[]> {
	const trimmed = q.trim();
	if (trimmed.length < 2) {
		return [];
	}

	const ip = getClientIp(await headers());
	if (ip) {
		const { success } = await searchLimiter.limit(`search:${ip}`);
		if (!success) {
			log.warn({ action: "search_rate_limited" });
			return [];
		}
	} else {
		log.warn({ action: "search_rate_limit_skipped_no_ip" });
	}

	return await searchTools(db, trimmed, 8);
}
```

**Verify**: `bun run --filter=web check-types` → exit 0. `bun check` → exit 0.

## Test plan

- Sem teste de código (action SSR + rate limit é integração). Verificação por
  typecheck + revisão do diff contra o padrão de `quote-shipping.ts`.
- Sanidade manual opcional: `bun dev:web`, abrir o overlay de busca, confirmar
  que a busca normal ainda funciona (limite generoso não atrapalha uso real).

## Done criteria

- [ ] `searchLimiter` exportado em `rate-limit.ts`
- [ ] `searchToolsAction` aplica `searchLimiter.limit("search:${ip}")` e retorna `[]` ao estourar
- [ ] Tipo de retorno continua `ToolSearchResult[]` (caller intacto)
- [ ] `bun run --filter=web check-types` → exit 0
- [ ] `bun check` → exit 0
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- `searchToolsAction` tiver outro caller que dependa de erro/throw em vez de `[]`
  (`grep -rn "searchToolsAction"`) — confirme antes de mudar o comportamento.
- O caminho do arquivo for diferente (`apps/web/src/lib/actions/search.ts` não existir).

## Maintenance notes

- O fallback "sem IP → fail-open" espelha a decisão consciente de `quote-shipping.ts`
  (evita bucket "anon" compartilhado). Em prod (Vercel) o IP sempre existe.
- Se a busca virar autenticada um dia, bucketizar por sessão é mais robusto que por IP.
