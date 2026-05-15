# emach-ecommerce — Guia do Projeto para Agentes

> Mapa do projeto. Leia antes de qualquer tarefa.
> **Responda sempre em Português.** Identificadores de código ficam em English.
>
> **Repo irmão:** `https://github.com/othavioquiliao/emach-dashboard` (admin staff) compartilha a **mesma DB Supabase** e parte do schema Drizzle. Tabelas owned-by-dashboard (`tool`, `category`, `promotion`, etc.) têm o dashboard como fonte de verdade — ver §3 (Ownership).

---

## 1. Visão Geral

**EMACH** — e-commerce de **ferramentas elétricas e manuais** (furadeiras, serras, chaves, alicates, EPIs) para o mercado brasileiro. Scaffoldado com [Better-T-Stack](https://better-t-stack.dev/).

| | |
|---|---|
| **Moeda / Mercado** | R$ brasileiro (formato `R$ 899,00`) — pt-BR |
| **Package manager** | Bun 1.3 (catalog workspaces) |
| **Orquestração** | Turborepo 2 |
| **Frontend** | Next.js 16 + React 19 (App Router, RSC, typed routes, React Compiler) |
| **Banco** | PostgreSQL via Supabase (compartilhado com dashboard) |
| **ORM** | Drizzle 0.45 + node-postgres |
| **Auth** | Better Auth — instância `ecommerce` (cliente BR, tabelas `client*`) + Google OAuth |
| **UI** | shadcn (style `base-lyra`, baseado em **Base UI — não Radix**) + Tailwind CSS v4 |
| **Forms** | TanStack Form + Zod |
| **Lint/Format** | Biome via Ultracite |
| **Logging** | `evlog` (instrumentation + request tracing no `proxy.ts` + `log.error` em server actions) |
| **Email** | Resend + React Email |
| **Design** | Ferrari-inspired (chiaroscuro, Barlow, `#DA291C`) — ver `DESIGN.md` |

IDs em server actions/scripts: **`crypto.randomUUID()`** (sem nanoid).

---

## 2. Estrutura do Monorepo

```
emach-ecommerce/
├── apps/web/                 ← App Next.js 16, porta 3001
└── packages/
    ├── config/               ← tsconfig.base.json compartilhado
    ├── env/                  ← Validação de env vars (T3 Env + Zod)
    ├── db/                   ← Drizzle ORM + schema PostgreSQL (cópia versionada do dashboard)
    ├── auth/                 ← Better Auth (instâncias dashboard + ecommerce isoladas)
    ├── email/                ← Resend client + templates React Email
    └── ui/                   ← Biblioteca shadcn compartilhada
```

---

## 3. Packages — O que cada um faz

### `@emach/config` — TypeScript Base
- Apenas `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`). Sem runtime.
- Consumido pelos 5 packages via `extends: "@emach/config/tsconfig.base.json"`. `apps/web` tem `tsconfig.json` próprio (app Next, não estende a base).

---

### `@emach/env` — Variáveis de Ambiente Tipadas
- Valida env vars em build time com Zod (T3 Env). Var faltando → build falha com mensagem clara.
- **Exports** (fonte de verdade — sempre conferir os arquivos):
  - `@emach/env/server` → `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_URL_ECOMMERCE`, `CORS_ORIGIN`, `ECOMMERCE_ORIGIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NODE_ENV`
  - `@emach/env/web` → `NEXT_PUBLIC_ECOMMERCE_AUTH_URL`
- **Modificar:** ao adicionar env var, incluir no schema Zod de `packages/env/src/server.ts` ou `web.ts`.

---

### `@emach/db` — Banco de Dados

- Client Drizzle + schema PostgreSQL. Schema é **cópia versionada** do `emach-dashboard`, sincronizada manualmente a cada migration do dashboard.
- **Exports:**
  - `@emach/db` → `db` (singleton) + `createDb()` (factory, evita ciclo com `@emach/auth`)
  - `@emach/db/schema/<arquivo>` — **preferir caminho específico**
  - `@emach/db/schema` — barrel intencional (`// biome-ignore lint/performance/noBarrelFile`)

**Schemas em `packages/db/src/schema/`:**

| Arquivo | Tabelas | Notas |
|---|---|---|
| `auth.ts` | `user`, `session`, `account`, `verification` | Dashboard staff. **Ecommerce não importa.** Enums `user_role` (`super_admin`/`admin`/`manager`/`user`) e `user_status` (`pending`/`active`/`suspended`). |
| `client.ts` | `client`, `clientSession`, `clientAccount`, `clientVerification`, `clientAddress` | Clientes BR. `country` default `"BR"`; `phone`, `document` unique nullable. **Owned by ecommerce.** |
| `tools.ts` | `supplier`, `tool` (produto-pai enxuto), **`toolVariant`** (SKU + voltagem + preço/custo + barcode), `toolImage` | Enum `voltage` (`127V`/`220V`/`Bivolt`/`380V`). **Toda ferramenta tem ≥1 `toolVariant`** (uma `isDefault=true` via partial unique index). `ToolStatus` é union TS, não pgEnum. |
| `categories.ts` | `category`, `toolCategory` | Árvore hierárquica `parent_id` + `path`/`depth` materializados via trigger. Anti-ciclo + cascade. Depth máx. 5. |
| `attributes.ts` | `attributeDefinition`, `toolAttributeValue`, `toolAttributeAssignment` | Specs dinâmicas (Saleor-lite). Enum `attribute_input_type` (`text`/`number`/`select`/`boolean`/`numeric_range`/`color`). Valor tipado por coluna (`valueText`, `valueNumeric`, `valueNumericMax`, `valueBool`). |
| `inventory.ts` | `branch`, `stockLevel`, `userBranch` | `stockLevel` PK `(variantId, branchId)`, `minQty` + `reorderPoint` + check `quantity >= 0`. `userBranch` é owned-by-dashboard (staff × filial). |
| `stock-movements.ts` | `stockMovement` | Audit por **variante** (`variantId`). `actorType` + `actorId` + `apiKeyId`. Partial unique index → idempotência de débito de venda. |
| `orders.ts` | `order`, `orderItem`, `orderStatusHistory`, `orderNote` | `orderItem` carrega `toolId` + `variantId` + snapshots fiscais/dimensão. Enums `order_status`, `payment_status`. |
| `reviews.ts` | `review` | Enum `review_status`. Unique `(clientId, toolId, orderId)`. SELECT público filtra `status='approved'`. |
| `promotions.ts` | `promotion`, `promotionTool` | Cupons via `promotion.type='promocode'` (não há tabela `coupon`). |
| `api-keys.ts` | `apiKey` | `scopes` + `allowedTags` (text[]), GIN index em scopes. Ecommerce escreve em tabelas dashboard-owned com `actorType='apiKey'`. |
| `consent-log.ts` | `consentLog` | LGPD. Enums `consent_kind` (tos/privacy/marketing_email/cookies) e `consent_actor` (client/lead). |
| `shared-enums.ts` | — | Enum `actor_type` (`user`/`apiKey`/`system`). |

**Ownership e escrita compartilhada:**

- **Owned-by-dashboard (autoritativo):** `tool`, `toolVariant`, `category`, `supplier`, `branch`, `stockLevel`, `userBranch`, `promotion`, `apiKey`, `attribute*`, schema `auth`. Mudanças → PR no dashboard primeiro.
- **Owned-by-ecommerce (autoritativo):** tabelas `client*` (5).
- **Escrita compartilhada:** `order`, `orderItem`, `stockMovement` (`actorType='user'` no dashboard, `actorType='apiKey'` no ecommerce), `review`, `consentLog`, `toolAttributeValue` em fluxos cliente.
- **Cópia de schema:** `packages/db/src/schema/*` é re-sincronizado manualmente. Não editar em isolamento — coordenar via PR no dashboard.
- **Drops/renames em prod:** sempre `bun db:generate` + migration versionada. **Nunca** `db:push --force` em prod.

**Money:** `numeric(10,2)` em `tool_variant.priceAmount`/`costAmount`; `numeric(12,2)` em `order.totalAmount`. Nunca `real`/`double`.

**Triggers PL/pgSQL e RLS — `_triggers.sql` / `_rls.sql`:**
- Triggers (anti-ciclo de categoria com path/depth; idempotência de débito de venda em `stockMovement`) e RLS são **owned-by-dashboard** — gerenciados a partir do repo dashboard. RLS está ativa na DB Supabase: catálogo com SELECT público (anon+authenticated), demais tabelas deny-all (acesso server-side via service role / Better Auth).
- `bun db:apply-triggers` aplica `packages/db/src/migrations/_triggers.sql`. ⚠️ **Esses arquivos SQL não estão versionados neste repo hoje** (`packages/db/src/migrations/` não existe). Para rodar o script localmente, copiar `_triggers.sql` (e `_rls.sql` se for aplicar RLS daqui) do dashboard para `packages/db/src/migrations/`. Sem eles, o script falha.

**`db` × `createDb()`:**
- `db` (singleton, `src/index.ts`) — uso geral em server actions.
- `createDb()` (factory) — usado por `@emach/auth/*` para evitar ciclo de import. **Não** consolidar.
- `apps/web` nunca importa `@emach/db` diretamente em código que também precisa de auth — acesso ao banco em rotas autenticadas é mediado por `@emach/auth`.

**Dependências internas:** `@emach/env`.

---

### `@emach/auth` — Autenticação

Duas instâncias Better Auth isoladas por modelos e cookies:
- **Dashboard staff** (`@emach/auth/dashboard` → `authDashboard`, `DashboardSession`) — tabelas `user`/`session`/`account`/`verification`, `additionalField` `role`. **Não usado neste app.**
- **Ecommerce clients** (`@emach/auth/ecommerce` → `authEcommerce`, `EcommerceSession`) — tabelas `client*`, cookie prefix `ecommerce.session_token`. Email/password (`autoSignIn`, `requireEmailVerification: false`) + **Google OAuth** (`socialProviders`, factory em `src/google.ts`, `prompt: "select_account"`). `additionalFields` `phone` e `document` (opcionais). `sendVerificationEmail` + `sendResetPassword` via `@emach/email`. Plugin `nextCookies()`.

**Consumido em:** `apps/web/src/app/api/auth/[...all]/route.ts` (catch-all), `lib/auth-client.ts` (`createAuthClient`), `lib/session.ts` (`getCurrentClient`/`requireCurrentClient`), `lib/evlog-auth.ts` (`identifyEvlogClient`), `proxy.ts` (guarda `/dashboard`).

**Invariantes P0 (violação = bug crítico):**

1. **`apps/web` deste repo nunca importa `@emach/db/schema/auth` nem `@emach/auth/dashboard`.** O dashboard nunca importa `@emach/db/schema/client` nem `@emach/auth/ecommerce`.
2. `EcommerceSession` ≠ `DashboardSession` — não há tipo "Session" genérico.
3. **Nunca** setar `advanced.cookies.<name>.attributes.domain = ".emach.com.br"` — apps em subdomínios isolam por host.
4. CPF/CNPJ: validação é responsabilidade deste app (zod refine + dígito verificador via `apps/web/src/lib/validators/cpf-cnpj.ts`). Sempre normalizar (só dígitos) antes de persistir em `client.document`.
5. Migrations em prod: `drizzle-kit generate` + migration versionada. `--force` só em dev/staging.

**Modificar:** para adicionar magic link, 2FA, novos OAuth providers, etc.
**Dependências internas:** `@emach/db`, `@emach/env`, `@emach/email`.

---

### `@emach/email` — E-mails Transacionais
- Wrapper Resend SDK + templates React Email. Usado pelo Better Auth ecommerce para verify-email e reset-password.
- **Exports:** `@emach/email/send` → `sendEmail({ to, subject, react })`; `@emach/email/templates/verify-email`; `@emach/email/templates/reset-password`.
- **Sandbox Resend:** `EMAIL_FROM=onboarding@resend.dev` — Resend só entrega para o e-mail do owner da conta. Ao comprar domínio: verificar em Resend (SPF/DKIM/DMARC) e trocar `EMAIL_FROM`.
- **Dependências internas:** `@emach/env`.

---

### `@emach/ui` — Componentes (shadcn)
- Componentes shadcn compartilhados. Style `base-lyra` (primitivo `@base-ui/react`, **não Radix**). Visual compacto, cantos retos.
- **Exports subpath** (sem barrel): `@emach/ui/components/<nome>`, `@emach/ui/lib/utils` (`cn()`), `@emach/ui/globals.css`, `@emach/ui/hooks/<nome>`.
- **Lista viva:** `ls packages/ui/src/components/` — não duplicar aqui.
- **Adicionar:** `bunx shadcn@latest add <nome> -c packages/ui` (aceita múltiplos).
- ⚠️ O `shadcn add` escreve arquivos sem passar pelo hook de lint — rodar `bun check` após adicionar componentes.

---

## 4. Grafo de Dependências

```
@emach/config ──(devDep: tsconfig)──► todos os packages
      │
@emach/env ──(runtime)──► @emach/db, @emach/email
      │                         │            │
      └────────────────────────►@emach/auth ◄┘
                                      │
                               apps/web (consome auth + env + ui)

@emach/ui ──(runtime, independente)──► apps/web
```

---

## 5. App Web (`apps/web`)

```
apps/web/src/
├── index.css            @import "@emach/ui/globals.css"
├── proxy.ts             Guard /dashboard + evlog request tracing (convenção Next 16, ex-`middleware.ts`)
├── instrumentation.ts   Hook Next 16 → evlog instrumentation
├── lib/
│   ├── auth-client.ts, session.ts          Better Auth wiring
│   ├── evlog.ts, evlog-auth.ts             Logger factory + identify cliente
│   ├── cart-context.tsx, cart-store.ts     Cart state (localStorage)
│   ├── constants.ts, format.ts             Tokens BR (R$, frete grátis)
│   ├── default-branch.ts                   getDefaultBranchId() (filial padrão via DB)
│   ├── actions/                            Server actions globais (search)
│   └── validators/                         cpf-cnpj.ts, address.ts (Zod + máscaras)
├── components/          Componentes de negócio compartilhados (ver `ls` pra lista viva)
└── app/                 App Router
    ├── layout.tsx, page.tsx, not-found.tsx, manifest.ts, robots.ts, sitemap.ts
    ├── login/, esqueci-senha/, redefinir-senha/, verificar-email/   (fluxos auth)
    ├── catalog/, product/[slug]/, cart/, checkout/, sobre/          (storefront)
    ├── pedidos/[number]/        Rastreio público de pedido por número
    ├── dashboard/               Cliente logado: pedidos/[id], reembolso, dados-pessoais
    └── api/auth/[...all]/route.ts   Better Auth catch-all (instância ecommerce)
```

> Lista viva sempre via `ls` — não enumerar componentes/rotas individuais aqui.

### Padrões de import

```ts
import { Button } from "@emach/ui/components/button";   // UI compartilhada (subpath, sem barrel)
import { cn } from "@emach/ui/lib/utils";
import { tool, toolVariant } from "@emach/db/schema/tools";  // schema: caminho específico
import { SomeComponent } from "@/components/some-component";  // local do app
import { authClient } from "@/lib/auth-client";
```

---

## 6. Convenções de Organização de Código

### Pastas com `_` prefix (private folders do Next.js)

Ignoradas pelo App Router — não geram rotas. Estrutura padrão de uma rota:

```
app/<rota>/
├── page.tsx              Entry point (server component por padrão)
├── layout.tsx            Layout da rota (se necessário)
├── loading.tsx           Suspense boundary (se necessário)
├── error.tsx             Error boundary (se necessário)
├── _components/          Componentes usados APENAS nesta rota
├── _hooks/               Hooks usados APENAS nesta rota
├── _actions/             Server actions desta rota
└── _lib/                 Utilitários desta rota
```

### Onde colocar cada coisa

| O que criar | Onde |
|---|---|
| Componente UI genérico/reutilizável | `packages/ui/` via `bunx shadcn add -c packages/ui` |
| Componente de negócio compartilhado entre rotas | `apps/web/src/components/` |
| Componente específico de UMA rota | `app/<rota>/_components/` |
| Hook compartilhado entre rotas | `apps/web/src/hooks/` (criar o diretório se preciso) |
| Hook específico de UMA rota | `app/<rota>/_hooks/` |
| Server action | `app/<rota>/_actions/` (ou `lib/actions/` se global) |
| Utilitário compartilhado / específico de rota | `apps/web/src/lib/` / `app/<rota>/_lib/` |
| Nova página/rota | `app/<rota>/page.tsx` |
| API route | `app/api/<rota>/route.ts` |
| Nova tabela no banco | `packages/db/src/schema/<nome>.ts` (coordenar com dashboard se compartilhada) |
| Nova env var | `packages/env/src/server.ts` ou `web.ts` |
| Novo método/plugin de auth | `packages/auth/src/ecommerce.ts` |
| Proxy / middleware global (auth guard, etc.) | `apps/web/src/proxy.ts` (convenção Next 16) |

**Pergunta rápida:** múltiplas apps → `packages/`; múltiplas rotas → `apps/web/src/{components,hooks,lib}/`; uma rota só → pasta da rota com prefix `_`.

---

## 7. Comandos Essenciais

```bash
# Desenvolvimento
bun run dev          # todas as apps/packages via Turbo
bun run dev:web      # só apps/web (porta 3001)
bun run build        # build de produção
bun run check-types  # tsc em todo o monorepo

# Banco de dados (raiz)
bun run db:push      # sync schema → DB sem migration (apenas dev local)
bun run db:generate  # gera migration versionada (staging/prod)
bun run db:migrate   # aplica migrations pendentes
bun run db:studio    # Drizzle Studio

# Banco de dados — utilitários (packages/db)
bun --cwd packages/db db:apply-triggers       # aplica _triggers.sql (ver §3 — arquivo precisa existir)
bun --cwd packages/db db:seed-categories      # bootstrap categorias raiz
bun --cwd packages/db db:seed-attributes      # bootstrap attribute_definitions
bun --cwd packages/db db:anonymize-client <id># LGPD direito ao esquecimento

# Qualidade de código
bun run check        # lint/format (Ultracite/Biome)
bun run fix          # auto-fix
bun x ultracite doctor   # diagnóstico

# shadcn
bunx shadcn@latest add <nome> -c packages/ui   # adicionar componente(s)
bunx shadcn@latest diff -c packages/ui          # ver atualizações
```

> ⚠️ Após `db:push`/`db:migrate`, rodar `db:apply-triggers` (Drizzle Kit não gera triggers PL/pgSQL).
> ℹ️ `.claude/settings.json` tem um hook PostToolUse que roda `bun fix` após cada Write/Edit — não precisa rodar `fix` manualmente após editar via agente.

---

## 8. Environment Variables

Definidas em `apps/web/.env` (gitignored), validadas em build time por `@emach/env`. Template: `apps/web/.env.example`.

**Fonte de verdade:** `packages/env/src/server.ts` (server-only) e `web.ts` (cliente, `NEXT_PUBLIC_`).

**Para adicionar:** (1) schema Zod em `server.ts`/`web.ts`; (2) `apps/web/.env` + `.env.example`; (3) usar via `import { env } from "@emach/env/server"` — nunca `process.env.*` direto.

**Categorias:**
- **DB:** `DATABASE_URL`
- **Better Auth:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_URL_ECOMMERCE`, `CORS_ORIGIN`, `ECOMMERCE_ORIGIN`
- **OAuth:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Email:** `RESEND_API_KEY`, `EMAIL_FROM`
- **Supabase:** `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (ambas em `server.ts`)
- **App:** `NODE_ENV`
- **Client (`web.ts`):** `NEXT_PUBLIC_ECOMMERCE_AUTH_URL`

> A filial padrão **não** é env var — é resolvida via `lib/default-branch.ts` (`getDefaultBranchId()`, lookup na DB).

---

## 9. Estado do Projeto — Lacunas Conhecidas

Gaps arquiteturais reais e estáveis (para detalhe vivo, sempre olhar o código):

- **Rate limit em endpoints auth** — sem proteção contra brute-force em `signin`/`signup`/`reset`.
- **Domínio verificado no Resend** — em sandbox (`onboarding@resend.dev`); só entrega para o owner da conta. Ver §3 `@emach/email`.
- **Evlog drain externo** — `lib/evlog.ts` configurado mas sem drain (Axiom/Datadog/Sentry); output só em console.
- **CI/CD e Docker** — nenhuma config de deploy existe.

---

## 10. Design System — Ferrari-Inspired

Linguagem visual inspirada no site Ferrari; os produtos são **ferramentas**. **Detalhe completo (tokens, paleta oklch, tipografia, chiaroscuro, componentes EMACH custom, breakpoints): `DESIGN.md`** — abrir antes de qualquer trabalho de UI.

### Princípios

1. **Vermelho é verbo, não decoração.** Ferrari Red (`#DA291C`) aparece UMA vez por tela, como CTA de alta prioridade.
2. **Cada seção é uma vinheta.** Ritmo dark→light→dark é narrativo (seções alternam via `className="dark"`, não há toggle global).
3. **Cantos retos = precisão.** `border-radius: 0` em componentes interativos (exceto modais ≤8px, avatares 50%).
4. **Informação técnica é design.** Specs (voltagem, torque, RPM, peso) com a mesma atenção visual que headlines.
5. **Whitespace generoso, mas cada seção com densidade e propósito.**

Tipografia: **Barlow** (headings, body, botões) e **Barlow Condensed** (labels/tags, sempre uppercase + `tracking`). Não misturar as duas no mesmo bloco. Preços sempre `R$ 899,00`.

### Categorias de Produtos

Ferramentas Elétricas · Ferramentas Manuais · Medição · Segurança (EPIs) · Acessórios.

---

## 11. Anti-patterns banidos & Code Standards (P0/P1)

**Padrões obrigatórios (Next 16 / React 19):**
- **React 19:** `ref` é prop normal — **nunca `React.forwardRef`**. React Compiler ativo — **sem `useMemo`/`useCallback` manual**.
- **Next 16:** Server Components por padrão; `"use client"` só para eventos/hooks/estado local. `typedRoutes: true` — `<Link href>` valida em tsc.
- **Data fetching SEMPRE em Server Component** — `async function` em Client Component (`"use client"`) é proibido.
- **Server actions:** `"use server"` no topo, guarda de sessão no início, input validado com Zod, normalizar antes de persistir. Retornar `ActionResult<T>` (`{ ok: true; data } | { ok: false; error }`).

**Banidos:**
- **`console.log/warn/error`** em produção — usar `log` do evlog (`import { log } from "@/lib/evlog"`). Em catch de server action, **sempre** `log.error({ action, ...context })` antes de retornar `{ ok: false }` — silenciar erro sem log é P0.
- **`: any`, `as any`, `@ts-ignore`, `@ts-expect-error`** — exceto em `.next/` gerado.
- **`key={index}`** em `.map()` — usar ID estável. Exceções ficam com `biome-ignore` explícito.
- **`<img>` puro** — sempre `next/image` (exceção thumbs Supabase com `// biome-ignore lint/performance/noImgElement` documentado).
- **Barrel files** (`index.ts` que só re-exporta) em `packages/ui/src`, `apps/web/src`, `packages/auth/src`. Exceção: `packages/db/src/schema/index.ts` (intencional, marcado `// biome-ignore`).
- **`.forEach()` em hot path** — preferir `for...of`.
- **`new RegExp(...)` / regex literal dentro de loops** — extrair top-level.
- **`target="_blank"` sem `rel="noopener"`**.
- **HTML não-sanitizado em React** — markdown/HTML de fonte não confiável passa por `react-markdown` + `rehype-sanitize` (`defaultSchema`).
- **Importar `@emach/db/schema/auth` ou `@emach/auth/dashboard`** deste app (P0 — quebra isolamento staff × cliente).

Linting zero-config via **Ultracite** (preset Biome). A skill `ultracite` tem o detalhamento das regras — invocar antes de discussões sobre patterns.

---

## 12. Workflow de Mudança

1. **Antes de tocar UI:** abrir `DESIGN.md`; skill `web-design-guidelines` para review.
2. **Antes de tocar schema:**
   - Tabela owned-by-ecommerce (`client*`): editar `schema/client.ts` → dev `bun db:push` → `db:apply-triggers` → smoke.
   - Tabela owned-by-dashboard ou compartilhada: **PR no dashboard primeiro**, depois sincronizar a cópia aqui. Em prod sempre `db:generate` + commit migration + `db:migrate`.
3. **Escrita em tabelas dashboard-owned:** usar `actorType='apiKey'` + `apiKeyId` em `stockMovement` e similares (nunca `actorType='user'` — `user` é staff).
4. **Imagens em forms:** ao integrar uploads, extrair helper genérico `lib/storage.ts` (`{ bucket, prefix, formData }`). Service role key em `SUPABASE_SERVICE_ROLE_KEY` (server-only).
5. **Validação:** `bun check-types` no workspace alterado, `bun fix` no escopo. Suite inteira só se necessário.
6. **Smoke run-time:** refactor que toca SSR → rodar `bun dev:web` e visitar as rotas afetadas (`tsc` não pega SQL inválido nem coluna removida).
7. **Commit:** Conventional Commits em **PT** (`feat:`/`fix:`/`refactor:`/`test:`/`docs:`/`chore:`). **Nunca** commitar sem confirmação explícita do user.

---

## 13. MCP Servers

| Servidor | Onde | Para quê |
|---|---|---|
| `supabase` | `.mcp.json` | DDL/migrations, `execute_sql`, `list_tables`, `get_advisors` |
| `context7` | `.mcp.json` | Docs ao vivo de libs/SDKs |
| `shadcn` | `.mcp.json` | Adicionar/buscar componentes shadcn |
| `next-devtools` | `.mcp.json` | Helpers Next.js 16 (`nextjs_call <port> get_errors` p/ stack trace SSR) |
| `better-auth` | `.mcp.json` (HTTP) | Docs Better Auth |
| `better-t-stack` | `.mcp.json` | Scaffolding (projeto já criado — uso recorrente baixo) |
| `resend` | `~/.claude.json` (**local**) | Envio transacional + domínios — API key é segredo, não vai pro repo |

**Resend é `local`** porque `.mcp.json` é versionado e `RESEND_API_KEY` é segredo. Outros devs re-adicionam:
```bash
claude mcp add -s local resend -- npx -y resend-mcp -e RESEND_API_KEY=<key>
```

---

## 14. Onde se Aprofundar

- **Convenções de schema Drizzle:** `packages/db/CLAUDE.md`
- **Design system completo:** `DESIGN.md`
- **Pointer para agentes externos** (Codex, Cursor, etc.): `AGENTS.md`
- **Schema do dashboard** (fonte de verdade das tabelas compartilhadas): repo irmão `emach-dashboard`.
