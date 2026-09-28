# Plan 003: Completar o `.env.example` com as variáveis obrigatórias faltantes

> **Status em 2026-09-28:** implementado, com conteúdo trocado. `apps/web/.env.example` tem a seção Upstash (linhas 60-66) e `NEXT_PUBLIC_SITE_URL`. As variáveis `SUPERFRETE_*` e `DEFAULT_BRANCH_ID` não existem mais: o frete migrou para Frenet (#178) e o `.env.example` traz `FRENET_TOKEN`, `FRENET_SELLER_CEP` e `FRENET_BASE_URL` (`packages/env/src/schemas.ts:38-40`).

> **Executor instructions**: Follow this plan step by step. Run every verification
> command. If anything in "STOP conditions" occurs, stop and report. When done,
> update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- apps/web/.env.example packages/env/src/server.ts`
> Se algum mudou, compare os excerpts antes de prosseguir; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

`packages/env/src/server.ts` valida o ambiente no boot e **lança** se uma var
obrigatória faltar. Quatro vars obrigatórias e duas opcionais-mas-críticas NÃO
estão no `apps/web/.env.example`. O `README` instrui `cp apps/web/.env.example
apps/web/.env` — então um dev novo (ou agente) que siga o onboarding tem o build
explodindo no primeiro acesso a frete (`SUPERFRETE_*`, `DEFAULT_BRANCH_ID`
ausentes). Onboarding quebrado, falha silenciosa até o primeiro `bun dev:web`.

## Current state

- `packages/env/src/server.ts:38-46` — vars que faltam no exemplo:

_Nota 2026-09-28: o schema deixou de viver em `server.ts`. Hoje ele está em `packages/env/src/schemas.ts` (`serverSchema`, `clientSchema`) e `server.ts` só chama `createEnv`. As variáveis `SUPERFRETE_TOKEN`, `SUPERFRETE_BASE_URL`, `SUPERFRETE_USER_AGENT` e `DEFAULT_BRANCH_ID` foram removidas do schema e substituídas por `FRENET_TOKEN`, `FRENET_SELLER_CEP` e `FRENET_BASE_URL`. O bloco de código abaixo é o estado de 2026-06-17._
  ```ts
  SUPERFRETE_TOKEN: z.string().min(1),
  SUPERFRETE_BASE_URL: z.url(),
  SUPERFRETE_USER_AGENT: z.string().min(1),
  DEFAULT_BRANCH_ID: z.string().min(1),
  // Upstash Redis (REST) — rate limit serverless. Opcionais: ausentes →
  // fallback in-memory em dev; obrigatórias na prática em produção (Vercel).
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  ```
- `apps/web/.env.example` — tem DATABASE_URL, Better Auth, Resend, Supabase,
  NODE_ENV e os `NEXT_PUBLIC_*`, mas **nenhuma** das 6 acima. O arquivo usa
  cabeçalhos de seção no estilo:
  ```
  # ============================================================
  # Email (Resend)
  # ============================================================
  ```
- Convenção observada: valores reais omitidos (`RESEND_API_KEY=re_`), comentário
  curto explicando origem/restrição. NÃO colocar segredos reais.

## Commands you will need

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|----------|
| Lint      | `bun check`                          | exit 0   |
| Sanidade  | `grep -c SUPERFRETE apps/web/.env.example` | ≥ 3 |

## Scope

**In scope**:
- `apps/web/.env.example` (apenas adicionar linhas)

**Out of scope**:
- `packages/env/src/server.ts` — o schema está correto; não alterar.
- `apps/web/.env` real (se existir) — nunca commitar nem editar.
- `README.md` — não é necessário para este plano.

## Git workflow

- Branch: `advisor/003-env-example`
- Commit `docs:` ou `chore:` PT, ≤50 chars.

## Steps

### Step 1: Adicionar a seção de frete (SuperFrete)

_Nota 2026-09-28: passo obsoleto. A seção de frete do `.env.example` hoje é "Frete (Frenet)" e não usa nenhuma variável `SUPERFRETE_*`._

Anexe ao `apps/web/.env.example`, no estilo das seções existentes:

```
# ============================================================
# Frete (SuperFrete)
# ============================================================
# Token da API SuperFrete. Sandbox e produção têm tokens distintos.
SUPERFRETE_TOKEN=
# Sandbox: https://sandbox.superfrete.com — Produção: https://api.superfrete.com
SUPERFRETE_BASE_URL=https://sandbox.superfrete.com
# User-Agent exigido pela SuperFrete (ex.: "EMACH (contato@emachferramentas.com.br)")
SUPERFRETE_USER_AGENT=
# Filial de origem do frete (fallback) — id de branch no banco
DEFAULT_BRANCH_ID=
```

### Step 2: Adicionar a seção de rate limit (Upstash)

```
# ============================================================
# Rate limit (Upstash Redis REST) — opcional em dev, obrigatório em prod
# ============================================================
# Ausentes → fallback in-memory (best-effort, por instância). Em produção
# (Vercel serverless) preencher para rate limit durável e compartilhado.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

**Verify**: `grep -E "SUPERFRETE_TOKEN|SUPERFRETE_BASE_URL|SUPERFRETE_USER_AGENT|DEFAULT_BRANCH_ID|UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN" apps/web/.env.example`
→ as 6 linhas aparecem.

## Test plan

- Sem testes de código. Verificação manual: as 6 chaves presentes no `.env.example`
  e cada chave obrigatória do `server.ts` tem entrada correspondente.
- Conferência cruzada: `grep -oE "^[A-Z_]+(?==)" apps/web/.env.example | sort` cobre
  todas as keys non-optional declaradas em `server.ts`.

## Done criteria

- [ ] As 6 vars (`SUPERFRETE_TOKEN`, `SUPERFRETE_BASE_URL`, `SUPERFRETE_USER_AGENT`, `DEFAULT_BRANCH_ID`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) estão no `.env.example`
- [ ] Nenhum valor de segredo real foi escrito (só placeholders/URLs públicas)
- [ ] `bun check` → exit 0
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- `packages/env/src/server.ts` declarar vars obrigatórias **além** das 6 listadas
  que também faltem no exemplo — reporte a lista completa antes de adicionar.
- Existir um `apps/web/.env` real e você for tentado a copiar valores dele —
  NÃO copie segredos; use só placeholders.

## Maintenance notes

- Toda var nova adicionada a `server.ts`/`web.ts` deve ganhar entrada no
  `.env.example` no mesmo PR. Reviewer deve checar esse pareamento.
- Considerar (follow-up) um teste/script que falhe se houver var obrigatória em
  `server.ts` sem linha no `.env.example`.
