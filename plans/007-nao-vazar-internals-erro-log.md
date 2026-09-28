# Plan 007: Não vazar internals em erros de action e logs

> **Status em 2026-09-28:** implementado. As três actions de endereço retornam mensagem fixa no catch e mantêm `error: message` só no `log.error` (`apps/web/src/app/dashboard/dados-pessoais/_actions/addresses.ts:140`, `203`, `255`). `apply-coupon.ts` não loga mais `code` no catch (`apps/web/src/app/checkout/_actions/apply-coupon.ts:92`).

> **Executor instructions**: Siga passo a passo, rode cada verificação. STOP =
> pare e reporte. Ao terminar, atualize `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- apps/web/src/app/dashboard/dados-pessoais/_actions/addresses.ts apps/web/src/app/checkout/_actions/apply-coupon.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

Duas frentes de data minimization:

1. **Erro cru ao cliente** — `updateAddressAction`, `deleteAddressAction` e
   `setDefaultAddressAction` retornam `{ ok: false, error: message }` onde
   `message = err.message`. Um erro do Postgres (nome de constraint, coluna,
   tabela, falha de conexão) chega **verbatim** ao browser. As outras actions do
   repo (`createAddressAction`, `cancelOrderAction`) já retornam string genérica
   — estas três são outliers.
2. **PII de baixa sensibilidade em log** — `applyCouponAction` loga o `code` do
   cupom no `log.error`. Em si é baixo risco, mas com um drain externo de logs
   (futuro) retém códigos de campanha, facilitando enumeração. O `action` já
   identifica o evento; o `code` é dispensável.

## Current state

- `addresses.ts` — os três catch blocks (linhas 137-146, 200-209, 252-261)

_Nota 2026-09-28: as linhas citadas derivaram para 132-140, 195-203 e 247-255. O estado descrito abaixo é o anterior ao fix._
  seguem este shape (exemplo `updateAddressAction`):
  ```ts
  } catch (err) {
  	const message = err instanceof Error ? err.message : "Erro inesperado";
  	log.error({
  		action: "update_address_failed",
  		clientId,
  		addressId: id,
  		error: message,
  	});
  	return { ok: false, error: message };   // <- vaza err.message
  }
  ```
- **Padrão correto no MESMO arquivo** — `createAddressAction` (addresses.ts:82-86):
  ```ts
  } catch (err) {
  	const message = err instanceof Error ? err.message : "Erro inesperado";
  	log.error({ action: "create_address_failed", clientId, error: message });
  	return { ok: false, error: "Não foi possível salvar o endereço" };
  }
  ```
  Os erros de negócio dentro da transação são lançados como
  `throw new Error("Endereço não encontrado")` — hoje essa mensagem (segura)
  também sai pelo catch genérico; com o fix ela passa a virar genérica também.
  Isso é aceitável: a UI não depende do texto exato (STOP se depender — ver abaixo).
- `apply-coupon.ts:89-95` — `code` logado:
  ```ts
  } catch (err) {
  	log.error({
  		action: "apply_coupon_failed",
  		code,                                  // <- remover
  		error: err instanceof Error ? err.message : "erro inesperado",
  	});
  	return { ok: false, error: "Não foi possível validar o cupom" };
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|----------|
| Typecheck | `bun run --filter=web check-types`   | exit 0   |
| Lint      | `bun check`                          | exit 0   |

## Scope

**In scope**:
- `apps/web/src/app/dashboard/dados-pessoais/_actions/addresses.ts` (3 catch returns)
- `apps/web/src/app/checkout/_actions/apply-coupon.ts` (remover `code` do log)

**Out of scope**:
- `cancelOrderAction`/`createAddressAction` — já corretos.
- A chamada `log.error` em si nas address actions — **mantenha** `error: message`
  no log (debugging precisa do erro real); só o `return` ao cliente vira genérico.
- `reviews.ts`/`refunds.ts`/`orders.ts` — já retornam genérico no catch externo.

## Git workflow

- Branch: `advisor/007-data-minimization`
- Commit `fix:` ou `refactor:` PT, ≤50 chars.

## Steps

### Step 1: Genérico no retorno das 3 address actions

Em `addresses.ts`, nos catch blocks de `updateAddressAction`,
`deleteAddressAction` e `setDefaultAddressAction`, troque **só a linha do
`return`** (o `log.error` com `error: message` fica):

- `updateAddressAction` (linha 145):
  `return { ok: false, error: "Não foi possível atualizar o endereço" };`
- `deleteAddressAction` (linha 208):
  `return { ok: false, error: "Não foi possível excluir o endereço" };`
- `setDefaultAddressAction` (linha 260):
  `return { ok: false, error: "Não foi possível definir o endereço padrão" };`

**Verify**: `grep -n "error: message" apps/web/src/app/dashboard/dados-pessoais/_actions/addresses.ts`
→ só linhas dentro de `log.error({...})`, **nenhuma** num `return`.

### Step 2: Remover `code` do log em apply-coupon

Em `apply-coupon.ts`, no catch block, remova a linha `code,`:

```ts
} catch (err) {
	log.error({
		action: "apply_coupon_failed",
		error: err instanceof Error ? err.message : "erro inesperado",
	});
	return { ok: false, error: "Não foi possível validar o cupom" };
}
```

**Verify**: `bun run --filter=web check-types` → exit 0.

## Test plan

- Sem teste novo (caminhos de erro de infra; difícil de exercitar sem injetar
  falha de DB). Verificação por grep + typecheck + revisão do diff.

## Done criteria

- [ ] As 3 address actions retornam string genérica no catch (não `err.message`)
- [ ] O `log.error` das 3 mantém `error: message` (debugging preservado)
- [ ] `apply-coupon.ts` não loga mais `code`
- [ ] `bun run --filter=web check-types` → exit 0
- [ ] `bun check` → exit 0
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- Algum componente da UI fizer match no texto exato `"Endereço não encontrado"`
  vindo dessas actions (`grep -rn "Endereço não encontrado" apps/web/src` e ver
  se há comparação) — se a UI depende da string, preserve-a antes de generalizar.

## Maintenance notes

- Reviewer: confirmar que nenhum `return { ok:false, error: <variável de erro> }`
  sobrou em server actions — o retorno ao cliente deve ser sempre string fixa.
- Padrão do repo: erro real só em `log.error`; cliente recebe mensagem genérica.
