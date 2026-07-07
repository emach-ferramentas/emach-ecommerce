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
- **Guarda de rota = 2 camadas, ambas obrigatórias (#98).** `proxy.ts` só checa **existência** do cookie no edge (barato, array `PROTECTED`); quem **valida** a sessão é o `layout.tsx` da área via `requireCurrentClient()` (`lib/session.ts` → `getSession`). Área autenticada nova **fora de `/dashboard`** precisa das duas: criar `layout.tsx` com `requireCurrentClient()` **e** adicionar o prefixo em `PROTECTED`. Server **actions** (ex.: checkout) não herdam layout — `requireCurrentClient()` no topo de cada uma. Travado por `app/dashboard/layout.guard.test.ts` + `lib/session.test.ts`.
- **`typedRoutes: true`** — `<Link href>` valida em tsc.
- **Resend em produção:** `EMAIL_FROM` usa domínio verificado (`nao-responder@emachferramentas.com.br`). SPF/DKIM/DMARC verificados no Resend; monitorar bounce/deliverability.
- **Frete = Frenet** (`POST api.frenet.com.br/shipping/quote`, spec `docs/superpowers/specs/2026-07-02-frenet-cotacao-design.md`) via adapter `lib/shipping/quote.ts` — contrato `{negotiate, options: ShippingOption[]}` preservado (testes mockam esse boundary). `packItems` + `shippingBox` continuam consolidando o carrinho em caixas reais ANTES da chamada (item sem caixa → `negotiate` = "Frete a combinar"; tabelas `carrier`/`carrierZone`/`carrierRate` aposentadas — drop físico pendente via dashboard/sync). Cache Redis 30min (`lib/frenet/cache.ts`) faz o re-quote do `assertShippingQuoted` reutilizar a cotação exibida → 1 chamada Frenet por checkout e anti-fraude determinístico; o anti-fraude valida o PAR serviço+preço e grava `order.shippingMethod`. **Fail-open (#97) voltou a cobrir API externa:** Frenet fora/timeout → pedido criado com `shippingUnverified` p/ revisão staff. Contrato Frenet tem pegadinhas absorvidas em `lib/frenet/map.ts`: chave com typo oficial `ShippingSevicesArray`, preço/prazo string, erro POR serviço. Envs `FRENET_TOKEN` + `FRENET_SELLER_CEP` obrigatórias (cadastrar na Vercel; `FRENET_SELLER_CEP` tem regex → o dummy dos testes é escolhido POR VALIDADOR em `vitest.setup.ts`). Gotcha P0 do registro manual de `shippingBox` no `schema` de `packages/db/src/index.ts` continua valendo.
- **Estoque: storefront só valida, não debita (ADR-0003).** `placeOrder` (`checkout/_lib/place-order.ts`) roda `checkAggregateStock` (SUM de todas as filiais) e cria o pedido em `pending_payment` — **sem** escrever `stockMovement`. O débito (`saida_venda`, `actorType='system'`) virá na transição `pending_payment → paid`, junto da integração de pagamento (hoje stub). Doc que disser "débito na criação" é ADR-0001 legado (já superseded).
- **Auth multi-porta em dev:** `baseURL`/`trustedOrigins` do auth ecommerce são dinâmicos em dev (`allowedHosts: ['localhost:*']` + client same-origin) — roda em qualquer porta sem editar `.env`. Em prod, fixos no domínio. **Login Google** ainda exige cada porta local nas *Authorized redirect URIs* do OAuth (Google não tem wildcard de porta). Ver `packages/auth/src/ecommerce.ts`, `apps/web/src/lib/auth-client.ts`.
- **`order.discountAmount` = só cupom/promocode.** Desconto automático de promoção (auto-promo) já está embutido no preço da variante — **não** soma em `discountAmount` (senão conta dobrado na margem). Ver `lib/auto-promo.ts` (server-only) e comentários em `schema/orders.ts`.
- **IDs:** `crypto.randomUUID()` no caller — sem nanoid.
- **Card de produto é dark + selos de voltagem (PR #70).** `ProductCard` (#181818; `surface="elevated"` #242424 em promoções) é flat (sem box-shadow), com quick-add vermelho no hover (`quick-add-button.tsx`, client + `useCart`). Os selos de voltagem na imagem listam **todas** as variantes — agregadas por `lib/variant-voltages.ts` (helper storefront). **Variante hoje = só voltagem** (`tool_variant.voltage`); cor é *atributo* descritivo, não variante. Pra trazer voltagens ao card **não editar `catalog.ts`/`ToolListItem`** (dashboard-owned) — usar o helper + prop `voltagesByTool`. `CategoryTile` é dark spotlight (`.emach-bg-tile-spot`) com auto-cycle no `category-grid.tsx`. Sistema visual completo em `DESIGN.md` §10.
- **Carrinho (drawer `cart-sheet.tsx` + `/cart`) = chiaroscuro** (header/footer escuros + corpo claro; resumo do pedido = card `bg-near-black`). Mistakes pegos no code-review (não repetir): (1) **hairline = `border-border`, nunca `border-gray-10`** — `gray-10` é a *própria cor do fundo*, então a divisória de itens some na `/cart`; (2) botão em superfície escura = `ghost-light`/`outline-light`/`primary`, **nunca `ghost`/`outline`** (texto/borda `near-black` somem); (3) **faixa branca à direita da drawer** = Base UI seta `scrollbar-gutter: stable` inline no `<html>` durante o scroll-lock e os `position:fixed` (backdrop/drawer) não cobrem o gutter — fix com `html:has(body[style*="overflow"]) { scrollbar-gutter: auto !important }` em `globals.css` (casa shorthand **e** longhand); (4) `QuantityPicker`/`CartItemRow` são **display puro** — a política "decrementar a 0 remove o item" (`min={0}` + `next<1`) mora no caller (`CartSheet`). Detalhe completo em `DESIGN.md` §10 (Cart state).
- **Hero mobile ≠ desktop (`hero-carousel.tsx`).** (1) `productScale`/`ctaScale` (Hero Builder #130) são **desktop-only** — aplicados como CSS `scale` gated no `lg:` (var `--prod-scale`/`--cta-scale`); no mobile ficam `scale:1`. Reaplicar via `style={{ scale }}` incondicional **estoura o viewport** (×1.6 → ~525px num viewport de 400). (2) No mobile o **bg desktop é derrubado** (arte widescreen com título/specs *queimados na imagem*, corta no retrato): banner mobile usa `backgroundMobileMode='none'`/`'custom'`, **nunca `'inherit'`**. Glow só pulsa no desktop (blur por frame trava mobile). Banner mobile sem produto = vazio. Detalhe em `DESIGN.md` §10 (Hero carousel).
- **Pós-merge de PR sync ou `bun db:push` em dev local:** rodar `bun db:apply-triggers` (triggers em `sql/triggers.sql`, owned-by-dashboard).
- **Dev server pega `.env` stale:** editar `apps/web/.env` mid-sessão (ex.: `SUPERFRETE_BASE_URL` sandbox↔prod) e reiniciar `next dev` **não** reflete — Next dá precedência a `process.env` (que o shell/mise carregou no boot) sobre o arquivo. Relançar shell novo, ou `set -a && . apps/web/.env && set +a && next dev`. Conferir: `tr '\0' '\n' < /proc/$PID/environ | grep VAR`.
- **Mapa de filiais — paths gerados com projeção MANUAL, nunca `geoPath()` (PR #71).** `scripts/gen-brazil-map.mjs` projeta cada vértice ponto-a-ponto (`proj(coord)` → `M/L/Z`). **NÃO usar `d3-geo` `geoPath(feature)`**: o GeoJSON do IBGE tem winding-order invertido e o clip de esfera do d3 emite o *complemento* do estado (estado + retângulo `~-1340..3300` da esfera projetada) — com `fill`, cada estado preenche o **oceano**, e 27 sobrepostos viram um bloco cinza-claro. Sintoma: mapa todo cinza claro em vez de fundo escuro. Após editar o gerador: `node scripts/gen-brazil-map.mjs` + conferir que nenhum ponto sai de `[0,560]×[0,580]`. O fix `415ad4c` (bbox planar) só consertou a *projeção*, não o *fill*; o fill foi resolvido no #71.
- **Debug de render (SVG/img/cor) — medir pixel real ANTES de culpar o browser.** Quando `getComputedStyle` está correto mas a tela mostra outra cor, **NÃO** assumir force-dark/extensão/`color-scheme`. Desenhar o elemento num `<canvas>` (`drawImage` + `getImageData`) e ler o pixel — isso revela se o bug está nos **dados** (caso do mapa acima) ou na composição. E validar cedo num **Chromium limpo** (`agent-browser`, fora do perfil/extensões). Trocar `img.src` via JS **não** é teste confiável de render (re-processamento inconsistente) — só `reload` real ou canvas valem. Auto Dark Theme do Chromium ativa com **sistema em dark** (sem flag); `color-scheme: light` no `:root` (`globals.css`) previne.

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
- **CI (`ci.yml`) tem 3 gates:** `check-types` + `test:ci` (`bun run --filter=web test:ci`, unit-only) + `check-env`. **`bun check:env`** (`scripts/check-vercel-env.ts`) cruza as env vars obrigatórias (derivadas do Zod em `packages/env/src/schemas.ts`) com a Vercel — **env obrigatória nova precisa ser cadastrada na Vercel** (`vercel env add`) senão o CI falha e o build quebraria no deploy.
- **`test:ci` é unit-only.** Teste que usa `withRollback`/`db.transaction`/dados do DB é **integração** → adicionar à lista `INTEGRATION` em `apps/web/vitest.config.ts` (senão quebra no CI, que não tem `.env`/DB). `apps/web/vitest.setup.ts` injeta env dummy nas obrigatórias ausentes p/ a validação do `@emach/env` não abortar a suíte.

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
