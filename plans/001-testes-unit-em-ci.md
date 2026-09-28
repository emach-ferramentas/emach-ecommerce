# Plan 001: Rodar a suíte de testes unit no CI

> **Status em 2026-09-28:** implementado. O CI roda `bun run --filter=web test:ci` (`.github/workflows/ci.yml:19`) com `VITEST_UNIT_ONLY=1` e a lista `INTEGRATION` de `apps/web/vitest.config.ts:8`. O job também roda `bun check` e os testes de `@emach/validators`, `@emach/db` e `@emach/auth` (#221).

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- apps/web/vitest.config.ts apps/web/package.json .github/workflows/ci.yml`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

O repo tem 28 arquivos de teste que cobrem o caminho do dinheiro (cálculo de
preço, cupom, máquina de status de pedido/reembolso, validadores). Mas o CI
(`.github/workflows/ci.yml`) só roda `bun check-types` — **nenhum teste roda em
PR ou push**. Uma regressão que quebre qualquer um desses testes chega à `main`
sem resistência. Este plano faz o subconjunto de testes **unit** (sem banco)
rodar no CI, dando uma rede de segurança imediata e sem flakiness. Os testes de
**integração** (que batem no Supabase compartilhado e são flaky sob
concorrência — ver `CLAUDE.md`) ficam fora do CI por ora, rodando só localmente.

## Current state

- `.github/workflows/ci.yml` — único job `check-types`, sem passo de teste:
  ```yaml
  jobs:
    check-types:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: oven-sh/setup-bun@v2
          with:
            bun-version: 1.3.11
        - run: bun install --frozen-lockfile
        - run: bun check-types
  ```
- `apps/web/vitest.config.ts` (atual, completo):

_Nota 2026-09-28: os trechos abaixo são o estado de 2026-06-17. Hoje o `ci.yml` também roda `bun check` e o `test:ci`, e o `vitest.config.ts` tem `setupFiles` e outra lista `INTEGRATION`._
  ```ts
  import { resolve } from "node:path";
  import { defineConfig } from "vitest/config";

  export default defineConfig({
  	resolve: {
  		alias: {
  			"@": resolve(import.meta.dirname, "src"),
  		},
  	},
  	css: {
  		postcss: {},
  	},
  	test: {
  		environment: "node",
  	},
  });
  ```
- `apps/web/package.json` script atual: `"test": "vitest run"`.
- **Os 8 testes de integração**

_Nota 2026-09-28: a lista abaixo está desatualizada. `src/lib/superfrete/quote.test.ts` e `src/lib/origin-branch.test.ts` não existem mais (o frete migrou para Frenet, #178). A lista vigente em `apps/web/vitest.config.ts:8` é: `auto-promo.integration`, `tool-images.integration`, `place-order`, `revalidate-cart`, `validate-coupon`, `facet-counts` e `catalog-data`._ (importam `@emach/db`/usam `withRollback`, batem no
  banco real) que devem ficar FORA do CI:
  - `src/app/checkout/_lib/place-order.test.ts`
  - `src/app/checkout/_lib/place-order.shipping.test.ts`
  - `src/app/checkout/_actions/create-order.test.ts`
  - `src/app/checkout/_actions/revalidate-cart.test.ts`
  - `src/lib/coupons/validate-coupon.test.ts`
  - `src/lib/origin-branch.test.ts`
  - `src/lib/superfrete/quote.test.ts`
  - `src/app/(shop)/catalog/_lib/category-tree.test.ts`

Convenção do repo: scripts via Bun + Turbo; CI usa `oven-sh/setup-bun@v2` com
`bun-version: 1.3.11`.

## Commands you will need

| Purpose         | Command                                  | Expected on success |
|-----------------|------------------------------------------|---------------------|
| Typecheck       | `bun run --filter=web check-types`       | exit 0              |
| Testes unit CI  | `bun run --filter=web test:ci`           | todos passam, 0 integração rodada |
| Suíte completa  | `bun run --filter=web test`              | roda tudo (pode falhar integração sem DB — esperado localmente sem `DATABASE_URL`) |
| Lint            | `bun check`                              | exit 0              |

## Scope

**In scope**:
- `apps/web/vitest.config.ts`
- `apps/web/package.json` (só adicionar 1 script)
- `.github/workflows/ci.yml`

**Out of scope** (NÃO tocar):
- Qualquer arquivo `*.test.ts` — não reescrever testes neste plano.
- `packages/db/package.json` e seus testes — fora do escopo (storefront only).
- Tentar rodar os testes de integração no CI (exige Postgres efêmero — follow-up).

## Git workflow

- Branch: `advisor/001-testes-unit-em-ci`
- Commit estilo Conventional Commits em PT (ver `git log`: `test:`, `chore:`, `ci:`). Sujeito ≤50 chars.
- Não push nem PR a menos que o operador peça.

## Steps

### Step 1: Excluir os testes de integração via env flag no vitest.config

Edite `apps/web/vitest.config.ts` para excluir a lista de integração **só quando**
`VITEST_UNIT_ONLY=1` (assim a suíte completa local continua rodando tudo). Use
`configDefaults.exclude` para não perder os defaults (`node_modules`, etc.):

```ts
import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

// Testes de integração que batem no Supabase compartilhado: precisam de
// DATABASE_URL e são flaky sob concorrência (ver CLAUDE.md). Rodam localmente
// via `bun run --filter=web test`; ficam fora do CI (VITEST_UNIT_ONLY=1) até
// haver um Postgres efêmero no pipeline.
const INTEGRATION = [
	"**/checkout/_lib/place-order.test.ts",
	"**/checkout/_lib/place-order.shipping.test.ts",
	"**/checkout/_actions/create-order.test.ts",
	"**/checkout/_actions/revalidate-cart.test.ts",
	"**/lib/coupons/validate-coupon.test.ts",
	"**/lib/origin-branch.test.ts",
	"**/lib/superfrete/quote.test.ts",
	"**/catalog/_lib/category-tree.test.ts",
];

const unitOnly = process.env.VITEST_UNIT_ONLY === "1";

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(import.meta.dirname, "src"),
		},
	},
	css: {
		postcss: {},
	},
	test: {
		environment: "node",
		exclude: unitOnly
			? [...configDefaults.exclude, ...INTEGRATION]
			: configDefaults.exclude,
	},
});
```

**Verify**: `bun run --filter=web check-types` → exit 0.

### Step 2: Adicionar o script `test:ci` no package.json do web

Em `apps/web/package.json`, adicione (logo após `"test": "vitest run"`):

```json
"test:ci": "VITEST_UNIT_ONLY=1 vitest run",
```

**Verify**: `bun run --filter=web test:ci` → todos passam e a saída do vitest
NÃO lista nenhum dos 8 arquivos de integração (confira que `place-order.test.ts`,
`validate-coupon.test.ts` etc. não aparecem). Se algum teste unit falhar por
erro de conexão com banco (`ECONNREFUSED`, `DATABASE_URL`), veja STOP conditions.

### Step 3: Adicionar o passo de teste ao CI

Em `.github/workflows/ci.yml`, adicione um passo após `bun check-types` no job
existente (mesma checkout/install já servem):

```yaml
      - run: bun check-types
      - run: bun run --filter=web test:ci
```

**Verify**: `bun run --filter=web test:ci` localmente → exit 0. (O CI real só
roda no push; não force push aqui.)

## Test plan

- Não há novos testes neste plano — ele faz os testes existentes rodarem.
- Verificação: `bun run --filter=web test:ci` passa e exclui os 8 de integração.
- Sanidade da suíte completa: `bun run --filter=web test` continua incluindo os
  de integração (rodando ou falhando por falta de `DATABASE_URL`, conforme o
  ambiente) — confirma que o gate `VITEST_UNIT_ONLY` não vazou para o run local.

## Done criteria

- [ ] `apps/web/vitest.config.ts` exclui `INTEGRATION` só sob `VITEST_UNIT_ONLY=1`
- [ ] `apps/web/package.json` tem o script `test:ci`
- [ ] `.github/workflows/ci.yml` roda `bun run --filter=web test:ci`
- [ ] `bun run --filter=web test:ci` → exit 0, nenhum arquivo de integração na saída
- [ ] `bun run --filter=web check-types` → exit 0
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte (não improvise) se:
- Um teste em `test:ci` falhar por erro de conexão com banco (`ECONNREFUSED`,
  `DATABASE_URL` ausente, timeout de pool) — significa que um arquivo "unit"
  na verdade bate no banco e precisa entrar na lista `INTEGRATION`. Reporte qual.
- `bun run --filter=web test:ci` ainda lista um dos 8 arquivos de integração na
  saída (glob não casou — o caminho real difere do excerpt).
- Algum teste unit falha por motivo de lógica (não-infra) no commit `feafcfa` —
  pode ser flakiness pré-existente; reporte em vez de "consertar" o teste.

## Maintenance notes

- Quando houver um Postgres efêmero no CI (ex.: `services: postgres` ou
  `supabase start`), criar um job separado `test:integration` com `DATABASE_URL`
  apontando pra ele e rodar os 8 arquivos de `INTEGRATION` lá — de preferência
  com `--no-file-parallelism` (a flakiness vem de contenção contra o mesmo banco).
- Todo teste novo que bata no banco deve ser adicionado à lista `INTEGRATION`,
  senão quebra o CI. Considerar uma convenção de nome (`*.integration.test.ts`)
  num follow-up para tornar isso automático.
- Reviewer deve checar que a lista `INTEGRATION` casa com os arquivos reais.
