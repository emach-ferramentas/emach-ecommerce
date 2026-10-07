# emach-ecommerce

E-commerce de ferramentas elétricas e manuais (furadeiras, serras, chaves, alicates, EPIs) para o mercado brasileiro. Repo storefront — admin staff vive no repo irmão [`emach-dashboard`](https://github.com/othavi0/emach-dashboard) que compartilha a mesma DB Supabase.

## Stack

| | |
|---|---|
| **Frontend** | Next.js 16 + React 19 (App Router, RSC, typed routes, React Compiler) |
| **Banco** | PostgreSQL via Supabase (compartilhado com dashboard) |
| **ORM** | Drizzle 0.45 + node-postgres |
| **Auth** | Better Auth — instância `ecommerce` (cliente BR, tabelas `client*`) |
| **UI** | shadcn `base-lyra` (Base UI, não Radix) + Tailwind CSS v4 |
| **Forms** | TanStack Form + Zod |
| **Lint/Format** | Biome via Ultracite |
| **Logging** | evlog (instrumentation + request middleware + server actions) |
| **Email** | Resend + React Email |
| **Monorepo** | Turborepo 2 + Bun 1.3 |
| **Design** | H3 "Prateleira por ofício": Archivo variável, papel e canteiro, grafite, vermelho `#da291c` só no CTA de compra |

## Estrutura

```
emach-ecommerce/
├── apps/
│   └── web/                 Next.js storefront (porta 3001)
└── packages/
    ├── config/              tsconfig base
    ├── env/                 env vars tipadas (T3 Env + Zod)
    ├── db/                  Drizzle schema espelhado do dashboard + queries + triggers/RLS SQL + seeds
    ├── auth/                Better Auth (instâncias dashboard + ecommerce isoladas)
    ├── email/               Resend client + templates React Email
    ├── redis/               client Upstash Redis (rate limit + cache de cotação de frete)
    ├── ui/                  shadcn `base-lyra` compartilhado
    └── validators/          validação de CPF/CNPJ (`@emach/validators`)
```

## Setup

> O `.env.example` traz só um placeholder, mas o `DATABASE_URL` do `.env` real é o Supabase compartilhado com o dashboard (dev = prod). Os comandos de banco abaixo escrevem nele: rodar só com autorização explícita, ou apontar o `.env` para um Postgres local.

```bash
bun install
cp apps/web/.env.example apps/web/.env  # schema das envs em packages/env/src/schemas.ts
bun run db:push                          # sync schema → DB (dev local)
bun --cwd packages/db db:apply-triggers  # triggers PL/pgSQL (Drizzle Kit não gera)
bun --cwd packages/db db:seed-categories
bun --cwd packages/db db:seed-attributes
bun run dev:web                          # http://localhost:3001
```

## Comandos

### Desenvolvimento
```bash
bun run dev               # tudo via Turbo
bun run dev:web           # só apps/web
bun run build             # build prod
bun run check-types       # tsc em todos workspaces
bun run check             # Ultracite/Biome lint
bun run fix               # auto-fix
```

### Banco de dados
```bash
bun run db:push           # dev: sync schema (sem migration)
# db:generate / db:migrate — LEGACY, NÃO USAR. Workflow é push-only; pasta migrations/ removida (ver CLAUDE.md / ADR-0006 no dashboard).
bun run db:studio         # Drizzle Studio
bun --cwd packages/db db:apply-triggers       # idempotente, sempre após push
bun --cwd packages/db db:seed-categories      # 5 raízes
bun --cwd packages/db db:seed-attributes      # specs iniciais
bun --cwd packages/db db:check-drift          # verifica drift schema Drizzle × DB
bun --cwd packages/db db:anonymize-client <id># LGPD direito ao esquecimento
```

### shadcn
```bash
bunx shadcn@latest add <nome> -c packages/ui
bunx shadcn@latest diff -c packages/ui
```

## Documentação para agentes

- **`CLAUDE.md`** — log de mistakes e decisões não óbvias: guardrails de banco, ownership de tabelas, invariantes P0 de auth, anti-patterns, gotchas, deploy e CI, MCP do Resend. Servidores MCP do projeto: `.mcp.json`.
- **`AGENTS.md`** — pointer pra agentes externos (Codex, Amp, Cursor).
- **`docs/agents/*.md`** — config das skills de engenharia (issue tracker, triage labels, domain docs).
- **`DESIGN.md`**: sistema visual H3 (tokens, tipografia, regras, primitivos e exceções).
- **`packages/db/CLAUDE.md`** — convenções de schema Drizzle (FKs, enums, money, triggers, queries compartilhadas).
- **`CONTEXT-MAP.md`** e **`docs/contexts/<slug>/CONTEXT.md`** — glossário e fronteiras dos 8 bounded contexts.
- **`docs/adr/`** — decisões de sistema (0001 débito de estoque, superseded; 0002 ownership de migrations; 0003 estoque multi-filial; 0004 deploy e gates de CI).
- **`PRODUCT.md`** — contexto de produto. **`docs/superpowers/{specs,plans}`** — specs e planos por feature.

## Invariantes críticos

1. **Auth isolada por host:** ecommerce usa `authEcommerce` (tabelas `client*`). NUNCA importar `authDashboard` ou schema `auth` aqui — quebra isolamento P0 staff × cliente.
2. **DB compartilhada com dashboard:** mudanças em tabelas owned-by-dashboard (`tool`, `category`, `promotion`, etc) começam no repo dashboard via PR. O schema chega aqui por PR automático aberto pelo workflow `sync-db-schema.yml` do dashboard.
3. **Commits:** Conventional Commits em **PT** (`feat:`/`fix:`/`refactor:`/`chore:`). Confirmação explícita do user antes de qualquer `git commit`/`push`.
4. **Money:** `numeric(10,2)` em preços/custos variant, `numeric(12,2)` em totais order. Nunca `real`/`double`.
5. **IDs:** `crypto.randomUUID()` no caller (server actions/scripts). Sem nanoid.
