# Cotação de frete via SuperFrete no checkout — Design (#47)

> **Status em 2026-09-28:** substituído. O SuperFrete chegou a produção (#49), mas o PR #164 trocou-o pelo motor de tabelas (`2026-06-22-frete-tabelas-checkout-design.md`) e o PR #178 trocou o motor de tabelas pela Frenet (`2026-07-02-frenet-cotacao-design.md`). Hoje não existe `lib/superfrete/`, `lib/origin-branch.ts` nem env `SUPERFRETE_*`; a cotação vive em `apps/web/src/lib/shipping/quote.ts` e `apps/web/src/lib/frenet/`.

> Data: 2026-06-03 · Issue: emach-ecommerce#47 · Status: aprovado para plano
> Brainstorming de **implementação** (a decisão de produto já estava na #47).

## 1. Objetivo

Substituir o frete **hardcoded** do checkout (`checkout-content.tsx:41-42`: grátis ≥ R$299, senão R$29,90) por **cotação real, server-side, sob demanda**, via API do **SuperFrete**, quando o cliente informa o CEP de destino. O cliente vê os serviços disponíveis (SEDEX, PAC, Jadlog…) com preço e prazo, escolhe um, e o valor entra no total do pedido.

## 2. Decisões (e o que mudou na investigação)

| Decisão | Valor |
|---|---|
| Plataforma | SuperFrete (Bearer token; cotação grátis) |
| Onde roda | Server-side (Next server action), sob demanda no `/checkout` |
| CEP de origem | **Filial Curitiba** (`branch.cep = 80010000`), resolvida por `DEFAULT_BRANCH_ID` |
| Frete grátis | **Fora do escopo** — cotação pura; grátis vira cupom (escopo de Promoções) |
| Itens acima do teto SuperFrete (30kg / 100³cm / perímetro 200cm) | Não há no catálogo; só **guarda defensiva** |
| Empacotamento | `products[]` (SuperFrete empacota), 1 entrada por item do carrinho |
| Ambiente | Sandbox primeiro (`SUPERFRETE_BASE_URL`) |

**Achados que simplificaram o escopo da #47:**
- **Peso/dimensão já existem** e são `NOT NULL` em `tool` (`weightKg`, `lengthCm`, `widthCm`, `heightCm`) e **já são lidos** no `place-order.ts:263-268`. → A "dependência cross-repo" da issue (abrir trabalho no dashboard) **não é necessária**.

_Nota 2026-09-28: peso e dimensões de `tool` hoje são anuláveis (rascunho no dashboard); o CHECK `active_requires_shipping_data` só exige os valores em ferramenta ativa (`packages/db/src/schema/tools.ts:132`). Ferramenta sem eles cai em "Frete a combinar" (`apps/web/src/lib/shipping/quote.ts`)._
- **Estoque já é geral** (soma de todas as filiais) na vitrine (`catalog.ts`) e na validação do checkout (`place-order.ts` `checkAggregateStock`). → Sem mudança de estoque.
- `getDefaultBranchId()`/`lib/default-branch.ts` citado no `CLAUDE.md` raiz **não existe** (drift). Este design **cria** esse helper de fato.

_Nota 2026-09-28: o helper de origem criado aqui (`lib/origin-branch.ts`, `DEFAULT_BRANCH_ID`) foi removido no PR #164. A origem hoje vem de `getShippingSettings` (`packages/db/src/queries/store-settings.ts`), com `FRENET_SELLER_CEP` como fallback._

## 3. Arquitetura

_Nota 2026-09-28: os módulos desta seção (`lib/superfrete/`, `origin-branch.ts`) foram removidos no PR #164. `_actions/quote-shipping.ts`, `shipping-options.tsx` e a revalidação no `place-order.ts` continuam, agora sobre a Frenet. O `freight-calculator` citado no fluxo não existe mais (removido em `1ae3d0c`)._

```
apps/web/src/
  lib/
    superfrete/
      types.ts        # ShippingOption, SuperFreteService (raw), QuoteInput
      client.ts       # fetch tipado: base URL + headers + timeout; POST /api/v0/calculator
      quote.ts        # quoteShipping(): resolve origem, monta products[] do DB, normaliza resposta
    origin-branch.ts  # getOriginBranchCep(): lê DEFAULT_BRANCH_ID -> branch.cep
  app/checkout/
    _actions/
      quote-shipping.ts   # server action: valida CEP, chama quote.ts, ActionResult<ShippingOption[]>
    _components/
      checkout-content.tsx     # consome a action; renderiza opções; remove frete hardcoded
      shipping-options.tsx     # (novo) lista de opções de frete (radio + preço + prazo + loading/erro)
    _lib/
      place-order.ts           # re-valida shippingAmount contra re-cotação (anti-fraude)
```

### 3.1 `lib/superfrete/client.ts`
- Base URL de `SUPERFRETE_BASE_URL`; headers `Authorization: Bearer ${SUPERFRETE_TOKEN}`, `User-Agent: ${SUPERFRETE_USER_AGENT}`, `Content-Type`/`Accept: application/json`.
- `POST /api/v0/calculator` com `AbortController` (timeout ~8s).
- Erros HTTP/timeout → lança erro tipado (`SuperFreteError`) capturado pela camada acima.

### 3.2 `lib/superfrete/quote.ts`
- `quoteShipping({ destinationCep, items })` onde `items: { toolId; quantity }[]`.
- Resolve **origem** via `getOriginBranchCep()`.
- Busca peso/dim dos `toolId`s **no DB** (não confia no client) — reusa o padrão de `prepareLines`.
- Monta `products[]`: 1 entrada por item → `{ height, width, length, weight, quantity, insurance_value: 0 }` (dim/peso de `tool`).
- `services: "1,2,17,3"` (PAC, SEDEX, Mini, Jadlog) — configurável.
- **Normaliza**: filtra serviços **sem `price`** ou com `error`/`has_error` (vide §5). Retorna `ShippingOption[] = { id, name, company, priceCents, deliveryDays }` ordenado por preço.
- **Guarda defensiva**: se algum item exceder os tetos (30kg / dimensões), loga e segue (catálogo não tem hoje).

### 3.3 `app/checkout/_actions/quote-shipping.ts`
- `"use server"`. Input Zod: `destinationCep` (8 dígitos), `items[]`.
- Retorno `ActionResult<ShippingOption[]>` (`{ ok, data } | { ok:false, error }`).
- `catch` → `log.error({ action: "quoteShipping", ... })` + `{ ok:false, error: "Não foi possível calcular o frete." }`.

### 3.4 `checkout-content.tsx` + `shipping-options.tsx`
- Remove `FREE_SHIPPING_CENTS` / `STANDARD_SHIPPING_CENTS`.
- Quando o CEP fica válido (8 dígitos, **debounce ~600ms**), chama `quoteShipping`.
- `shipping-options.tsx`: estados **loading / erro (com retry) / lista**. Cada opção: nome + transportadora + prazo + `R$ x,xx` (formato BR). Seleção define `shippingCents`.
- Sem opção selecionada → bloqueia "Finalizar".

## 4. Data flow

```
CEP válido (client, debounce)
  → quoteShipping action (server)
      → getOriginBranchCep()  (DEFAULT_BRANCH_ID → branch.cep)
      → SELECT weight/dim dos toolIds (DB)
      → superfrete/client POST /calculator (products[])
      → normaliza (só com price) → ShippingOption[]
  → UI renderiza opções → cliente escolhe → shippingCents
  → createOrderAction → place-order (re-valida shipping)
```

## 5. Shape real da API (validado em sandbox 2026-06-03)

`POST {base}/api/v0/calculator` → array. Por serviço:
- **Sucesso**: `{ id, name, price (number, R$), discount, delivery_time, delivery_range{min,max}, company{...}, has_error:false }`.
- **Falha**: `{ id, name, error: "<code>", company{...} }` — **sem `price`**.

Teste real Curitiba(80010000)→SP(01310100), 1kg/20×15×10: **SEDEX R$35,96, 1 dia** ✅; **PAC `error:444`** (filtrado); Mini não retornou. → **Regra:** exibir só itens com `price`.

## 6. Segurança / robustez

- **Anti-fraude de frete:** hoje `place-order` aceita `shippingAmount` do client sem validar. Como preços de item já são revalidados (`PRICE_TOLERANCE_CENTS`), o frete também deve ser: no `place-order`, **re-cotar** server-side e validar `shippingAmount` contra a opção (com tolerância) — ou recusar. Evita pedido com frete adulterado (ex.: 0).
- **Token é secret** — só em env (`SUPERFRETE_TOKEN`), nunca commitado (`.env` gitignored). Sandbox hoje.
- **Timeout + fallback**: falha/lentidão nunca trava o checkout; mostra erro com retry.
- **Sem `console.*`** — `log` do evlog. `: any` proibido.
- **Cache (nice-to-have):** in-memory curto por `(origem, destino, hash itens)` TTL ~10min para evitar recotação a cada render. Não-bloqueante pro MVP.

## 7. Env (adicionar em `packages/env/src/server.ts`, `z.string().min(1)`)

_Nota 2026-09-28: as envs `SUPERFRETE_*` e `DEFAULT_BRANCH_ID` saíram de `packages/env/src/schemas.ts`. As envs de frete atuais são `FRENET_TOKEN`, `FRENET_SELLER_CEP` e `FRENET_BASE_URL` (`schemas.ts:38-40`)._

`SUPERFRETE_TOKEN`, `SUPERFRETE_BASE_URL`, `SUPERFRETE_USER_AGENT`, `DEFAULT_BRANCH_ID` — já presentes no `apps/web/.env`.

## 8. Testes (Vitest, `apps/web`)

- `quote.ts`: monta `products[]` correto a partir de itens; filtra serviços sem `price`; ordena por preço; guarda defensiva de teto. (client mockado)
- `client.ts`: headers corretos; timeout/erro viram `SuperFreteError`. (fetch mockado)
- `origin-branch.ts`: resolve CEP a partir do `DEFAULT_BRANCH_ID`; erro claro se filial não existir.

## 9. Fora de escopo (#47)

- Autocomplete de endereço por **ViaCEP** no checkout (evolução; hoje CEP é digitado).
- Cotação no `/cart` ou na página de produto (evolução).
- Cupom de frete grátis (escopo de Promoções).
- Emissão de etiqueta / compra de frete (só **cotação** aqui).
- Multi-filial por região (`getBranchByCep`) — origem é fixa (Curitiba) no MVP.

## 10. Pré-condições já satisfeitas

- ✅ Filial **Curitiba** no banco (CEP 80010000) — origem.
- ✅ Token **sandbox** gerado e em `apps/web/.env` (validado por cotação real).
- ✅ Peso/dimensão em `tool` (NOT NULL); estoque geral.
