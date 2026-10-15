# emach-ecommerce

> Log de mistakes recorrentes e decisões não-óbvias. Código vence em conflito.
> Storefront BR de ferramentas (furadeiras, serras, EPIs). Compartilha DB Supabase com `emach-dashboard` (repo irmão, admin staff).

## ⛔ Guardrails duros (incidentes 2026-06/07)

- **Banco único dev=prod compartilhado.** A regra de escrita é a do dashboard, seção [Banco compartilhado: regra de escrita dos dois apps](https://github.com/othavi0/emach-dashboard/blob/main/CLAUDE.md#banco-compartilhado-regra-de-escrita-dos-dois-apps). Em resumo, comando que muda schema, apaga em massa ou não tem volta (`db:apply-triggers`, `db:seed-*`, `db:anonymize-client`, drop e recreate) pede autorização do user na sessão, e write pontual de poucas linhas para smoke é liberado e revertido ao terminar. Subagente que toca banco recebe essa regra colada no prompt.
- **Nunca editar, commitar, abrir issue ou PR no `emach-dashboard` a partir daqui** (ADR-0009 do dashboard): mudança de schema ou de contrato começa lá, e aqui só se consome o PR de sync automático. Ler o dashboard para consultar a fonte (workflow de sync, contrato, regra do banco) é permitido.
- CWD é a RAIZ do monorepo (turbo/bun) — nunca `cd apps/web`; paths absolutos.

## Auth — invariantes P0 (qualquer violação é bug crítico)

Duas instâncias **completamente isoladas** Better Auth no mesmo banco. Este app usa só a `ecommerce` (clientes BR via email/senha + Google OAuth).

1. `apps/web` e `packages/auth` deste repo **nunca** importam `@emach/db/schema/auth` (Biome barra nos dois). `@emach/auth/dashboard` não existe neste repo: a sessão de staff é só do dashboard. Dashboard **nunca** importa `@emach/auth/ecommerce`.
2. A sessão da loja é `EcommerceSession`; o tipo de sessão do staff só existe no dashboard. Não existe tipo "Session" genérico.
3. **Nunca** setar `advanced.cookies.<name>.attributes.domain = ".emach.com.br"`. Subdomínios distintos isolam por host.
4. CPF/CNPJ e telefone: o Zod do formulário é só UX. A validação que vale roda no servidor: os `databaseHooks` de `packages/auth/src/ecommerce.ts` chamam `normalizeUserForWrite` (`packages/auth/src/normalize-user.ts`), que usa `isValidCpfCnpj`, `isValidPhone`, `normalizeDocument` e `onlyDigits` de `@emach/validators` (arquivo `packages/validators/src/cpf-cnpj.ts`). O documento é gravado sem pontuação: CPF só com dígitos, CNPJ alfanumérico em maiúsculas (#244). O telefone fica só com dígitos. Campo vazio vira `NULL` (nunca `""`), senão o unique `client_document_unique` colide no segundo cliente.

## Ownership e schema sync (ADR-0009, no `emach-dashboard`)

- Os caminhos de `packages/db/src` listados em `packages/db/CLAUDE.md` são **cópia** do dashboard, sincronizada por PR automático. **Não editar aqui**: a mudança começa lá. O job `sync-guard` do CI (`scripts/check-sync-paths.ts`) barra PR fora da branch `chore/sync-db-schema` que toque `schema/`, `queries/`, `utils.ts`, `sql/triggers.sql` ou `sql/rls.sql` de `packages/db/src/`. Dono de cada tabela: a tabela de ownership de `docs/integration/admin-ecommerce.md`, cópia sincronizada do contrato do dashboard. Triggers e passos pós-sync: `packages/db/CLAUDE.md`.
- A loja é dona das linhas das tabelas `client*`: só ela escreve nelas. O arquivo de schema dessas tabelas nasce no dashboard, como todo o `packages/db/src/schema/`. Escrita da loja em tabela do dashboard (`stockMovement` e similares) usa `actorType='system'`, nunca `'user'` (que é staff).

## Anti-patterns banidos (P0/P1)

O Biome barra a maior parte desta lista: `console` (liberado só em `scripts/` e `packages/db/scripts/`), `any`, `@ts-ignore`, `key={index}`, `<img>`, `async` em client component, barrel, `.forEach`, regex literal dentro de função, `target="_blank"` sem `rel`, `dangerouslySetInnerHTML` e, pelo `noRestrictedImports` do `biome.json`, o import de `forwardRef`, `useMemo`, `useCallback` e dos dois módulos P0 de auth. O oxlint fecha o resto: `React.useMemo`, `React.useCallback` e `React.forwardRef` pelo namespace (`no-restricted-properties`), `@ts-expect-error` fora de teste e sem descrição (`ban-ts-comment`), e duas regras próprias em `tools/oxlint/emach/` (fora do lint, como o anti-slop vendorizado; testes com `bun run test:lint-rules`, que exige Node porque o RuleTester não roda no Bun): `no-regexp-in-loop` e `require-log-in-action-catch` (em arquivo `"use server"`, todo catch chama `log.error` antes de qualquer `return`, ou relança). O `noReactForwardRef` do preset React não dispara neste repo, nem ligado à mão (testado; causa provável: o `"react": "catalog:"` esconde a versão do Biome), por isso o `forwardRef` é barrado pelo import.

Fora do lint, ficam em prosa:

- `console` em produção: usar `log` do evlog (`import { log } from "@/lib/evlog"`). Única exceção: `lib/composition/legacy-composition.ts` (`console.error` de composition inválida), porque roda em client component e o evlog é server-only.
- Barrel: as exceções são `packages/db/src/schema/index.ts` (intencional) e o re-export de `STOREFRONT_TOOL_STATUSES` em `packages/db/src/queries/tools.ts` (owned-by-dashboard, vem por sync).
- HTML vindo de markdown passa por `react-markdown` + `rehype-sanitize` (`defaultSchema`).

## Server actions

- `"use server"` no topo, input validado com Zod, normalizar antes de persistir. Action que mexe em dado do cliente chama `requireCurrentClient()` no topo. As quatro públicas (`search`, `lookup-cep`, `track-cart-event` e `quick-view` em `lib/actions/`) não exigem sessão e por isso limitam por IP com `lib/rate-limit.ts`; action pública nova segue o mesmo padrão. `lib/actions/server-actions.guard.test.ts` trava isso: todo export async de arquivo `"use server"` chama `requireCurrentClient()` ou um limiter.
- Retorno: `ActionResult` (sem payload) ou `ActionResultWith<T>` (`{ ok: true; data: T } | { ok: false; error: string }`), ambos em `lib/actions/types.ts`.
- Catch: `log.error({ action, ...context })` + `{ ok: false, error: "mensagem" }`. Sem `console`.

## Gotchas

- **`createDb()` × `db` singleton:** `@emach/auth/*` usa `createDb()` pra evitar ciclo com `@emach/env`; resto usa `db`. Não consolidar.
- **Rota autenticada lê e escreve pelo `@emach/db` normalmente** (`lib/orders/queries.ts`, `place-order.ts`, `_actions/*`); o `@emach/auth/ecommerce` só entrega a sessão (`requireCurrentClient`). O que nunca entra em `apps/web` nem em `packages/auth` é `@emach/db/schema/auth`, e `@emach/auth/dashboard` não existe neste repo (invariante P0 acima).
- **shadcn é Base UI (não Radix)** — style `base-lyra`. Primitivo `@base-ui/react`.
- **`shadcn add` não passa pelo hook lint** — rodar `bun check` após adicionar componentes.
- **`proxy.ts` (Next 16) substitui `middleware.ts`** — não criar `middleware.ts`.
- **Guarda de rota = 2 camadas, ambas obrigatórias (#98).** `proxy.ts` só checa a **existência** do cookie `ecommerce.session_token` (ou `__Secure-ecommerce.session_token` sob HTTPS) para os prefixos do array `PROTECTED` e para o `/checkout`, que entra por condição própria no `proxy.ts` (fora o `/checkout/success`, confirmação pública); quem **valida** a sessão é um Server Component async sob `<Suspense>` que chama `requireCurrentClient()`. Com `cacheComponents`, a chamada solta no `layout.tsx` fora de Suspense quebra o build. Área autenticada nova precisa das duas camadas. Server **actions** não herdam a guarda do render: `requireCurrentClient()` no topo de cada uma. Travado por `app/dashboard/layout.guard.test.ts` e `lib/session.test.ts`.
- **`safeRedirect`** (`lib/safe-redirect.ts`) resolve `.`, `..` e barras repetidas e recusa rota de auth como destino, senão o cliente logado fica preso no `/login`. Link para o login usa `loginHref(pathname)`, que só leva `redirect` quando o login vai aceitar.
- **`typedRoutes: true`** — `<Link href>` valida em tsc.
- **Resend em produção:** `EMAIL_FROM` usa domínio verificado (`nao-responder@emachferramentas.com.br`). SPF/DKIM/DMARC verificados no Resend; monitorar bounce/deliverability.
- **Frete = Frenet** via o adapter `lib/shipping/quote.ts` (contrato `{negotiate, options}`), com fail-open: Frenet fora ou em timeout cria o pedido com `shippingUnverified` para revisão do staff. Cache, anti-fraude, origem, seguro e as pegadinhas da API estão em `apps/web/src/lib/frenet/CLAUDE.md`.
- **Estoque: storefront só valida, não debita (ADR-0003).** `placeOrder` (`checkout/_lib/place-order.ts`) roda `checkAggregateStock` (SUM de todas as filiais) e cria o pedido em `pending_payment` — **sem** escrever `stockMovement`. O débito (`saida_venda`, `actorType='system'`) virá na transição `pending_payment → paid`, junto da integração de pagamento (hoje stub).
- **Auth multi-porta em dev:** `baseURL`/`trustedOrigins` do auth ecommerce são dinâmicos em dev (`allowedHosts: ['localhost:*']` + client same-origin) — roda em qualquer porta sem editar `.env`. Em prod, fixos no domínio. **Login Google** ainda exige cada porta local nas *Authorized redirect URIs* do OAuth (Google não tem wildcard de porta). Ver `packages/auth/src/ecommerce.ts`, `apps/web/src/lib/auth-client.ts`.
- **`order.discountAmount` = só cupom/promocode.** Desconto automático de promoção (auto-promo) já está embutido no preço da variante — **não** soma em `discountAmount` (senão conta dobrado na margem). Ver `lib/auto-promo.ts` (server-only) e comentários em `schema/orders.ts`.
- **IDs:** `crypto.randomUUID()` no caller — sem nanoid.
- **Variante sem preço não é vendável (sync #216).** `tool_variant.priceAmount`/`barcode` e `tool.weightKg/lengthCm/widthCm/heightCm` são nullable (rascunho no dashboard). Guardas `hasPrice` (`lib/sellable-variant.ts`) e `hasShippingDims` (`lib/shipping/build-items.ts`) estreitam o tipo — **nunca `!` nem cast**. Sem preço = mesma barreira que `visibleOnSite=false` (some da PDP, bloqueia cupom/revalidação/place-order/rebuy, sem selo de voltagem); sem dimensões = frete "a combinar". **Buraco residual dashboard-owned:** catálogo/promo/busca leem `dv.price_amount` tipado `string` sem `IS NOT NULL` (`queries/tools.ts`, `promotions.ts`, `catalog-helpers.ts`), e `GREATEST(NULL - x, 0)` = `0` → card a R$ 0,00 com promo `fixed`; `price-desc` põe NULL no topo. Fix é no `emach-dashboard`.
- **Card de produto:** chips e voltagens vêm de `getCardExtras` (`lib/card-data.ts`), leitura própria da loja: **não editar `ToolListItem` (`packages/db/src/queries/catalog-helpers.ts`) nem `queries/tools.ts`** (dashboard-owned). **Variante hoje = só voltagem** (`tool_variant.voltage`). O "Ver rápido" é um provider único (`components/quick-view.tsx`) alimentado pela action pública `lib/actions/quick-view.ts`. Visual do card: `DESIGN.md` §7.
- **Ofícios = categorias.** A categoria-mãe `servicos` e as filhas (`/servicos/<slug>`, `tool_category.is_primary = false`) são a navegação por serviço. `lib/service-tree.ts` tira a subárvore das listas de categoria (catálogo, menu, prateleiras); `lib/services.ts` monta os ofícios e `lib/shelves.ts` cai para as categorias-raiz quando não há ofício. Foto do ofício: `SERVICE_IMAGES` (arquivos em `public/images/oficios/`), com fallback para a 1ª foto de produto.
- **Carrinho, hero e overlays:** regras visuais e armadilhas (gutter do Base UI, `QtyStepper` com `min={0}` só na gaveta, hero mobile ≠ desktop) em `DESIGN.md` §7, §9 e §10.
- **Pós-merge de PR sync:** `bun check-types`, e conferir `packages/db/src/index.ts` e a fixture `.github/ci/build-fixture.sql`. Os triggers o dashboard aplica: `db:apply-triggers` roda DDL no banco dev=prod e só entra com autorização. Detalhes em `packages/db/CLAUDE.md`.
- **Debug no browser:** IntersectionObserver parado em aba `hidden` e cor errada na tela com `getComputedStyle` certo têm roteiro próprio em `docs/agents/browser-debug.md`. Ler antes de culpar o código ou o browser.

## Rate limit

- As quatro actions públicas e três das quatro de checkout (`apply-coupon`, `create-order`, `quote-shipping`; `revalidate-cart` não tem) passam por um limiter de `lib/rate-limit.ts` (`couponLimiter`, `orderLimiter`, `shippingLimiter`, `searchLimiter`, `cartEventLimiter`, `cepLimiter`, `quickViewLimiter`), chaveado por `clientId` ou IP. Janela única de 60 s em `@emach/redis` (`RATE_LIMIT_WINDOW_SECONDS`). As actions de checkout devolvem `RATE_LIMIT_MESSAGE` ao exceder; as públicas degradam do seu jeito (`track-cart-event` descarta o evento, `lookup-cep` devolve `unavailable`, `search` e `quick-view` devolvem erro e logam `search_rate_limited` e `quick_view_rate_limited`).
- Sem `UPSTASH_REDIS_REST_URL/TOKEN` o limiter e o cache Frenet caem em memória por instância. Em dev é o esperado; em produção as duas envs são exigidas pelo `check:env` e a ausência em runtime gera só um warn (`lib/redis-monitor.ts`).
- Auth: `rateLimit` em `packages/auth/src/ecommerce.ts` (global 100, `/sign-in/email` 5, `/sign-up/email` 5, `/request-password-reset` 3, `/reset-password` 5, por 60 s, ligado também em dev). Match de path é exato: path novo precisa de regra própria.

## Smoke run-time

`bun check-types` não detecta SQL inválido em template strings nem queries com colunas removidas. Após mexer em schema/queries SSR: `bun dev:web` + visitar rotas afetadas. Stack trace via `nextjs_call <port> get_errors` (MCP `next-devtools`).

## Lacunas conhecidas

- **Pagamento real ausente — pendente (roadmap #4, keystone):** `/dashboard/pedidos/[id]/pagar` é stub (Asaas Pix/Boleto/Cartão); `order.status` carrega o estado de pagamento. Sem a transição `pending_payment → paid` não roda **nem o débito de estoque** (ADR-0003) **nem o ciclo de vida pós-pago**. Praticamente todo o resto do roadmap depende disto.
- **Hardening — pendente (roadmap #5, após o pagamento):**
  - evlog sem drain externo (Axiom/Datadog/Sentry) — output só em console.
- Sem Docker config.

## Deploy e CI (ADR-0004)

- **Repo canônico ≠ repo de deploy.** Trabalha-se em `othavi0/emach-ecommerce` (onde o CI roda); a Vercel está conectada a `emach-ferramentas/emach-ecommerce` (org). O espelho recebe os workflows e tem Actions ligado, mas todo job leva `if: github.repository == 'othavi0/emach-ecommerce'` e sai `skipped` lá (`scripts/workflows.test.ts` cobra a guarda em job novo). X vermelho no espelho não indica `main` quebrada: o sinal é o CI do canônico. `mirror.yml` espelha a `main` para o repo da org **depois que o CI da `main` passa** (`workflow_run`): **deploy = merge na `main` com CI verde**. `main` vermelha não deploya, e commit com `[skip ci]` também não. O mirror roda à mão pelo `workflow_dispatch` e empurra a ponta atual da `main`. Detalhe e gotchas (mirror exige `persist-credentials: false`; secret via `gh secret set --body`, nunca pipe) em ADR-0004.
- **Funções da Vercel em `gru1`** (`apps/web/vercel.json`, travado por `scripts/vercel-region.test.ts`): o banco fica em `sa-east-1`, e no dashboard o default `iad1` custou ~140 ms por query. A região do build no log da Vercel é outra coisa e não importa.
- **CI (`ci.yml`) tem 4 jobs.** `check-types` (lint, testes das regras de lint (`test:lint-rules`, sob o Node 24 do `mise.toml`, porque o RuleTester não roda no Bun), `test:repo`, tipos e `test:ci`, tudo sem banco), `build`, `check-env` e `sync-guard` (só em PR). O passo a passo vive no `ci.yml`. Fora do CI, o `drift-dashboard.yml` roda uma vez por dia e por `workflow_dispatch`: compara os caminhos espelhados, o contrato `docs/integration/admin-ecommerce.md` e o `tools/oxlint/anti-slop/` (sem o `UPSTREAM.md`) com a `main` do dashboard (`scripts/check-dashboard-drift.ts`). Ele não se chama `CI`, então não segura o mirror.
- **`build` roda `next build` contra um Postgres descartável do job**, nunca contra o Supabase: schema por `drizzle-kit push`, triggers, categorias e a fixture `.github/ci/build-fixture.sql`, com env dummy de `scripts/dummy-env.ts`. Com `cacheComponents`, todo `generateStaticParams` precisa devolver pelo menos um resultado: rota dinâmica nova com `generateStaticParams` precisa de linha na fixture.
- **`check-env`** (`bun check:env`, `scripts/check-vercel-env.ts`) cruza com a Vercel as env vars obrigatórias (derivadas do Zod em `packages/env/src/schemas.ts`) mais `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` quando o target é `production` (lista `REQUIRED_IN_PRODUCTION` no script). Essas duas são `.optional()` no Zod para o dev local rodar com fallback in-memory. **Env obrigatória nova precisa ser cadastrada na Vercel** (`vercel env add`), senão o CI falha. Sem `VERCEL_TOKEN`, o job falha em push na `main`.
- **`test:ci` é unit-only** e roda por turbo em todo pacote com script `test:ci`. Teste que usa o `db` real (importa `db` de `@emach/db` sem `vi.mock("@emach/db")`) é integração e leva o sufixo `.integration.test.ts`; a guarda `apps/web/vitest.workspace.test.ts` falha se não levar. A guarda só enxerga o import direto: o que a completa é o `test:ci` não ler o `.env` (o `DATABASE_URL` vira dummy), então teste unit que chega ao banco por outro caminho falha em vez de escrever no Supabase. Na suíte completa (`bun run --filter=web test`) o `apps/web/vitest.workspace.ts` roda os de integração num fork só, um arquivo por vez; no vitest 2.1 `fileParallelism: false` por projeto **não** serializa (o pool lê da raiz), por isso `poolOptions.forks.singleFork`. O `apps/web/vitest.setup.ts` injeta env dummy (`@emach/env/dummies`) nas obrigatórias ausentes.
- **Anti-slop (Oxlint) roda ao lado do Biome.** As regras estão vendorizadas em `tools/oxlint/anti-slop/`: edita-se lá, e a origem fica no `UPSTREAM.md`. A severidade vive no `.oxlintrc.json`, e toda regra ligada é `error`. `no-module-mocking` fica desligada de propósito, porque o teste unit mocka `@emach/db`; em `*.test.ts(x)` também ficam desligadas `no-chained-type-assertions`, `no-unknown-parameters`, `no-unknown-returns` e `require-safety-comment-for-type-assertion`, porque o fake parcial é o próprio cast. Cast que sobra em produção leva `// SAFETY:` nomeando a checagem real; dado externo (`searchParams`, JSON de API, jsonb, `db.execute`) se parseia com Zod. Quem executa query recebe `DbExecutor` (`lib/db-executor.ts`), que aceita o `db` e a transação, sem `tx as unknown as typeof db`. O oxlint roda sob Bun (`bun node_modules/.bin/oxlint`): o `bun run` executa o bin com o Node, que pode não carregar o `index.ts`. O pre-commit (lefthook, instalado pelo `prepare` no `bun install`) roda o Biome e depois o oxlint `--fix`, em série e só nos arquivos staged; tipos e testes ficam no CI. O `prepare` só instala quando há `.git`, guardado por `git rev-parse --git-dir`. Sem a guarda, um `.vercelignore` que apague o `.git` quebraria o `bun install` da Vercel, como aconteceu no dashboard em 2026-07-30. Script novo no `prepare` que dependa de `.git` precisa da mesma guarda. O `scripts/package-scripts.test.ts` trava a guarda e a ordem do `fix` (Biome antes do oxlint, como no pre-commit).

## Design: H3 "Prateleira por ofício" (completo em `DESIGN.md`)

- **Vermelho é verbo:** `--emach-red` só no CTA de compra, uma vez por tela. `EmachButton` (`components/emach-button.tsx`) tem `variant` obrigatório e sem default, para o vermelho nunca sair por omissão.
- **Moldura única:** página e `loading.tsx` dentro do `StoreFrame` não montam `SiteHeader` nem abrem outro `<main>` (`app/(shop)/layout.frame.test.ts`).
- **Token antigo** só no hero congelado, travado por `apps/web/src/test/h3-legacy.global.test.ts`. O hero não muda até o dono pedir.

## MCP

- O Resend vem do plugin oficial `resend` (skills e MCP). **Não** rodar `claude mcp add resend`, que duplicaria as tools. O MCP lê `RESEND_API_KEY` do ambiente do processo do Claude Code; o `mise.toml` exporta só essa chave, lida do `apps/web/.env`. Depois de mexer: `mise trust` e relançar o `claude`.
- O `.mcp.json` fixa a versão dos servidores `npx`. A do `shadcn` acompanha a do `@emach/ui` (`scripts/repo-config.test.ts` trava).

## Agent skills

### Issue tracker

Issues e PRDs vivem como GitHub issues (`gh` CLI), repo `othavi0/emach-ecommerce`. PRs externos **não** são superfície de triagem. Ver `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulário default — os 5 roles canônicos mapeiam 1:1 (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Ver `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: `CONTEXT-MAP.md` na raiz indexa os bounded contexts; cada `CONTEXT.md` vive em `docs/contexts/<slug>/`. Ver `docs/agents/domain.md`.

## Onde estão os outros mistakes-logs

| Tópico | Arquivo |
|---|---|
| Schema sync, triggers, gotchas DB | `packages/db/CLAUDE.md` |
| Dono de cada tabela, contrato do banco compartilhado (cópia do dashboard) | `docs/integration/admin-ecommerce.md` |
| Sistema visual H3 completo (tokens, primitivos, regras) | `DESIGN.md` |
| Multi-context glossário de domínio | `CONTEXT-MAP.md` |
| Frete Frenet (cache, anti-fraude, origem, pegadinhas da API) | `apps/web/src/lib/frenet/CLAUDE.md` |
| Debug no browser (aba oculta, cor errada na tela) | `docs/agents/browser-debug.md` |
| Achados de auditoria já rejeitados (não re-auditar) | `docs/agents/achados-rejeitados.md` |
| Skills locais, MCPs versionados | `.claude/skills/`, `.mcp.json` |

Stack / scripts / envs → `package.json`, `packages/env/src/{server,web}.ts`. Schema fonte de verdade → repo irmão `emach-dashboard`.
