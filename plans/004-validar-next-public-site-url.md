# Plan 004: Validar `NEXT_PUBLIC_SITE_URL` via `@emach/env/web`

> **Status em 2026-09-28:** implementado. `NEXT_PUBLIC_SITE_URL: z.url()` está em `clientSchema` (`packages/env/src/schemas.ts:44`) e `packages/env/src/web.ts` o repassa no `runtimeEnv`. Os call sites usam `env.NEXT_PUBLIC_SITE_URL` sem fallback: `app/robots.ts:4`, `app/sitemap.ts:8`, `app/layout.tsx:25`, `product-json-ld.tsx:9`, `lib/seo/canonical.ts:12` e `components/seo/site-json-ld.tsx:20`.

> **Executor instructions**: Siga passo a passo, rode cada verificação. STOP
> conditions = pare e reporte. Ao terminar, atualize a linha em `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- packages/env/src/web.ts apps/web/src/app/robots.ts apps/web/src/app/sitemap.ts apps/web/src/app/layout.tsx "apps/web/src/app/(shop)/product/[slug]/_components/product-json-ld.tsx"`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / dx
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

Quatro arquivos leem `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"`
direto, sem passar por `@emach/env`. Se a var sumir em produção (troca de config
de deploy), `robots.txt`, `sitemap.xml`, JSON-LD de produto e as URLs OG/canonical
caem para `localhost:3001` **silenciosamente** — regressão de SEO entregue a
crawlers do Google/redes sociais, sem erro no boot que a denuncie. Validar a var
no `@emach/env/web` (que já roda no startup) transforma a falha silenciosa em
erro de build explícito.

## Current state

- `packages/env/src/web.ts` (atual, completo):

_Nota 2026-09-28: o `web.ts` deste passo é o estado de 2026-06-17. Hoje ele usa `client: clientSchema`, definido em `packages/env/src/schemas.ts`. Além dos 4 call sites, há mais dois (`canonical.ts`, `site-json-ld.tsx`), criados depois pelo trabalho de SEO (#218)._
  ```ts
  import { createEnv } from "@t3-oss/env-core";
  import { z } from "zod";

  export const env = createEnv({
  	clientPrefix: "NEXT_PUBLIC_",
  	client: {
  		NEXT_PUBLIC_ECOMMERCE_AUTH_URL: z.url(),
  		NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY: z.string().min(1).optional(),
  	},
  	runtimeEnv: {
  		NEXT_PUBLIC_ECOMMERCE_AUTH_URL: process.env.NEXT_PUBLIC_ECOMMERCE_AUTH_URL,
  		NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY:
  			process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY,
  	},
  	emptyStringAsUndefined: true,
  });
  ```
- Os 4 call sites (todos com o mesmo fallback `?? "http://localhost:3001"`):
  - `apps/web/src/app/robots.ts:3` — `const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";`
  - `apps/web/src/app/sitemap.ts:9` — idem (`const BASE_URL = ...`)
  - `apps/web/src/app/layout.tsx:22-24` — `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001")`
  - `apps/web/src/app/(shop)/product/[slug]/_components/product-json-ld.tsx:5` — `const BASE_URL = ...`
- Como importar: o pacote expõe `@emach/env/web` (confirme em `packages/env/package.json`
  o export `./web`; o `server.ts` é importado como `@emach/env`/`@emach/env/server`
  em outros arquivos — siga o mesmo padrão de import já usado no repo).

## Commands you will need

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|----------|
| Typecheck | `bun run --filter=web check-types`   | exit 0   |
| Lint      | `bun check`                          | exit 0   |
| Grep      | `grep -rn "NEXT_PUBLIC_SITE_URL ??" apps/web/src` | 0 matches no fim |

## Scope

**In scope**:
- `packages/env/src/web.ts`
- `apps/web/src/app/robots.ts`
- `apps/web/src/app/sitemap.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/(shop)/product/[slug]/_components/product-json-ld.tsx`

**Out of scope**:
- `packages/env/src/server.ts` — `NEXT_PUBLIC_SITE_URL` é client (vai em `web.ts`).
- Adicionar a var ao `.env.example` é tratado no Plano 003; se 003 ainda não
  rodou, adicione **só** `NEXT_PUBLIC_SITE_URL=http://localhost:3001` na seção
  client do `.env.example` (uma linha) para não quebrar onboarding.

## Git workflow

- Branch: `advisor/004-site-url-env`
- Commit `fix:` ou `refactor:` PT, ≤50 chars.

## Steps

### Step 1: Adicionar `NEXT_PUBLIC_SITE_URL` ao schema client

Em `packages/env/src/web.ts`, adicione a chave ao `client` e ao `runtimeEnv`:

```ts
client: {
	NEXT_PUBLIC_SITE_URL: z.url(),
	NEXT_PUBLIC_ECOMMERCE_AUTH_URL: z.url(),
	NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY: z.string().min(1).optional(),
},
runtimeEnv: {
	NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
	NEXT_PUBLIC_ECOMMERCE_AUTH_URL: process.env.NEXT_PUBLIC_ECOMMERCE_AUTH_URL,
	NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY:
		process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY,
},
```

**Verify**: `bun run --filter=@emach/env check-types` → exit 0 (se o pacote tiver
script check-types; senão `bun run --filter=web check-types`).

### Step 2: Trocar os 4 call sites para `env.NEXT_PUBLIC_SITE_URL`

Em cada um dos 4 arquivos, importe `env` de `@emach/env/web` e substitua
`process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"` por
`env.NEXT_PUBLIC_SITE_URL`. Exemplo em `robots.ts`:

```ts
import { env } from "@emach/env/web";
// ...
const BASE_URL = env.NEXT_PUBLIC_SITE_URL;
```

Em `layout.tsx`: `metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL)`.

Mantenha o resto de cada arquivo intacto.

**Verify**: `grep -rn "NEXT_PUBLIC_SITE_URL ??" apps/web/src` → **0 matches**.
`bun run --filter=web check-types` → exit 0.

### Step 3: Garantir a var no ambiente local

Para o build/dev local não quebrar com a var agora obrigatória, confirme que
`apps/web/.env` (ou `.env.example` se 003 não rodou) tem
`NEXT_PUBLIC_SITE_URL=http://localhost:3001`. Se faltar no `.env.example`,
adicione na seção `# Client (NEXT_PUBLIC_*)`.

**Verify**: `bun run --filter=web check-types` → exit 0.

## Test plan

- Sem teste de código (env + SSR puro). Verificação por grep + typecheck.
- Sanidade manual opcional: `bun dev:web` e abrir `/robots.txt` e `/sitemap.xml`
  — as URLs devem usar o host configurado (em dev, localhost:3001 via a var).

## Done criteria

- [ ] `web.ts` declara `NEXT_PUBLIC_SITE_URL: z.url()` em `client` e `runtimeEnv`
- [ ] Os 4 call sites usam `env.NEXT_PUBLIC_SITE_URL` (sem fallback inline)
- [ ] `grep -rn "NEXT_PUBLIC_SITE_URL ??" apps/web/src` → 0 matches
- [ ] `NEXT_PUBLIC_SITE_URL` presente no `.env.example` (seção client)
- [ ] `bun run --filter=web check-types` → exit 0
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- `@emach/env/web` não for um import válido (export `./web` ausente em
  `packages/env/package.json`) — reporte o caminho de import correto observado.
- Um 5º call site de `NEXT_PUBLIC_SITE_URL` aparecer no grep (estrutura divergiu).
- `z.url()` rejeitar o valor local — confirme que o `.env` tem URL completa com esquema.

## Maintenance notes

- Com a var agora validada, qualquer deploy sem `NEXT_PUBLIC_SITE_URL` falha no
  build (comportamento desejado). Documentar isso no runbook de deploy.
- Reviewer: confirmar que nenhum dos 4 arquivos manteve o fallback `?? "localhost"`.
