# emach-ecommerce

> Log de mistakes recorrentes e decisões não-óbvias. Código vence em conflito.
> Storefront BR de ferramentas (furadeiras, serras, EPIs). Compartilha DB Supabase com `emach-dashboard` (repo irmão, admin staff).

## Auth — invariantes P0 (qualquer violação é bug crítico)

Duas instâncias **completamente isoladas** Better Auth no mesmo banco. Este app usa só a `ecommerce` (clientes BR via email/senha + Google OAuth).

1. `apps/web` deste repo **nunca** importa `@emach/db/schema/auth` nem `@emach/auth/dashboard`. Dashboard **nunca** importa `@emach/db/schema/client` nem `@emach/auth/ecommerce`.
2. `EcommerceSession` ≠ `DashboardSession` — não existe tipo "Session" genérico.
3. **Nunca** setar `advanced.cookies.<name>.attributes.domain = ".emach.com.br"`. Subdomínios distintos isolam por host.
4. CPF/CNPJ: validação no app (zod refine + dígito verificador em `apps/web/src/lib/validators/cpf-cnpj.ts`). Sempre normalizar (só dígitos) antes de persistir em `client.document`.

## Ownership e schema sync (ADR-0009, no `emach-dashboard`)

Schema TS aqui é **cópia versionada** do dashboard, sincronizada via **CI PR automático**.

- **Owned-by-dashboard (autoritativo, mudanças começam lá):** `tool`, `toolVariant`, `category`, `supplier`, `branch`, `stockLevel`, `userBranch`, `promotion`, `attribute*`, schema `auth`.
- **Owned-by-ecommerce (autoritativo aqui):** tabelas `client*` (7 — `client`, `clientSession`, `clientAccount`, `clientVerification`, `clientAddress` + LGPD `clientAuditLog`, `clientExportLog`).
- **Escrita compartilhada:** `order`, `orderItem`, `stockMovement`, `review`, `consentLog`, `toolAttributeValue`.
- **Sync:** workflow `sync-db-schema.yml` no dashboard abre PR aqui quando `packages/db/src/{schema,queries,sql/triggers.sql}` muda na `main` do dashboard. **Não editar `schema/*.ts` em isolamento aqui.**
- **`db:generate` / `db:migrate` são legacy** — scripts ainda no `package.json` mas não usar. A pasta `migrations/` foi removida.
- **Escritas em tabelas dashboard-owned:** `actorType='system'` em `stockMovement` e similares (nunca `'user'` — `user` é staff). Enum atual: `pgEnum('actor_type', ['user','system'])`.

## Anti-patterns banidos (P0/P1)

- `console.log/warn/error` em produção. Usar `log` do evlog (`import { log } from "@/lib/evlog"`). Em catch de server action: **sempre** `log.error({ action, ...context })` antes de retornar `{ ok: false }` — silenciar sem log é P0.
- `: any`, `as any`, `@ts-ignore`, `@ts-expect-error` (exceto `.next/` gerado).
- `key={index}` em `.map()` — IDs estáveis. Exceções com `biome-ignore` documentado.
- `<img>` puro — sempre `next/image` (exceto thumbs Supabase com `// biome-ignore lint/performance/noImgElement`).
- `React.forwardRef` — React 19 usa `ref` como prop normal.
- `useMemo`/`useCallback` manuais — React Compiler ativo.
- `async function` em Client Component — usar Server Component pra fetching.
- Barrel files em `packages/ui/src`, `apps/web/src`, `packages/auth/src`. Exceção: `packages/db/src/schema/index.ts` (intencional).
- `.forEach()` em hot path — `for...of`.
- `new RegExp(...)` em loops — extrair top-level.
- `target="_blank"` sem `rel="noopener"`.
- HTML não-sanitizado em React — passar por `react-markdown` + `rehype-sanitize` (`defaultSchema`).
- Importar `@emach/db/schema/auth` ou `@emach/auth/dashboard` (P0 — quebra isolamento).

## Server actions

- `"use server"` no topo, guarda de sessão no início, input validado com Zod, normalizar antes de persistir.
- Retorno: `ActionResult<T>` = `{ ok: true; data } | { ok: false; error }`.
- Catch: `log.error({ action, ...context })` + `{ ok: false, error: "mensagem" }`. Sem `console`.

## Gotchas

- **`createDb()` × `db` singleton:** `@emach/auth/*` usa `createDb()` pra evitar ciclo com `@emach/env`; resto usa `db`. Não consolidar.
- **`apps/web` nunca importa `@emach/db` diretamente em rota autenticada** — acesso é mediado por `@emach/auth`.
- **shadcn é Base UI (não Radix)** — style `base-lyra`. Primitivo `@base-ui/react`.
- **`shadcn add` não passa pelo hook lint** — rodar `bun check` após adicionar componentes.
- **`proxy.ts` (Next 16) substitui `middleware.ts`** — não criar `middleware.ts`.
- **`typedRoutes: true`** — `<Link href>` valida em tsc.
- **Resend em produção:** `EMAIL_FROM` usa domínio verificado (`nao-responder@emachferramentas.com.br`). SPF/DKIM/DMARC verificados no Resend; monitorar bounce/deliverability.
- **Origem do frete = `env.DEFAULT_BRANCH_ID`** → `lib/origin-branch.ts > getOriginBranchCep()` faz lookup de `branch.cep` (usado em `superfrete/quote.ts`). (Não existe `default-branch.ts`/`getDefaultBranchId()`.) DEFAULT_BRANCH_ID hoje serve de **fallback** da origem do frete — estoque é validado em **agregado** (`SUM` em todas as filiais), não fixado nela (ADR-0003). `superfrete/quote.ts` **já consome `getShippingSettings`** (singleton `storeSettings`, sincronizado do dashboard #119) como fonte primária — origem por filial via `branch.cep` + política de seguro `none`|`cart_value` + cap; `getOriginBranchCep()`/`DEFAULT_BRANCH_ID` só entra quando `originCep` é null. O singleton **está populado** (#128 fechado: origem por filial, seguro `cart_value`, cap). Contrato também prevê `tool.overweightShippingAmount` (frete fixo p/ item >30kg; null = "a combinar").
- **Estoque: storefront só valida, não debita (ADR-0003).** `placeOrder` (`checkout/_lib/place-order.ts`) roda `checkAggregateStock` (SUM de todas as filiais) e cria o pedido em `pending_payment` — **sem** escrever `stockMovement`. O débito (`saida_venda`, `actorType='system'`) virá na transição `pending_payment → paid`, junto da integração de pagamento (hoje stub). Doc que disser "débito na criação" é ADR-0001 legado (já superseded).
- **Auth multi-porta em dev:** `baseURL`/`trustedOrigins` do auth ecommerce são dinâmicos em dev (`allowedHosts: ['localhost:*']` + client same-origin) — roda em qualquer porta sem editar `.env`. Em prod, fixos no domínio. **Login Google** ainda exige cada porta local nas *Authorized redirect URIs* do OAuth (Google não tem wildcard de porta). Ver `packages/auth/src/ecommerce.ts`, `apps/web/src/lib/auth-client.ts`.
- **`order.discountAmount` = só cupom/promocode.** Desconto automático de promoção (auto-promo) já está embutido no preço da variante — **não** soma em `discountAmount` (senão conta dobrado na margem). Ver `lib/auto-promo.ts` (server-only) e comentários em `schema/orders.ts`.
- **IDs:** `crypto.randomUUID()` no caller — sem nanoid.
- **Card de produto é dark + selos de voltagem (PR #70).** `ProductCard` (#181818; `surface="elevated"` #242424 em promoções) é flat (sem box-shadow), com quick-add vermelho no hover (`quick-add-button.tsx`, client + `useCart`). Os selos de voltagem na imagem listam **todas** as variantes — agregadas por `lib/variant-voltages.ts` (helper storefront). **Variante hoje = só voltagem** (`tool_variant.voltage`); cor é *atributo* descritivo, não variante. Pra trazer voltagens ao card **não editar `catalog.ts`/`ToolListItem`** (dashboard-owned) — usar o helper + prop `voltagesByTool`. `CategoryTile` é dark spotlight (`.emach-bg-tile-spot`) com auto-cycle no `category-grid.tsx`. Sistema visual completo em `DESIGN.md` §10.
- **Pós-merge de PR sync ou `bun db:push` em dev local:** rodar `bun db:apply-triggers` (triggers em `sql/triggers.sql`, owned-by-dashboard).
- **Dev server pega `.env` stale:** editar `apps/web/.env` mid-sessão (ex.: `SUPERFRETE_BASE_URL` sandbox↔prod) e reiniciar `next dev` **não** reflete — Next dá precedência a `process.env` (que o shell/mise carregou no boot) sobre o arquivo. Relançar shell novo, ou `set -a && . apps/web/.env && set +a && next dev`. Conferir: `tr '\0' '\n' < /proc/$PID/environ | grep VAR`.

## Smoke run-time

`bun check-types` não detecta SQL inválido em template strings nem queries com colunas removidas. Após mexer em schema/queries SSR: `bun dev:web` + visitar rotas afetadas. Stack trace via `nextjs_call <port> get_errors` (MCP `next-devtools`).

## Lacunas conhecidas

- **Pagamento real ausente — pendente (roadmap #4, keystone):** `/dashboard/pedidos/[id]/pagar` é stub (Asaas Pix/Boleto/Cartão); `order.status` carrega o estado de pagamento. Sem a transição `pending_payment → paid` não roda **nem o débito de estoque** (ADR-0003) **nem o ciclo de vida pós-pago**. Praticamente todo o resto do roadmap depende disto.
- **Hardening — pendente (roadmap #5, após o pagamento):**
  - **Frete fail-open:** queda da API SuperFrete não bloqueia a venda (só `log.error` em `place-order.ts > assertShippingQuoted`) → frete adulterável. Endurecer (persistir `shippingUnverified` p/ revisão) exige **coluna nova no schema** — nasce no dashboard (ADR-0009).
  - Rate limit em endpoints auth (sem proteção brute-force em `signin`/`signup`/`reset`).
  - evlog sem drain externo (Axiom/Datadog/Sentry) — output só em console.
- Sem Docker config. CI mínimo: `.github/workflows/ci.yml` roda só `check-types` em PR/push na `main` (sem testes nem deploy).

## Design — Ferrari-inspired (resumo)

Detalhe completo em `DESIGN.md`. **Vermelho é verbo, não decoração** — Ferrari Red (`#DA291C`) só em CTA de alta prioridade, UMA vez por tela. **Cantos retos = precisão** (`border-radius: 0` em interativos; modais ≤8px, avatares 50%). Tipografia: **Barlow** (corpo) + **Barlow Condensed** (labels uppercase + tracking) — não misturar no mesmo bloco. Preços sempre `R$ 899,00`.

**Superfície clara = UM tom só: `--gray-10` (#f4f4f4).** É `--background` e `--card`; vale pra body, páginas e cards de conteúdo. **Nunca** usar `bg-white`/`#fff`/`#fafafa` como fundo de página ou card — card se separa do fundo por **borda hairline**, não por cor. `#fff` só em controles/realces que flutuam (inputs, popovers/overlay, toast, badges, avatar, botões com fill branco). Fundo de imagem = `--image-bg` (#ececec), mantido. Cores de status (ex. `#FFF5F5` rejeição) não contam como branco. Definido em `packages/ui/src/styles/globals.css`.

## MCP — Resend vem do plugin oficial

O plugin oficial `resend` (em `~/.claude/plugins`) traz **as skills E o MCP** (`plugin:resend:resend`, ~80 tools). **Não** rodar `claude mcp add resend` — criaria um 2º MCP duplicando as tools.

O `.mcp.json` do plugin usa `RESEND_API_KEY: "${RESEND_API_KEY}"`. **Gotcha (v2.1.159):** essa interpolação é resolvida contra o `process.env` do processo **principal** do Claude — que **NÃO** recebe o bloco `env` do `settings.json`/`settings.local.json` (esse env só é injetado nos subprocessos spawned, tipo Bash). Logo, pôr a key no `settings.local.json` **não** alimenta o MCP (conecta mas dá `API key is invalid`). Só o env do **OS que lança o `claude`** alimenta a interpolação.

Solução adotada — `mise.toml` na raiz carrega o `apps/web/.env` no shell (mise já é `activate`-ado), então o `claude` lançado no projeto herda a key:

```toml
# mise.toml (commitado; sem segredo, só referência)
[env]
_.file = "apps/web/.env"
```

`.env` continua fonte única. Após mexer: `mise trust` + relançar o `claude` (a interpolação só re-resolve no boot). As 5 skills (`resend:resend`, `react-email`, `email-best-practices`, `resend-cli`, `agent-email-inbox`) funcionam sem key.

## Onde estão os outros mistakes-logs

| Tópico | Arquivo |
|---|---|
| Schema sync, triggers, ownership detalhado, gotchas DB | `packages/db/CLAUDE.md` |
| Sistema visual completo | `DESIGN.md` |
| Multi-context glossário de domínio | `CONTEXT-MAP.md` |
| Skills locais, MCPs versionados | `.claude/skills/`, `.mcp.json` |

Stack / scripts / envs → `package.json`, `packages/env/src/{server,web}.ts`. Schema fonte de verdade → repo irmão `emach-dashboard`.
