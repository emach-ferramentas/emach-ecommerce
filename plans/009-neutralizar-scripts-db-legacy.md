# Plan 009: Neutralizar os scripts legacy `db:generate` / `db:migrate`

> **Status em 2026-09-28:** implementado. `db:generate` e `db:migrate` viram `echo ... && exit 1` em `package.json:34-35` e em `packages/db/package.json:14,16`. As tasks saíram do `turbo.json`, que hoje mantém `db:push` e `db:studio`. O CLAUDE.md da raiz e o `packages/db/CLAUDE.md` seguem descrevendo os scripts como legacy.

> **Executor instructions**: Siga passo a passo, rode cada verificação. STOP =
> pare e reporte. Ao terminar, atualize `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- package.json turbo.json packages/db/package.json`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

O `CLAUDE.md` documenta: "`db:generate` / `db:migrate` são legacy — scripts ainda
no `package.json` mas não usar. A pasta `migrations/` foi removida." Mesmo assim
os scripts estão expostos na raiz (`package.json`), no `turbo.json` e em
`packages/db/package.json`, parecendo parte legítima do pipeline. Um dev ou agente
novo que rode `bun run db:migrate` segue um caminho morto (drizzle-kit apontando
para uma pasta inexistente). O fluxo real é `db:push` + `db:apply-triggers` (dev)
ou sync via CI PR do dashboard.

## Current state
_Nota 2026-09-28: os trechos desta seção são o estado de 2026-06-17, antes da neutralização._

- `package.json` (raiz) scripts relevantes:
  ```json
  "db:push": "turbo -F @emach/db db:push",
  "db:studio": "turbo -F @emach/db db:studio",
  "db:generate": "turbo -F @emach/db db:generate",
  "db:migrate": "turbo -F @emach/db db:migrate",
  ```
- `turbo.json` registra as tasks `db:generate` e `db:migrate`:
  ```json
  "db:generate": { "cache": false },
  "db:migrate": { "cache": false, "persistent": true },
  ```
- `packages/db/package.json` scripts:
  ```json
  "db:push": "drizzle-kit push",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  ```
- Fluxo real (CLAUDE.md / `packages/db/CLAUDE.md`): `db:push` + `db:apply-triggers`.

## Commands you will need

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|----------|
| Listar    | `bun run db:push --help` ou inspeção | `db:push` continua funcionando |
| Sanidade  | `grep -n "db:generate\|db:migrate" package.json turbo.json packages/db/package.json` | só os echos novos |

## Decisão: neutralizar (não remover)

Substituir o corpo dos scripts por um `echo` que aponta o caminho certo é mais
seguro que remover (não quebra muscle-memory nem referências externas a esses
nomes; falha barulhenta e instrutiva em vez de silenciosa). Remover as tasks do
`turbo.json` (que não fazem mais sentido) é seguro.

## Scope

**In scope**:
- `package.json` (raiz) — `db:generate`, `db:migrate`
- `packages/db/package.json` — `db:generate`, `db:migrate`
- `turbo.json` — tasks `db:generate`, `db:migrate`

**Out of scope**:
- `db:push`, `db:studio`, `db:apply-triggers`, `db:seed-*` — em uso, não tocar.
- `drizzle.config.ts` — não tocar.

## Git workflow

- Branch: `advisor/009-db-scripts-legacy`
- Commit `chore:` PT, ≤50 chars.

## Steps

### Step 1: Neutralizar nos package.json

Em `package.json` (raiz):
```json
"db:generate": "echo 'LEGACY: schema sync e via CI PR do dashboard. Em dev use db:push.' && exit 1",
"db:migrate": "echo 'LEGACY: pasta migrations/ removida. Use db:push + db:apply-triggers.' && exit 1",
```

Em `packages/db/package.json` (mesmas chaves, mesma mensagem).

**Verify**: `bun run db:migrate` → imprime a mensagem e sai com código ≠ 0
(não invoca drizzle-kit). `bun run db:push --help` ou inspeção → `db:push` intacto.

### Step 2: Remover as tasks do turbo.json

Em `turbo.json`, remova as entradas `"db:generate"` e `"db:migrate"` do bloco
`tasks` (deixe `db:push`, `db:studio` etc.).

**Verify**: `grep -n "db:generate\|db:migrate" turbo.json` → 0 matches.
A árvore JSON continua válida (`bun run db:push` resolve via turbo sem erro de schema).

## Test plan

- Sem teste de código. Verificação: rodar `bun run db:migrate` mostra o echo e
  falha (não roda drizzle-kit migrate); `bun run db:push` continua operante.

## Done criteria

- [ ] `db:generate`/`db:migrate` na raiz e em `packages/db` viram echo + `exit 1`
- [ ] `turbo.json` não tem mais as tasks `db:generate`/`db:migrate`
- [ ] `db:push`/`db:studio`/`db:apply-triggers` intactos
- [ ] `bun run db:migrate` não invoca drizzle-kit
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- Algum workflow de CI (`.github/workflows/`) invocar `db:generate`/`db:migrate`
  (`grep -rn "db:generate\|db:migrate" .github`) — neutralizá-los quebraria o CI;
  reporte antes.
- `turbo.json` ficar com JSON inválido após a remoção (vírgula sobrando).

## Maintenance notes

- Se o time decidir remover de vez (em vez de echo), garantir que nenhum runbook
  externo referencie esses nomes.
- O fluxo canônico (`db:push` + `db:apply-triggers`) está em `packages/db/CLAUDE.md`.
