# emach-ecommerce

> Log de mistakes recorrentes e decisões não-óbvias. Código vence em conflito.
> Storefront BR de ferramentas (furadeiras, serras, EPIs). Compartilha DB Supabase com `emach-dashboard` (repo irmão, admin staff).

## ⛔ Guardrails duros (incidentes 2026-06/07)

- **Banco único dev=prod compartilhado.** NUNCA `seed`/`truncate`/`drop`/INSERT/UPDATE em dado real sem autorização explícita NESTA sessão (writes de smoke em banner/promoção de produção já foram barrados pelo classifier 3×). Subagente que toca banco recebe esta restrição colada no prompt.
- **NUNCA `cd`/Read/Edit/`gh issue` no `emach-dashboard` a partir daqui** (ADR-0009): mudança de schema/issue do dashboard abre-se LÁ; aqui só se consome o PR de sync automático.
- CWD é a RAIZ do monorepo (turbo/bun) — nunca `cd apps/web`; paths absolutos.

## Auth — invariantes P0 (qualquer violação é bug crítico)

Duas instâncias **completamente isoladas** Better Auth no mesmo banco. Este app usa só a `ecommerce` (clientes BR via email/senha + Google OAuth).

1. `apps/web` deste repo **nunca** importa `@emach/db/schema/auth` nem `@emach/auth/dashboard`. Dashboard **nunca** importa `@emach/db/schema/client` nem `@emach/auth/ecommerce`.
2. `EcommerceSession` ≠ `DashboardSession` — não existe tipo "Session" genérico.
3. **Nunca** setar `advanced.cookies.<name>.attributes.domain = ".emach.com.br"`. Subdomínios distintos isolam por host.
4. CPF/CNPJ e telefone: o Zod do formulário é só UX. A validação que vale roda no servidor, nos `databaseHooks` de `packages/auth/src/ecommerce.ts` (`isValidCpfCnpj`, `isValidPhone`, `onlyDigits` de `@emach/validators`, arquivo `packages/validators/src/cpf-cnpj.ts`). O hook normaliza para só dígitos e grava `NULL` (nunca `""`) quando o campo chega vazio, senão o unique `client_document_unique` colide no segundo cliente.

## Ownership e schema sync (ADR-0009, no `emach-dashboard`)

Schema TS aqui é **cópia versionada** do dashboard, sincronizada via **CI PR automático**.

- **Owned-by-dashboard (autoritativo, mudanças começam lá):** `tool`, `toolVariant`, `toolCategory`, `toolImage`, `toolAttributeAssignment`, `category`, `supplier`, `supplierAuditLog`, `branch`, `stockLevel`, `userBranch`, `userActivityLog`, `promotion`, `promotionTool`, `storeSettings`, `attribute*`, schema `auth`.
- **Owned-by-ecommerce (autoritativo aqui):** tabelas `client*` (7 — `client`, `clientSession`, `clientAccount`, `clientVerification`, `clientAddress` + LGPD `clientAuditLog`, `clientExportLog`).
- **Escrita compartilhada:** `order`, `orderItem`, `orderStatusHistory`, `orderNote`, `orderAttachment`, `orderEvent`, `refundRequest` (a loja cria em `dashboard/pedidos/_actions/refunds.ts`), `stockMovement`, `review`, `consentLog`, `toolAttributeValue`.
- **Sem dono declarado (confirmar no dashboard):** `banner`, `shippingBox`, `orderPicking*`, `stockAlertSent`, `userCapabilityOverride`. Lista mantida em `packages/db/CLAUDE.md`.
- **`cartEvent`:** escrita pela loja (INSERT em `lib/actions/track-cart-event.ts`); o dashboard lê e expurga (comentário em `schema/cart-events.ts`).
- **Sync:** workflow `sync-db-schema.yml` no dashboard abre PR aqui quando `packages/db/src/{schema,queries,sql/triggers.sql}` muda na `main` do dashboard. **Não editar `schema/*.ts` em isolamento aqui.**
- **`db:generate` / `db:migrate` são legacy** — scripts ainda no `package.json` mas não usar. A pasta `migrations/` foi removida.
- **Escritas em tabelas dashboard-owned:** `actorType='system'` em `stockMovement` e similares (nunca `'user'` — `user` é staff). Enum atual: `pgEnum('actor_type', ['user','system'])`.

## Anti-patterns banidos (P0/P1)

- `console.log/warn/error` em produção. Usar `log` do evlog (`import { log } from "@/lib/evlog"`). Única exceção: `lib/composition/legacy-composition.ts` (`console.error` de composition inválida), porque roda em client component e o evlog é server-only. Em catch de server action: **sempre** `log.error({ action, ...context })` antes de retornar `{ ok: false }` — silenciar sem log é P0.
- `: any`, `as any`, `@ts-ignore`, `@ts-expect-error` (exceto `.next/` gerado).
- `key={index}` em `.map()` — IDs estáveis. Exceções com `biome-ignore` documentado.
- `<img>` puro — sempre `next/image` (exceto thumbs Supabase com `// biome-ignore lint/performance/noImgElement`).
- `React.forwardRef` — React 19 usa `ref` como prop normal.
- `useMemo`/`useCallback` manuais — React Compiler ativo.
- `async function` em Client Component — usar Server Component pra fetching.
- Barrel files em `packages/ui/src`, `apps/web/src`, `packages/auth/src`. Exceções: `packages/db/src/schema/index.ts` (intencional) e o re-export de `STOREFRONT_TOOL_STATUSES` em `packages/db/src/queries/tools.ts` (owned-by-dashboard, vem por sync).
- `.forEach()` em hot path — `for...of`.
- `new RegExp(...)` em loops — extrair top-level.
- `target="_blank"` sem `rel="noopener"`.
- HTML não-sanitizado em React — passar por `react-markdown` + `rehype-sanitize` (`defaultSchema`).
- Importar `@emach/db/schema/auth` ou `@emach/auth/dashboard` (P0 — quebra isolamento).

## Server actions

- `"use server"` no topo, input validado com Zod, normalizar antes de persistir. Action que mexe em dado do cliente chama `requireCurrentClient()` no topo. As três públicas (`search`, `lookup-cep`, `track-cart-event` em `lib/actions/`) não exigem sessão e por isso limitam por IP com `lib/rate-limit.ts`; action pública nova segue o mesmo padrão.
- Retorno: `ActionResult` (sem payload) ou `ActionResultWith<T>` (`{ ok: true; data: T } | { ok: false; error: string }`), ambos em `lib/actions/types.ts`. `dashboard/pedidos/_actions/orders.ts` ainda declara um `ActionResult<T>` local; ao mexer ali, importar o compartilhado.
- Catch: `log.error({ action, ...context })` + `{ ok: false, error: "mensagem" }`. Sem `console`.

## Gotchas

- **`createDb()` × `db` singleton:** `@emach/auth/*` usa `createDb()` pra evitar ciclo com `@emach/env`; resto usa `db`. Não consolidar.
- **Rota autenticada lê e escreve pelo `@emach/db` normalmente** (`lib/orders/queries.ts`, `place-order.ts`, `_actions/*`); o `@emach/auth/ecommerce` só entrega a sessão (`requireCurrentClient`). O que nunca entra em `apps/web` é `@emach/db/schema/auth` e `@emach/auth/dashboard` (invariante P0 acima).
- **shadcn é Base UI (não Radix)** — style `base-lyra`. Primitivo `@base-ui/react`.
- **`shadcn add` não passa pelo hook lint** — rodar `bun check` após adicionar componentes.
- **`proxy.ts` (Next 16) substitui `middleware.ts`** — não criar `middleware.ts`.
- **Guarda de rota = 2 camadas, ambas obrigatórias (#98).** `proxy.ts` só checa **existência** do cookie no edge (barato, array `PROTECTED`); quem **valida** a sessão é um Server Component async sob `<Suspense>` que chama `requireCurrentClient()` (`lib/session.ts` → `getSession`). Com `cacheComponents`, a chamada solta no `layout.tsx` fora de Suspense quebra o build. Onde a guarda mora hoje: em `/dashboard`, no `DashboardChrome` que o `layout.tsx` monta sob Suspense; em `/checkout` e `/pedidos/[number]`, no componente de conteúdo da própria `page.tsx`. Área autenticada nova precisa das duas camadas: guarda sob Suspense **e** prefixo em `PROTECTED` (o `/checkout` entra por condição própria no `proxy.ts`). Server **actions** não herdam a guarda do render: `requireCurrentClient()` no topo de cada uma. Travado por `app/dashboard/layout.guard.test.ts` + `lib/session.test.ts`. `proxy.ts` também redireciona URL legada de categoria (`/catalog?cat=x`) com 308 (`lib/seo/catalog-redirect.ts`). A exceção do `/checkout` é `/checkout/success` (`app/(shop)/checkout/success`), confirmação pública que não lê sessão. Ela está órfã: o checkout manda para `/pedidos/<n>` depois de criar o pedido. O cookie checado é `ecommerce.session_token` (ou `__Secure-ecommerce.session_token` sob HTTPS); sem ele o proxy manda para `/login?redirect=<caminho>`.
- **`typedRoutes: true`** — `<Link href>` valida em tsc.
- **Resend em produção:** `EMAIL_FROM` usa domínio verificado (`nao-responder@emachferramentas.com.br`). SPF/DKIM/DMARC verificados no Resend; monitorar bounce/deliverability.
- **Frete = Frenet** (`POST api.frenet.com.br/shipping/quote`, spec `docs/superpowers/specs/2026-07-02-frenet-cotacao-design.md`) via adapter `lib/shipping/quote.ts` — contrato `{negotiate, options: ShippingOption[]}` preservado (testes mockam esse boundary). `packItems` + `shippingBox` continuam consolidando o carrinho em caixas reais ANTES da chamada (item sem caixa → `negotiate` = "Frete a combinar"; tabelas `carrier`/`carrierZone`/`carrierRate` aposentadas e já dropadas do banco). Cache Redis 30min (`lib/frenet/cache.ts`) faz o re-quote do `assertShippingQuoted` reutilizar a cotação exibida → 1 chamada Frenet por checkout e anti-fraude determinístico; o anti-fraude valida o PAR serviço+preço e grava `order.shippingMethod` e `shippingServiceCode` (carrierId composto da opção casada). **Fail-open (#97) voltou a cobrir API externa:** Frenet fora/timeout → pedido criado com `shippingUnverified` p/ revisão staff. Contrato Frenet tem pegadinhas absorvidas em `lib/frenet/map.ts`: chave com typo oficial `ShippingSevicesArray`, preço/prazo string, erro POR serviço. Envs `FRENET_TOKEN` + `FRENET_SELLER_CEP` obrigatórias (cadastrar na Vercel; `FRENET_SELLER_CEP` tem regex → o dummy dos testes é escolhido POR VALIDADOR em `vitest.setup.ts`). `FRENET_SELLER_CEP` é só o CEP de origem de fallback: a origem real é a filial de `store_settings.shipping_origin_branch_id` (`getShippingSettings`); o env vale sem filial ou com CEP da filial inválido. O valor declarado segue a política de seguro do dashboard (`insurancePolicy`, `insuranceCapAmount`), e origem e valor entram na chave do cache. Gotcha P0 do registro manual de `shippingBox` no `schema` de `packages/db/src/index.ts` continua valendo.
- **Estoque: storefront só valida, não debita (ADR-0003).** `placeOrder` (`checkout/_lib/place-order.ts`) roda `checkAggregateStock` (SUM de todas as filiais) e cria o pedido em `pending_payment` — **sem** escrever `stockMovement`. O débito (`saida_venda`, `actorType='system'`) virá na transição `pending_payment → paid`, junto da integração de pagamento (hoje stub). Doc que disser "débito na criação" é ADR-0001 legado (já superseded).
- **Auth multi-porta em dev:** `baseURL`/`trustedOrigins` do auth ecommerce são dinâmicos em dev (`allowedHosts: ['localhost:*']` + client same-origin) — roda em qualquer porta sem editar `.env`. Em prod, fixos no domínio. **Login Google** ainda exige cada porta local nas *Authorized redirect URIs* do OAuth (Google não tem wildcard de porta). Ver `packages/auth/src/ecommerce.ts`, `apps/web/src/lib/auth-client.ts`.
- **`order.discountAmount` = só cupom/promocode.** Desconto automático de promoção (auto-promo) já está embutido no preço da variante — **não** soma em `discountAmount` (senão conta dobrado na margem). Ver `lib/auto-promo.ts` (server-only) e comentários em `schema/orders.ts`.
- **IDs:** `crypto.randomUUID()` no caller — sem nanoid.
- **Variante sem preço não é vendável (sync #216).** `tool_variant.priceAmount`/`barcode` e `tool.weightKg/lengthCm/widthCm/heightCm` são nullable (rascunho no dashboard). Guardas `hasPrice` (`lib/sellable-variant.ts`) e `hasShippingDims` (`lib/shipping/build-items.ts`) estreitam o tipo — **nunca `!` nem cast**. Sem preço = mesma barreira que `visibleOnSite=false` (some da PDP, bloqueia cupom/revalidação/place-order/rebuy, sem selo de voltagem); sem dimensões = frete "a combinar". **Buraco residual dashboard-owned:** catálogo/promo/busca leem `dv.price_amount` tipado `string` sem `IS NOT NULL` (`queries/tools.ts`, `promotions.ts`, `catalog-helpers.ts`), e `GREATEST(NULL - x, 0)` = `0` → card a R$ 0,00 com promo `fixed`; `price-desc` põe NULL no topo. Fix é no `emach-dashboard`.
- **Card de produto (redesign H3).** `ProductCard` é claro: foto em `bg-well`, "Ver rápido" sempre visível, estoque, chips curtos, preço com parcelas (`lib/installments.ts`, parcela mínima R$ 10 até 12x) e um botão que muda (`lib/card-action.ts`: adicionar, escolher voltagem no "Ver rápido", avisar quando esgotado). Chips e voltagens vêm de `getCardExtras` (`lib/card-data.ts`), leitura própria da loja: **não editar `ToolListItem` (`packages/db/src/queries/catalog-helpers.ts`) nem `queries/tools.ts`** (dashboard-owned). **Variante hoje = só voltagem** (`tool_variant.voltage`). O "Ver rápido" é um provider único (`components/quick-view.tsx`) alimentado pela action pública `lib/actions/quick-view.ts`.
- **Ofícios = categorias.** A categoria-mãe `servicos` e as filhas (`/servicos/<slug>`, `tool_category.is_primary = false`) são a navegação por serviço. `lib/service-tree.ts` tira a subárvore das listas de categoria (catálogo, menu, prateleiras); `lib/services.ts` monta os ofícios e `lib/shelves.ts` cai para as categorias-raiz quando não há ofício. Foto do ofício: `SERVICE_IMAGES` (arquivos em `public/images/oficios/`), com fallback para a 1ª foto de produto.
- **Carrinho (gaveta `cart-sheet.tsx` + `/cart`) no H3.** Gaveta clara em `bg-paper` com rodapé `bg-canteiro`; a `/cart` fecha o resumo num `Panel`. Divisória de item é `border-line`. Mistakes que continuam valendo: (1) **faixa branca à direita da gaveta** = Base UI seta `scrollbar-gutter: stable` inline no `<html>` durante o scroll-lock e os `position:fixed` (backdrop e gaveta) não cobrem o gutter. O fix fica em `globals.css`: `html:has(body[style*="overflow"]) { scrollbar-gutter: auto !important }` (casa shorthand **e** longhand). (2) `QtyStepper` (`components/buy/qty-stepper.tsx`) tem `min = 1` por padrão; só a variante `compact` do `CartItemRow` (gaveta) passa `min={0}`. A regra "decrementar a 0 remove o item" fecha no caller: `next < 1` em `CartSheet` chama `handleRemove`. Na `/cart` o stepper para em 1 e a remoção é o botão próprio.
- **Hero mobile ≠ desktop (`hero-carousel.tsx`).** (1) Escala por elemento vem de `banner.composition` (#210) e vale nos DOIS viewports: elemento **posicionado** (desktop sempre; mobile só override) aplica a própria `scale` via transform do placement; item **herdado na pilha segura** mobile NÃO aplica escala (box fixa da pilha). O gate `lg:` de escala morreu junto com `LAYOUT_CONFIG` — renderer único em `components/hero/` + lib pura em `lib/composition/`; `NULL`/inválida convertem on-the-fly pro mapa legado (`legacy-composition.ts`, inválida loga bannerId). (2) No mobile o **bg desktop é derrubado** (arte widescreen com título/specs *queimados na imagem*, corta no retrato): banner mobile usa `backgroundMobileMode='none'`/`'custom'`, **nunca `'inherit'`**. Glow só pulsa no desktop (blur por frame trava mobile). Banner mobile sem produto = vazio. Detalhe em `DESIGN.md` §10 (Hero carousel).
- **Pós-merge de PR sync ou `bun db:push` em dev local:** rodar `bun --cwd packages/db db:apply-triggers` (o script só existe no pacote, não na raiz; triggers em `sql/triggers.sql`, owned-by-dashboard).
- **Dev server pega `.env` stale:** editar `apps/web/.env` mid-sessão (ex.: `FRENET_BASE_URL` ou `FRENET_TOKEN`) e reiniciar `next dev` **não** reflete — Next dá precedência a `process.env` (que o shell/mise carregou no boot) sobre o arquivo. Relançar shell novo, ou `set -a && . apps/web/.env && set +a && next dev`. Conferir: `tr '\0' '\n' < /proc/$PID/environ | grep VAR`.
- **IntersectionObserver NÃO dispara em aba `hidden`** (Chromium pausa o loop de render em background/janela coberta). Scroll-spy/reveal parece "quebrado" sob automação via claude-in-chrome com o Brave atrás de outras janelas — checar `document.visibilityState` ANTES de culpar o código; trazer a janela do Brave para a frente antes de medir.
- **Debug de render (SVG/img/cor) — medir pixel real ANTES de culpar o browser.** Quando `getComputedStyle` está correto mas a tela mostra outra cor, **NÃO** assumir force-dark/extensão/`color-scheme`. Desenhar o elemento num `<canvas>` (`drawImage` + `getImageData`) e ler o pixel — isso revela se o bug está nos **dados** (caso do mapa acima) ou na composição. E validar cedo fora do perfil com extensões, pedindo ao user uma janela limpa, porque o claude-in-chrome só dirige o Brave dele. Trocar `img.src` via JS **não** é teste confiável de render (re-processamento inconsistente) — só `reload` real ou canvas valem. Auto Dark Theme do Chromium ativa com **sistema em dark** (sem flag); `color-scheme: light` no `:root` (`globals.css`) previne.

## Rate limit

- As três actions públicas e três das quatro de checkout (`apply-coupon`, `create-order`, `quote-shipping`; `revalidate-cart` não tem) passam por um limiter de `lib/rate-limit.ts` (`couponLimiter`, `orderLimiter`, `shippingLimiter`, `searchLimiter`, `cartEventLimiter`, `cepLimiter`), chaveado por `clientId` ou IP. Janela única de 60 s em `@emach/redis` (`RATE_LIMIT_WINDOW_SECONDS`). As actions de checkout devolvem `RATE_LIMIT_MESSAGE` ao exceder; as públicas degradam do seu jeito (`track-cart-event` descarta o evento, `lookup-cep` devolve `unavailable`, `search` devolve erro e loga `search_rate_limited`).
- Sem `UPSTASH_REDIS_REST_URL/TOKEN` o limiter e o cache Frenet caem em memória por instância. Em dev é o esperado; em produção as duas envs são exigidas pelo `check:env` e a ausência em runtime gera só um warn (`lib/redis-monitor.ts`).
- Auth: `rateLimit` em `packages/auth/src/ecommerce.ts` (global 100, `/sign-in/email` 5, `/sign-up/email` 5, `/request-password-reset` 3, `/reset-password` 5, por 60 s, ligado também em dev). Match de path é exato: path novo precisa de regra própria.

## Smoke run-time

`bun check-types` não detecta SQL inválido em template strings nem queries com colunas removidas. Após mexer em schema/queries SSR: `bun dev:web` + visitar rotas afetadas. Stack trace via `nextjs_call <port> get_errors` (MCP `next-devtools`).

**Testes de integração contra o DB real são flaky sob concorrência — não é regressão.** `place-order.test.ts` (e afins que usam `withRollback` + Supabase compartilhado) passam isolados (`bun run --filter=web test src/app/checkout/_lib/place-order.test.ts`), mas 1-3 podem falhar na suíte completa (`bun run --filter=web test`) por contenção de estoque/conexões — o vitest roda arquivos em paralelo contra o mesmo banco. Sintoma: falha em "estoque agregado multi-filial" que **some ao re-rodar**. Antes de culpar uma mudança: re-rodar isolado **e** a suíte de novo. Fix de fundo (pendente): isolar dados por worker ou `sequential`.

## Lacunas conhecidas

- **Pagamento real ausente — pendente (roadmap #4, keystone):** `/dashboard/pedidos/[id]/pagar` é stub (Asaas Pix/Boleto/Cartão); `order.status` carrega o estado de pagamento. Sem a transição `pending_payment → paid` não roda **nem o débito de estoque** (ADR-0003) **nem o ciclo de vida pós-pago**. Praticamente todo o resto do roadmap depende disto.
- **Hardening — pendente (roadmap #5, após o pagamento):**
  - evlog sem drain externo (Axiom/Datadog/Sentry) — output só em console.
- Sem Docker config.

## Deploy e CI (ADR-0004)

- **Repo canônico ≠ repo de deploy.** Trabalha-se em `othavi0/emach-ecommerce` (onde o CI roda); a Vercel está conectada a `emach-ferramentas/emach-ecommerce` (org, Actions OFF). `mirror.yml` espelha a `main` pro repo da org a cada push → **deploy = `git push origin main`**, sem push manual. Detalhe e gotchas (mirror exige `persist-credentials: false`; secret via `gh secret set --body`, nunca pipe) em ADR-0004.
- **CI (`ci.yml`) tem 2 jobs.** `check-types` roda em série: `bun check` (lint ultracite) → `bun check-types` → `test:ci` do web (unit-only) → `test` de `@emach/validators`, `@emach/db` e `@emach/auth` (todos sem banco). `check-env` roda à parte. O mirror **não** espera o CI: `main` vermelha deploya igual. **`bun check:env`** (`scripts/check-vercel-env.ts`) cruza com a Vercel as env vars obrigatórias (derivadas do Zod em `packages/env/src/schemas.ts`) mais `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` quando o target é `production` (lista `REQUIRED_IN_PRODUCTION` no script). Essas duas são `.optional()` no Zod para o dev local rodar com fallback in-memory; o gate de produção vive só no script — **env obrigatória nova precisa ser cadastrada na Vercel** (`vercel env add`) senão o CI falha e o build quebraria no deploy.
- **`test:ci` é unit-only.** Teste que usa `withRollback`/`db.transaction`/dados do DB é **integração** → adicionar à lista `INTEGRATION` em `apps/web/vitest.config.ts` (senão quebra no CI, que não tem `.env`/DB). Teste que só **mocka** `@emach/db` é unit e fica fora da lista (ex.: `create-order.test.ts`, `place-order.shipping.test.ts`). `apps/web/vitest.setup.ts` injeta env dummy nas obrigatórias ausentes p/ a validação do `@emach/env` não abortar a suíte.

## Design — redesign H3 "Prateleira por ofício" (resumo)

Tokens em `packages/ui/src/styles/globals.css` (bloco H3: `--paper`, `--canteiro`, `--ink*`, `--line*`, `--grafite*`, `--on-dark*`, `--ok`, `--off`). As telas de compra, conta, auth e apoio estão no H3. Ainda têm token antigo a PDP (`app/(shop)/product/[slug]/loading.tsx`, o selo de oferta em `product-info.tsx` e as avaliações: `product-reviews.tsx`, `review-card.tsx`, `review-list.tsx`, `review-sort.tsx`, `verified-badge.tsx`, `star-rating.tsx`), `components/product-rating.tsx`, `components/product-image.tsx` (poço de foto vazia, usado no card e no carrinho), o hero congelado e os e-mails de `packages/email`. `DESIGN.md` está desatualizado e descreve o sistema antigo: o código vence. **Vermelho é verbo, não decoração**: `--emach-red` só no CTA de compra; estrutura em grafite. Cantos `--radius: 3px` (cards 5px). Tipografia: **Archivo** variável; `font-display` é a mesma família no eixo `wdth` 62 (títulos uppercase). Preços sempre `R$ 899,00`.

**Superfícies:** página e card em `--paper` (#fff), faixas alternadas em `--canteiro` (#f0f0ee), foto de produto em `--well`, rodapé e barra utilitária em grafite. Card se separa do fundo por borda `--line`, não por sombra.

**Primitivos e regras do H3:**

- `EmachButton` (`components/emach-button.tsx`) tem `variant` obrigatório: `cta` (vermelho, uma vez por tela), `dark`, `line`, `danger`, `link`. Sem default, para o vermelho nunca sair por omissão.
- O hero não muda até o dono pedir: usa a cópia congelada do botão antigo em `components/hero/hero-cta-variants.ts`, que só `components/hero/*` importa.
- Rota fora de `(shop)` usa a moldura `StoreFrame` (`components/store-frame.tsx`): o grupo `app/(auth)` (login, senha e verificação de e-mail), o layout da conta (`app/dashboard/layout.tsx`) e o `app/not-found.tsx`. A moldura já abre o único `<main id="main-content">`; nada dentro dela abre outro.
- `safeRedirect` (`lib/safe-redirect.ts`) resolve `.`, `..` e barras repetidas e recusa rota de auth como destino, senão o cliente logado fica preso no `/login`. Link para o login usa `loginHref(pathname)`, que só leva `redirect` quando o login vai aceitá-lo.
- Token visual antigo é travado por `apps/web/src/test/h3-legacy.global.test.ts`, que varre todo o `apps/web/src` com `scanForLegacyTokens` e compara com `LEGACY_EXCEPTIONS` (arquivo e motivo). A lista só encolhe: arquivo novo com token antigo falha, e exceção que ficou limpa também falha até a linha sair.

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
| Schema sync, triggers, ownership detalhado, gotchas DB | `packages/db/CLAUDE.md` |
| Sistema visual completo | `DESIGN.md` |
| Multi-context glossário de domínio | `CONTEXT-MAP.md` |
| Skills locais, MCPs versionados | `.claude/skills/`, `.mcp.json` |

Stack / scripts / envs → `package.json`, `packages/env/src/{server,web}.ts`. Schema fonte de verdade → repo irmão `emach-dashboard`.
