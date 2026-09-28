# Hardening de segurança no checkout/DB — issues #90, #94, #95

> **Status em 2026-09-28:** implementado (PR #102). `apps/web/src/lib/client-ip.ts`, `apps/web/src/lib/rate-limit.ts` (Upstash com fallback em memória) e `packages/db/src/sql/rls.sql` existem; `create-order.ts`, `apply-coupon.ts` e `quote-shipping.ts` aplicam os limiters, e `publicCouponError` em `lib/coupons/validate-coupon.ts` colapsa `inválido`/`expirado`/`esgotado`.

> Spec de implementação. Três fixes de segurança independentes, entregues em um PR único.
> Issues: [#90](https://github.com/othavioquiliao/emach-ecommerce/issues/90), [#94](https://github.com/othavioquiliao/emach-ecommerce/issues/94), [#95](https://github.com/othavioquiliao/emach-ecommerce/issues/95).

## Contexto e objetivo

Três achados de auditoria de segurança, todos no perímetro do checkout e do banco compartilhado:

1. **#90** — 13 tabelas do schema `public` (o `rls.sql` de hoje cobre 14, com `cart_event`) estão expostas via PostgREST sem RLS. Qualquer um com a anon key lê (e em algumas, escreve) estoque por filial, margens de promoção e reviews direto pela REST API do Supabase.
2. **#95** — o IP gravado no `consentLog` (evidência LGPD de aceite de termos) vem do primeiro hop de `x-forwarded-for`, que o cliente controla. O log registra IP forjável, enfraquecendo o valor probatório.
3. **#94** — as server actions do checkout não têm throttle: `applyCouponAction` permite enumerar cupons válidos por força bruta, `quoteShippingAction` drena a cota/custo da API SuperFrete, `createOrderAction` permite marteladas em race conditions de estoque/cupom.

O objetivo é fechar os três sem alterar o fluxo normal de checkout.

## Decisões tomadas (brainstorming)

| Tema | Decisão | Por quê |
|---|---|---|
| #90 — onde versionar | Aplicar via MCP Supabase agora + SQL versionado aqui + issue no dashboard | Banco compartilhado é owned-by-dashboard (ADR-0009); aplica já e deixa o dashboard avaliar ADR |
| #94 — storage do limiter | `@upstash/ratelimit` + fallback in-memory | Projeto vai adotar Upstash Redis pela task de auth (#91/#92/#96); reusa a infra; durável em serverless sem tocar no Postgres nem no schema cross-repo |
| #94 — client Redis | Importar `getRedis()` de `@emach/redis` (package novo, criado pelo PR de auth) | Fronteira do monorepo: `packages/auth` (#91) não pode importar de `apps/web`, então o client único mora num package |
| #94 — anti-enumeração | Colapsar só `inválido`/`expirado`/`esgotado` | Esses revelam existência do código; `não cobre item`/`pedido mínimo` são feedback do carrinho (UX legítima) |
| #94 — chave do limiter | `clientId` para cupom/pedido; **IP** para frete | `quoteShippingAction` é pública (usada no `freight-calculator` da página de produto), não tem sessão |

## Escopo de implementação

### 1. `#90` — RLS nas 13 tabelas `public`

**Tabelas:** `tool`, `tool_variant`, `tool_image`, `tool_category`, `tool_attribute_value`, `tool_attribute_assignment`, `attribute_definition`, `category`, `branch`, `stock_level`, `promotion`, `promotion_tool`, `review`.

**Passos:**

1. **Pré-checagem (gate).** Confirmar que nem o ecommerce nem o dashboard usam `supabase-js` com anon key para ler/escrever essas tabelas (`grep` por `createClient` de `@supabase/supabase-js` nos dois repos). Confirmar que o role usado pelo Drizzle via `DATABASE_URL` é owner ou tem `BYPASSRLS` (acesso server-side não pode quebrar). **Se algum uso de anon key aparecer, parar e reportar antes de aplicar.**
2. Para cada tabela: `ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;` — sem policies (deny-all via PostgREST). Aplicar via MCP Supabase (idempotente).
3. Versionar o SQL em `packages/db/src/sql/rls.sql` (precedente: `triggers.sql`) com nota apontando o dashboard como canônico. _Nota 2026-09-28: hoje o arquivo é cópia sincronizada do `emach-dashboard` (PR de sync), então não se edita aqui._ Registrar a gotcha em `packages/db/CLAUDE.md`.
4. Abrir issue no repo `emach-dashboard` para um agente avaliar se o `ENABLE RLS` deve virar ADR / arquivo SQL canônico lá.
5. Rodar `get_advisors type=security` e confirmar zero `rls_disabled_in_public`.

**Aceite:**
- 13 tabelas com `rowsecurity = true` em `pg_tables`.
- Advisor sem nenhum `rls_disabled_in_public`.
- Storefront e dashboard funcionando (smoke em catálogo, estoque, checkout).
- SQL versionado + issue no dashboard aberta.

### 2. `#95` — IP confiável no `consentLog`

**Helper novo:** `apps/web/src/lib/client-ip.ts`.

```
getClientIp(headers): string | null
```

- Prefere `x-real-ip` (IP real injetado pelo proxy da Vercel).
- Fallback: **último** elemento de `x-forwarded-for` (o primeiro é spoofável; o último é o hop adicionado pelo proxy confiável).
- `null` se ausente. Em dev local, aceita o que houver.
- Comentário documentando o comportamento serverless/dev no topo do helper.
- Confirmar o header canônico da Vercel via `find-docs` antes de fixar a ordem de precedência.

**Troca:** `apps/web/src/app/checkout/_actions/create-order.ts:38-39` passa a usar `getClientIp`. Buscar outros pontos que gravam IP (`grep x-forwarded-for`) e migrar todos.

**Aceite:**
- Helper único usado em todos os pontos que gravam IP.
- Request com `X-Forwarded-For` forjado não altera o IP gravado no `consentLog` (testável em preview Vercel).
- Comportamento em dev documentado no helper.

### 3. `#94` — Rate limit + anti-enumeração

**Limiter novo:** `apps/web/src/lib/rate-limit.ts`.

- Usa `@upstash/ratelimit` (sliding window) sobre o client de `getRedis()` (`@emach/redis`).
- Quando `getRedis()` retorna `null` (envs Upstash ausentes — dev local ou antes do provisionamento), cai para um limiter in-memory (`Map` com janela deslizante). Comentário documentando que o modo in-memory é best-effort em serverless (reseta em cold start, não compartilha entre instâncias).
- Prefixo de chave `checkout:*` (auth usa `auth:*` — sem colisão).
- API: uma função que recebe `(key, limit, windowSeconds)` e devolve se está dentro do limite. _Nota 2026-09-28: a API real é `Limiter.limit(key)` com instâncias por uso (`couponLimiter`, `orderLimiter`, `shippingLimiter`, `searchLimiter`, `cartEventLimiter`, `cepLimiter`); a janela vem de `RATE_LIMIT_WINDOW_SECONDS` em `@emach/redis`._

**Aplicação nas actions:**

| Action | Limite | Chave |
|---|---|---|
| `applyCouponAction` | 10/min | `clientId` (sessão já validada) |
| `createOrderAction` | 5/min | `clientId` |
| `quoteShippingAction` | 20/min | IP (via `getClientIp` do #95) — action é pública |

- Ao exceder: retornar `ActionResult` `{ ok: false, error: "Muitas tentativas, aguarde um instante" }` — sem vazar janela/limite.

**Anti-enumeração de cupom** (`apps/web/src/lib/coupons/validate-coupon.ts` + `apply-coupon.ts`):

- Colapsar `"Cupom inválido"`, `"Cupom expirado"`, `"Cupom esgotado"` numa única mensagem ao usuário: `"Cupom inválido ou indisponível"`. _Nota 2026-09-28: o colapso mora em `publicCouponError` (`lib/coupons/validate-coupon.ts`), usado por `apply-coupon` e `place-order`._
- Manter `"Cupom não cobre nenhum item do carrinho"` e `"Pedido mínimo de R$ X"` (feedback do carrinho, não enumeração do código).
- Motivo real sempre no `log` estruturado (evlog) para debug.

**Aceite:**
- As 3 actions rejeitam chamadas acima do limite com mensagem genérica.
- `applyCouponAction` retorna a mesma mensagem para inexistente/esgotado/expirado; motivo real no evlog.
- Limitação serverless do modo in-memory documentada em comentário.
- Fluxo normal de checkout intocado (smoke real na rota).

## Dependências e ordem

- **#90** e **#95** são independentes — implementados primeiro.
- **#94** depende do package `@emach/redis`, criado pelo PR de auth (#91/#92/#96). Estratégia: implementar #94 com o fallback in-memory ativo; quando `@emach/redis` mergear, rebase e a importação `getRedis()` "liga" o modo durável sozinho. O PR de auth mergeia **antes** (é o dono do package + das envs `UPSTASH_REDIS_REST_URL`/`_TOKEN` em `packages/env/src/server.ts`, ambas `.optional()`).
- **Coordenação combinada com a task de auth:** client Redis único em `@emach/redis` (`getRedis(): Redis | null`, lendo envs via `@emach/env/server`); prefixos de chave `auth:*` vs `checkout:*`.

## Entrega

- Branch nova, **um PR** com os três fixes.
- Corpo do PR com `Closes #90`, `Closes #94`, `Closes #95` → GitHub fecha os três no merge.

## Fora de escopo

- Storage durável do rate limit por Postgres (descartado — bloqueio cross-repo + carga no banco).
- `secondaryStorage` global movendo sessão pro Redis (decisão da task de auth, não desta).
- Frete fail-open hardening (#5 do roadmap — exige coluna nova no schema, nasce no dashboard). _Nota 2026-09-28: entregue depois no #97 (PR #110), com `order.shippingUnverified`._
- Drain externo do evlog (Axiom/Datadog/Sentry).
