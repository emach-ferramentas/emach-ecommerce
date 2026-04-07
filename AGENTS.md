# emach — Guia do Projeto para Agentes

> Este arquivo é o mapa completo do projeto. Leia antes de qualquer tarefa.
> **Responda sempre em Português.** Termos técnicos e identificadores de código ficam em English.

---

## 1. Visão Geral

**emach** é um e-commerce em construção. Scaffoldado com [Better-T-Stack](https://better-t-stack.dev/).

| | |
|---|---|
| **Package manager** | Bun 1.3.11 |
| **Orquestração** | Turborepo 2 |
| **Frontend** | Next.js 16 + React 19 (App Router) |
| **Banco de dados** | PostgreSQL via Supabase |
| **ORM** | Drizzle |
| **Auth** | Better Auth |
| **UI** | shadcn (style `base-lyra`, baseado em Base UI — não Radix) |
| **CSS** | Tailwind CSS v4 |
| **Linting/Format** | Biome via Ultracite |
| **Forms** | TanStack Form + Zod |

---

## 2. Estrutura do Monorepo

```
emach-ecommerce/
├── apps/
│   └── web/                  ← App Next.js 16, porta 3001
└── packages/
    ├── config/               ← tsconfig.base.json compartilhado
    ├── env/                  ← Validação de env vars (T3 Env + Zod)
    ├── db/                   ← Drizzle ORM + schema PostgreSQL
    ├── auth/                 ← Better Auth pré-configurado
    └── ui/                   ← Biblioteca shadcn compartilhada
```

---

## 3. Packages — O que cada um faz

### `@emach/config` — TypeScript Base
- **Propósito:** Contém apenas `tsconfig.base.json` com strict mode, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.
- **Exports:** Nenhum em runtime. Só `@emach/config/tsconfig.base.json` via `extends`.
- **Quando modificar:** Quase nunca. Somente para mudar regras TS globais.

---

### `@emach/env` — Variáveis de Ambiente Tipadas
- **Propósito:** Valida env vars em build time com Zod. Se uma var estiver faltando, o build falha com mensagem clara.
- **Exports:**
  - `@emach/env/server` → `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `NODE_ENV`
  - `@emach/env/web` → vazio (placeholder para vars client-side futuras)
- **Quando modificar:** Sempre que adicionar uma nova variável de ambiente. Adicione ao schema Zod em `packages/env/src/server.ts` (server) ou `web.ts` (client).

---

### `@emach/db` — Banco de Dados
- **Propósito:** Client Drizzle + schema PostgreSQL. Toda interação com o banco passa por aqui.
- **Exports:**
  - `@emach/db` → `db` (singleton) + `createDb()`
  - `@emach/db/schema/auth` → tabelas `user`, `session`, `account`, `verification`
- **Quando modificar:** Ao criar novas tabelas de negócio (products, orders, etc.), adicione arquivos em `packages/db/src/schema/` e exporte via `packages/db/src/schema/index.ts`.
- **Dependências internas:** `@emach/env`

---

### `@emach/auth` — Autenticação
- **Propósito:** Instância Better Auth pré-configurada com Drizzle adapter, email/password e `nextCookies()` para SSR.
- **Exports:**
  - `@emach/auth` → `auth` (singleton) + `createAuth()`
- **Consumido em:**
  - `apps/web/src/app/api/auth/[...all]/route.ts` — handler catch-all da API
  - `apps/web/src/app/dashboard/page.tsx` — verificação de sessão server-side
- **Quando modificar:** Para adicionar OAuth, magic link, 2FA ou outros plugins do Better Auth.
- **Dependências internas:** `@emach/db`, `@emach/env`

---

### `@emach/ui` — Biblioteca de Componentes (shadcn)
- **Propósito:** Componentes shadcn compartilhados entre todas as apps do monorepo.
- **Style:** `base-lyra` (usa `@base-ui/react` como primitivo, **não Radix UI**). Visual compacto, cantos retos (`rounded-none`).
- **Exports subpath** (sem barrel/index — importe componentes individualmente):
  - `@emach/ui/components/<nome>` → componente
  - `@emach/ui/lib/utils` → função `cn()` (clsx + tailwind-merge)
  - `@emach/ui/globals.css` → CSS com tokens de design Tailwind v4
  - `@emach/ui/hooks/<nome>` → hooks compartilhados (diretório existe, atualmente vazio)
- **Componentes existentes:** `button`, `card`, `checkbox`, `dropdown-menu`, `input`, `label`, `skeleton`, `sonner`
- **Como adicionar componentes:**
  ```bash
  bunx shadcn@latest add <nome> -c packages/ui
  # Exemplos:
  bunx shadcn@latest add dialog -c packages/ui
  bunx shadcn@latest add table sheet -c packages/ui
  ```
- **Dependências internas:** nenhuma em runtime

---

## 4. Grafo de Dependências

```
@emach/config ──(devDep: tsconfig)──► todos os packages
      │
@emach/env ──(runtime)──► @emach/db
      │                         │
      └────────────────────────►@emach/auth
                                      │
                               apps/web (consome auth + env/web + ui)

@emach/ui ──(runtime, independente)──► apps/web
```

> **Regra:** O `apps/web` nunca importa `@emach/db` diretamente. O acesso ao banco é mediado por `@emach/auth`.

---

## 5. App Web (`apps/web`)

### Estrutura de diretórios

```
apps/web/src/
├── index.css                   ← @import "@emach/ui/globals.css" (só isso)
├── lib/
│   └── auth-client.ts          ← createAuthClient() do Better Auth (client SDK)
├── components/                 ← Componentes de negócio compartilhados entre rotas
│   ├── header.tsx
│   ├── loader.tsx
│   ├── mode-toggle.tsx
│   ├── providers.tsx
│   ├── sign-in-form.tsx
│   ├── sign-up-form.tsx
│   ├── theme-provider.tsx
│   └── user-menu.tsx
└── app/
    ├── layout.tsx              ← Root layout (fontes, Providers, Header)
    ├── page.tsx                ← Rota "/"
    ├── login/
    │   └── page.tsx            ← Rota "/login"
    ├── dashboard/
    │   ├── page.tsx            ← Server component (verifica auth, redireciona)
    │   └── dashboard.tsx       ← Client component shell (shell vazio por enquanto)
    └── api/
        └── auth/[...all]/
            └── route.ts        ← Catch-all handler do Better Auth
```

### Padrões de import

```ts
// Componentes da UI compartilhada (subpath — sem barrel)
import { Button } from "@emach/ui/components/button";
import { cn } from "@emach/ui/lib/utils";

// Código local do app
import { SomeComponent } from "@/components/some-component";
import { authClient } from "@/lib/auth-client";
```

---

## 6. Convenções de Organização de Código

### Regra das pastas com `_` prefix (private folders do Next.js)

Pastas prefixadas com `_` são **ignoradas pelo App Router** — não geram rotas. Use-as para organizar código colocado junto à rota.

**Estrutura padrão de uma rota:**

```
app/<rota>/
├── page.tsx              ← Entry point (server component por padrão)
├── layout.tsx            ← Layout específico da rota (se necessário)
├── loading.tsx           ← Suspense boundary visual (se necessário)
├── error.tsx             ← Error boundary (se necessário)
├── _components/          ← Componentes usados APENAS nesta rota
│   └── product-card.tsx
├── _hooks/               ← Hooks usados APENAS nesta rota
│   └── use-product-filter.ts
├── _actions/             ← Server actions desta rota
│   └── create-product.ts
└── _lib/                 ← Utilitários e helpers desta rota
    └── format-price.ts
```

### Tabela de decisão: onde colocar cada coisa

| O que você precisa criar | Onde colocar |
|---|---|
| Componente UI genérico/reutilizável (botão, modal, tabela) | `packages/ui/` via `bunx shadcn add -c packages/ui` |
| Componente de negócio compartilhado entre rotas | `apps/web/src/components/` |
| Componente específico de UMA rota | `apps/web/src/app/<rota>/_components/` |
| Hook compartilhado entre rotas | `apps/web/src/hooks/` |
| Hook específico de UMA rota | `apps/web/src/app/<rota>/_hooks/` |
| Server action | `apps/web/src/app/<rota>/_actions/` |
| Utilitário compartilhado | `apps/web/src/lib/` |
| Utilitário específico de UMA rota | `apps/web/src/app/<rota>/_lib/` |
| Nova página/rota | `apps/web/src/app/<rota>/page.tsx` |
| Layout entre rotas (route group) | `apps/web/src/app/(<grupo>)/layout.tsx` |
| API route | `apps/web/src/app/api/<rota>/route.ts` |
| Nova tabela no banco | `packages/db/src/schema/<nome>.ts` |
| Nova variável de ambiente server | `packages/env/src/server.ts` |
| Nova variável de ambiente client | `packages/env/src/web.ts` |
| Novo método/plugin de auth | `packages/auth/src/index.ts` |
| Middleware global (auth guard, etc.) | `apps/web/src/middleware.ts` |

### Pergunta rápida para decidir onde colocar

1. **Será usado por múltiplas apps?** → `packages/`
2. **Será usado por múltiplas rotas na mesma app?** → `apps/web/src/components/`, `hooks/` ou `lib/`
3. **Só é usado numa rota específica?** → Na pasta da rota com prefix `_`

---

## 7. Comandos Essenciais

### Desenvolvimento

```bash
bun run dev          # Inicia todas as apps e packages
bun run dev:web      # Inicia só o apps/web (porta 3001)
bun run build        # Build de produção (via Turbo)
bun run check-types  # Verifica TypeScript em todo o monorepo
```

### Banco de dados

```bash
bun run db:push      # Sincroniza schema com o banco (sem migration)
bun run db:generate  # Gera arquivos de migration
bun run db:migrate   # Aplica migrations pendentes
bun run db:studio    # Abre Drizzle Studio (UI visual do banco)
```

### Qualidade de código

```bash
bun run check        # Verifica linting/formatting (Ultracite/Biome)
bun run fix          # Corrige automaticamente os problemas
# Ou diretamente:
bun x ultracite fix
bun x ultracite check
bun x ultracite doctor
```

### shadcn

```bash
bunx shadcn@latest add <nome> -c packages/ui          # Adiciona componente
bunx shadcn@latest add <a> <b> <c> -c packages/ui     # Múltiplos de uma vez
bunx shadcn@latest diff -c packages/ui                 # Ver atualizações disponíveis
```

---

## 8. Environment Variables

Todas as vars são definidas em `apps/web/.env` (gitignored) e validadas em build time pelo `@emach/env`.

| Variável | Tipo | Onde é validada |
|---|---|---|
| `DATABASE_URL` | string (min 1) | `@emach/env/server` |
| `BETTER_AUTH_SECRET` | string (min 32) | `@emach/env/server` |
| `BETTER_AUTH_URL` | URL válida | `@emach/env/server` |
| `CORS_ORIGIN` | URL válida | `@emach/env/server` |
| `NODE_ENV` | `development\|production\|test` | `@emach/env/server` |

**Para adicionar nova env var:**
1. Adicione ao schema Zod em `packages/env/src/server.ts` (server) ou `packages/env/src/web.ts` (client)
2. Adicione ao `apps/web/.env`

---

## 9. O que ainda não existe (contexto de desenvolvimento)

- **`apps/web/src/middleware.ts`** — Sem middleware global. Auth é verificada inline nos server components.
- **`apps/web/src/hooks/`** — Diretório não criado ainda.
- **`loading.tsx`, `error.tsx`, `not-found.tsx`** — Nenhuma rota tem esses arquivos.
- **Route groups** (`(shop)`, `(auth)`, etc.) — Não utilizados ainda.
- **Schemas de ecommerce** — Apenas tabelas de auth existem. Faltam `products`, `orders`, `categories`, etc.
- **CI/CD e Docker** — Nenhuma configuração de deploy existe.

---

## 10. Design System — Ferrari-Inspired

O projeto segue uma linguagem visual inspirada no site Ferrari. Referência completa em `design/DESIGN.md`.

### Paleta de Cores

| Token | Light (padrão) | Dark (`.dark`) | Papel |
|-------|----------------|----------------|-------|
| `--primary` | `#DA291C` Ferrari Red | `#DA291C` | CTAs de alta prioridade. Usar com **parcimônia**. |
| `--secondary` | `#FFFFFF` branco | `#181818` | Botão padrão (Configure, etc.) |
| `--background` | `#FFFFFF` | `#181818` Near Black | Superfície base |
| `--foreground` | `#181818` | `#FFFFFF` | Texto principal |
| `--muted` | `#D2D2D2` | `#303030` | Superfícies sutis, dividers |
| `--muted-foreground` | `#666666` | `#8F8F8F` | Texto secundário |
| `--destructive` | `#F13A2C` | `#F13A2C` | Warning (distinto do brand red) |
| `--border` | `#CCCCCC` | `rgba(255,255,255,0.1)` | Bordas |
| `--ring` | `#DA291C` | `#DA291C` | Focus ring (Ferrari Red) |

### Tipografia

- **Barlow** (`--font-sans`): Headings, botões, nav, body text. Pesos 400–700.
- **Barlow Condensed** (`--font-display`): Labels, captions, tags. Sempre **uppercase** com `letter-spacing: 1px`.

```tsx
// Usar --font-display via Tailwind (quando o token estiver em uso):
<span className="font-display uppercase tracking-wider text-xs">Label</span>
```

### Chiaroscuro — Seções Alternadas

Não há toggle de dark mode global. Seções individuais alternam entre light e dark adicionando `className="dark"`:

```tsx
<section>
  {/* conteúdo editorial — branco (#FFFFFF) */}
</section>
<section className="dark">
  {/* conteúdo cinemático — Near Black (#181818) */}
</section>
```

O `@custom-variant dark (&:is(.dark *))` no Tailwind CSS v4 garante que `dark:bg-*`, `dark:text-*` etc. funcionam dentro de qualquer ancestral com `class="dark"`.

### Do's
- Ferrari Red (`--primary`) apenas em CTAs de alta prioridade — sua força vem da parcimônia
- `rounded-none` em todos os componentes — "razor precision"
- Barlow Condensed apenas para labels/tags em uppercase
- Cada seção da página deve ser uma "vinheta" com um foco claro

### Don'ts
- Não espalhe Ferrari Red como decoração — é sinal de CTA, não cor de tema
- Não use border-radius arredondados (exceto modais: até 8px)
- Não adicione box-shadows em cards — profundidade vem do contraste de superfícies
- Não misture Barlow e Barlow Condensed no mesmo bloco de texto

---

## 11. Ultracite Code Standards

Este projeto usa **Ultracite**, um preset zero-config que aplica formatação e linting rigorosos via Biome.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- **Avoid barrel files** (index files that re-export everything) — use subpath imports
- Use proper image components (Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components
- `"use client"` only quando realmente necessário (eventos, hooks, estado local)

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`
- React Compiler está ativo (`reactCompiler: true`) — não adicione `useMemo`/`useCallback` manual desnecessário

**Typed Routes:**

- `typedRoutes: true` está ativo — TypeScript valida os paths de `<Link href="...">`. Se o link não compilar, a rota não existe.

---

### Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

### When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations

---

Run `bun x ultracite fix` before committing to ensure compliance.
