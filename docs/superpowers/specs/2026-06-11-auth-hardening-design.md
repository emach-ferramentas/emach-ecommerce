# Auth hardening — rate limit, validação server-side e higiene de cookies/logs

> **Status em 2026-09-28:** implementado (PR #99). `packages/redis/src/index.ts`, `packages/validators/src/cpf-cnpj.ts`, `packages/auth/src/rate-limit-storage.ts` e `packages/auth/src/ecommerce.ts` têm rate limit, `minPasswordLength: 8`, validação de `document` e `phone` nos hooks e cookies sem `domain`. `packages/email/src/send.ts` usa `log` do evlog.

**Issues:** #91 (rate limit), #92 (validação server-side senha + CPF/CNPJ), #96 (evlog em email + cookie flags)
**Data:** 2026-06-11
**Escopo:** 1 PR único — os três issues convergem em `packages/auth/src/ecommerce.ts` (mais `packages/email/src/send.ts`).

## Contexto

Instância `ecommerce` do Better Auth (1.6.11, fixo no catalog), Bun workspaces, deploy serverless na Vercel sobre Postgres (Supabase). Hoje a config `betterAuth({})` em `ecommerce.ts` **não** define `rateLimit`, `minPasswordLength`, validação server-side de `document` nem cookie attributes explícitos. `packages/email/src/send.ts` usa `console.error/info` (anti-pattern P0) e loga o e-mail do destinatário em texto plano.

Invariantes P0 respeitadas: a instância dashboard **não** é tocada; nenhum `domain` em cookie; `document` sempre normalizado (só dígitos) antes de persistir.

## Decisões (aprovadas)

| Tema | Decisão | Razão |
|---|---|---|
| Rate limit storage (#91) | **Upstash Redis** via `customStorage`, híbrido com fallback `Map` in-memory | `memory` puro não serve em serverless (cold start zera, lambdas isoladas). Upstash isola o blast radius (só contadores), não polui o Postgres, não depende do dashboard. Híbrido permite testar local sem provisionar nada. |
| Client Redis | Novo package **`@emach/redis`** expondo `getRedis(): Redis \| null` | `packages/auth` não pode importar de `apps/web` (fronteira apps→packages). Client único reusável pela #94 (checkout). Lê envs via `@emach/env/server` (sem ciclo — auth já importa env). |
| Validator CPF/CNPJ (#92) | Novo package **`@emach/validators`** (move `cpf-cnpj.ts` puro) | `packages/auth` precisa de `isValidCpfCnpj`; arquivo é puro (zero deps). Single source of truth para app + auth. |
| Senha (#92) | `emailAndPassword.minPasswordLength: 8` | Enforce server-side; UX client-side (Zod) permanece. |
| Validação `document` (#92) | `databaseHooks.user.{create,update}.before` | Único caminho que cobre sign-up e `updateUser` server-side. Rejeita com `APIError` (só ela propaga mensagem ao cliente). |
| Logger email (#96A) | `import { log } from "evlog"` em `send.ts` | `evlog` é dep npm externa; usa o singleton global (mesmo processo Next). Sem ciclo, mesma API `.error/.info`. |
| Cookie flags (#96B) | `advanced.defaultCookieAttributes` explícito | Defaults do BA já são seguros; tornar explícito e auditável. **Sem `domain`**. |

## Componentes

### 1. `@emach/redis` (novo package)
- `getRedis(): Redis | null` — instancia `@upstash/redis` se `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` presentes; senão `null`.
- Deps: `@upstash/redis`, `@emach/env` (workspace), devDep `@emach/config`.
- Consumido por: `packages/auth` (#91 agora) e `apps/web` checkout (#94 depois, com `@upstash/ratelimit`).

### 2. `packages/env/src/server.ts`
- `UPSTASH_REDIS_REST_URL: z.url().optional()`
- `UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional()`
- `.optional()` para não quebrar dev sem Upstash.

### 3. `@emach/validators` (novo package)
- Move `apps/web/src/lib/validators/cpf-cnpj.ts` → `packages/validators/src/cpf-cnpj.ts` (idêntico, puro).
- Exporta `isValidCpf/isValidCnpj/isValidCpfCnpj/onlyDigits/onlyLetters/maskCpfCnpj/maskPhone` e, desde o #100, `isValidPhone`. O `exports` do pacote aponta direto para `./src/cpf-cnpj.ts` (não há `index.ts`).
- Atualizar ~8 imports em `apps/web` de `@/lib/validators/cpf-cnpj` → `@emach/validators`. _Nota 2026-09-28: feito; `apps/web/src/lib/validators/` hoje só guarda `address`._

### 4. `packages/auth/src/ecommerce.ts` (o grosso)
- **Rate limit (#91):** helper local `rate-limit-storage.ts` com `customStorage` híbrido (Upstash via `getRedis()` ou `Map`; chaves prefixadas `auth:`; TTL = window). Config:
  - `rateLimit: { enabled: true, window: 60, max: 100, customStorage, customRules: { "/sign-in/email": {window:60,max:5}, "/sign-up/email": {window:60,max:5}, "/forget-password": {window:60,max:3} } }` _(Nota 2026-09-28: no código a regra é `"/request-password-reset"` (max 3), porque `/forget-password` é do plugin email-OTP, que não é usado; há também `"/reset-password"` (max 5))_
  - `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]` (Vercel).
- **Senha + document (#92):** `minPasswordLength: 8`; `databaseHooks.user.create.before` e `update.before` (hoje via `normalizeUserForWrite`, que também trata `phone`) — se `document` presente → `onlyDigits` → `isValidCpfCnpj`; inválido → `throw new APIError("BAD_REQUEST", { message })`; válido → `return { data: { ...user, document: normalized } }`.
- **Cookie (#96B):** `advanced.defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProd }`. Sem `domain`. Mantém `cookiePrefix`.

### 5. `packages/email/src/send.ts` (#96A)
- `import { log } from "evlog"` (add dep em `packages/email/package.json`).
- Erro: `log.error({ ... })` antes do throw. Sucesso: `log.info({ ... })`.

## Fluxo de dados (rate limit)

```
request /api/auth/sign-in/email
  → Better Auth resolve IP de x-forwarded-for
  → key = "auth:<ip>:/sign-in/email"
  → customStorage.get(key) → {count, lastRequest} | null
  → conta; se > max no window → HTTP 429
  → customStorage.set(key, value, ttl=window)
       Upstash (prod) | Map (dev/fallback)
```

## Tratamento de erro
- `customStorage` Upstash: try/catch — falha de Redis **não** derruba o request (log.warn + fail-open no contador). Decisão: disponibilidade do login > rate limit perfeito num blip de Redis.
- `databaseHooks`: `APIError` (não `Error` plano) para mensagem chegar ao cliente. Em catch, log estruturado.
- Em prod sem env Upstash: `getRedis()` retorna null → fallback Map (ineficaz em serverless) + `log.warn` único alertando.

## Verificação
- `bun check-types` (todos os packages).
- Smoke real: (a) curl loop em `/api/auth/sign-in/email` → 429 após 5; (b) sign-up direto via API com senha <8 → erro; (c) `updateUser` com CPF dígito-verificador inválido → erro; (d) login/logout pela UI ok; (e) DevTools: cookie `HttpOnly; Secure; SameSite=Lax` sem `Domain` (prod).

## Coordenação com #94 (rate limit checkout)
- Este PR é **dono** do `@emach/redis` + envs; mergeia primeiro.
- #94 rebase e consome `getRedis()` com `@upstash/ratelimit`, prefixo `checkout:` (este usa `auth:`).

## Fora de escopo (YAGNI)
- `secondaryStorage` global (mover sessões pro Redis) — outro projeto.
- Drain externo do evlog (Axiom/Sentry) — roadmap #5.
- Frete fail-open hardening — depende de coluna nova (dashboard). _Nota 2026-09-28: entregue depois, no #97 (PR #110); ver `CLAUDE.md` do repo._
