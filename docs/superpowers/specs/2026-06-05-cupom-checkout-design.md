# Cupom no checkout + correção do sync de promoções

> **Status em 2026-09-28:** implementado. O cupom vive em `apps/web/src/lib/coupons/validate-coupon.ts`, o preview em `apps/web/src/app/checkout/_actions/apply-coupon.ts`, o campo em `apps/web/src/app/checkout/_components/coupon-field.tsx` e a integração em `apps/web/src/app/checkout/_lib/place-order.ts` (`FOR UPDATE` e `redemption_count + 1` na criação do pedido). `order.coupon_id` existe em `packages/db/src/schema/orders.ts`. Ajustes posteriores: o schema do item do carrinho foi para `_lib/coupon-schema.ts` e a mensagem de cupom inexistente, inativo ou esgotado é colapsada em "Cupom inválido ou indisponível" (`publicCouponError`); ver `2026-06-07-followups-cupom-checkout-design.md`.

> Design aprovado em 2026-06-05. Origem: issue #55 (redesenho de promoções/cupons,
> PR `othavioquiliao/emach-dashboard#120`). Contrato de integração:
> `emach-dashboard/docs/integration/admin-ecommerce.md` (seção "Aplicação de cupom no checkout").

## Contexto

O redesenho de promoções no dashboard renomeou `discount_pct → discount_value` e adicionou
colunas em `promotion` (tabela **compartilhada**, owned-by-dashboard). O sync de schema (ADR-0009)
já trouxe as colunas novas para este repo e o `catalog.ts` já calcula o preço com desconto
automático na vitrine/PDP. Porém:

1. **O projeto não compila.** Dois arquivos *ecommerce-owned* (fora do sync) ainda usam
   `promotion.discountPct` (coluna removida): `product-info.tsx` e `place-order.ts`.
2. **Cupom no checkout não existe.** Sem campo de código, validação, cálculo nem contador. O
   dashboard apenas armazena os cupons; o *enforcement* vive aqui (contrato).
3. **Não há fluxo de pagamento real.** Asaas é `TODO` (`payment-methods.tsx` é mock). Não existe
   transição `→ paid` nem débito de estoque — o pedido nasce e fica em `pending_payment`.

## Decisões (travadas com o usuário)

| Decisão | Escolha | Razão |
|---|---|---|
| Escopo do desconto de cupom específico | **Só itens elegíveis** | Mais justo/previsível; cupom de uma tool não barateia o carrinho todo. |
| Persistir qual cupom foi aplicado | **`order.coupon_id`** (nasce no dashboard, sync) | Casa com o contrato; `order` é tabela Shared. |
| Local do campo "inserir cupom" | **Página de checkout** | Contexto de total fechado; menos abandono. |
| Timing do incremento de `redemption_count` | **Na criação do pedido** | Não há transição `paid`. Consistente com o estado atual (estoque também só é checado na criação). Migrar para o webhook de `paid` quando o Asaas entrar. |

## Arquitetura

Unidades isoladas, cada uma com um propósito:

```
apps/web/src/
  lib/coupons/
    validate-coupon.ts        # núcleo: validação + cálculo (recebe tx, puro o suficiente p/ testar)
    validate-coupon.test.ts
  app/checkout/
    _actions/apply-coupon.ts  # server action: preview do desconto p/ o UI
    _components/coupon-field.tsx  # client: input + Aplicar/Remover + estado
    _lib/place-order.ts       # integração: re-valida + incrementa + grava (na transação)
    _lib/place-order.test.ts
```

> _Nota 2026-09-28: `validate-coupon.ts` hoje recebe `(tx, code, lines, autoPromoToolIds?)` e o auto-desconto vem de `apps/web/src/lib/auto-promo.ts` (`fetchAutoPromosByToolId`); `fetchAutoDiscountByToolId` não existe mais._

> A lógica de cupom vive no **app** (não em `packages/db/queries`, que é synced do dashboard) —
> o contrato é explícito: "o enforcement do cupom vive no checkout (aqui)".

## Parte 0 — Correção do breakage (table-stakes)

### `product-info.tsx`
`applyDiscount` para de recalcular o preço via `promotion.discountPct`. Passa a consumir o preço
com desconto que o `catalog` já devolve em `activePromotion` (campo `discountedAmount` — confirmar
o nome exato na implementação lendo o shape de `ToolDetail` em `catalog.ts`).

### `place-order.ts`
`fetchDiscountPctByToolId` → `fetchAutoDiscountByToolId`:
- Lê `discount_type` / `discount_value` (não mais `discount_pct`).
- Trata `percent` **e** `fixed` (clamp do preço unitário em ≥ 0).
- Passa a respeitar `applies_to_all=true` (hoje só faz join em `promotion_tool`, ignorando promoção
  global — diverge do catalog). Re-validação de preço fica **idêntica** à vitrine: escolhe o maior
  desconto efetivo por tool, descontos nunca somam.

## Parte 1 — Schema (ADR-0009, DB Supabase compartilhado)

Adicionar em **ambos** os repos (`packages/db/src/schema/orders.ts`), no `order`:

```ts
couponId: text("coupon_id").references(() => promotion.id, { onDelete: "set null" }),
```

- `discount_amount` já existe — reusar.
- DB é único e compartilhado → `bunx drizzle-kit push` (uma vez) + `bun db:apply-triggers`.
- **Commit só no branch deste repo.** A edição no schema do dashboard fica preparada localmente,
  **sem commit lá sem liberação** — é o passo de coordenação que o CI normalmente faria
  (dashboard → ecommerce). Sem a coluna no dashboard, o `db:check-drift` de lá acusaria drift.

## Parte 2 — Lógica de cupom

### `validate-coupon.ts`
`validateCoupon({ tx, code, lines })`:
1. Resolve `promotion` por `code` + `type='promocode'` + `active=true` + dentro da vigência
   (`starts_at`/`ends_at` nullable = sem prazo).
2. **Escopo:** subtotal **elegível** = itens cujo `tool` ∈ `promotion_tool` (ou todos se
   `applies_to_all=true`).
3. **Mínimo:** rejeita se subtotal elegível `< min_order_amount` (quando não-nulo).
4. **Limite:** rejeita se `redemption_count >= max_redemptions` (quando não-nulo).
5. **Cálculo:** `percent` → percentual sobre a base elegível; `fixed` → abate `discount_value` em
   R$. Clamp em ≥ 0.

Retorno: `{ ok: true; promotionId; discountCents }` ou `{ ok: false; error }` (mensagem user-safe).

### `apply-coupon.ts` (`"use server"`)
Guard de sessão → **re-busca preços no servidor** (nunca confia no client) → chama `validateCoupon`
→ devolve preview do desconto. Catch com `log.error` antes do retorno.

## Parte 3 — Integração no pedido (`place-order.ts`)

- `inputSchema` ganha `couponCode: z.string().optional()`.
- Dentro da transação do `placeOrder`:
  1. Re-rodar `validateCoupon` (verdade do servidor; ignora qualquer desconto enviado pelo client).
  2. `SELECT ... FOR UPDATE` na linha da `promotion` + re-check do limite na mesma transação.
  3. `redemption_count++` (nunca ultrapassa `max_redemptions` sob concorrência).
  4. Gravar `order.couponId` + `order.discountAmount`.
  5. `total = subtotal − desconto + frete` (clamp ≥ 0).
- Write em tabela dashboard-owned/shared: `actor_type='system'` onde aplicável.
- Cupom inválido no momento do pedido → `OrderError`; o client limpa.
  _Nota 2026-09-28: a mensagem passa por `publicCouponError` (`lib/coupons/validate-coupon.ts:48`), que colapsa reasons enumeráveis em "Cupom inválido ou indisponível" (anti-enumeração). "Cupom não disponível" só aparece no caso de promoção removida entre a validação e o `FOR UPDATE`, e também passa por esse colapso._

## Parte 4 — UI

- **`coupon-field.tsx`** (client, isolado do `checkout-content.tsx` de 747 linhas): input +
  Aplicar/Remover, estado aplicado/erro, chama `apply-coupon`. Envia só `couponCode` (string) ao
  `createOrderAction`.
- Resumo do checkout (`checkout-content.tsx`, ~linha 537) ganha linha **Desconto** entre Subtotal
  e Frete. Total recalculado no client para preview; servidor é a verdade.
- Estilo Ferrari: labels em Barlow Condensed uppercase + tracking; **sem vermelho** (desconto não é
  CTA de alta prioridade).

## Parte 5 — Erros (mensagens user-safe via `OrderError`)

_Nota 2026-09-28: para o cliente, as mensagens de código inexistente, expirado e esgotado são genéricas ("Cupom inválido ou indisponível"); só "Pedido mínimo de R$ X" e "Cupom não cobre nenhum item do carrinho" mantêm o texto detalhado._

"Cupom inválido" · "Cupom expirado" · "Cupom esgotado" · "Pedido mínimo de R$ X" · "Cupom não
cobre nenhum item do carrinho". Sempre `log.error({ action, ...context })` antes de retornar.

## Parte 6 — Testes (TDD)

- `validate-coupon.test.ts`: percent/fixed; escopo elegível-only; mínimo não atingido;
  expirado/inativo; limite atingido; code inexistente; clamp `fixed` ≥ 0.
- `place-order.test.ts`: pedido com cupom grava `discountAmount`/`couponId`/`total` corretos;
  `redemption_count` incrementa; concorrência respeita `max_redemptions` (espelha o teste de
  idempotência de estoque já existente).

## Fora de escopo (YAGNI / follow-up)

- Fluxo de pagamento real (Asaas) e transição `→ paid` (ainda pendente em 2026-09-28: `payment-methods.tsx` segue com dados mock) — quando entrar, mover incremento de cupom +
  débito de estoque para o webhook de `paid`.
- Campo de cupom na página `/cart` (decidido: só no checkout).
- Soma de cupom + promoção automática (contrato: nunca somam).

## Plano de execução

Branch `feat/cupom-checkout` (já criado). Commits scoped:
1. fix breakage `discount_pct` (Parte 0)
2. schema `coupon_id` (Parte 1)
3. lib `validate-coupon` + action + testes (Partes 2, 6)
4. UI `coupon-field` + resumo (Parte 4)
5. integração `place-order` + testes (Partes 3, 6)

Smoke: `/dev-here 3001` — aplicar cupom no checkout, verificar desconto no resumo e persistência no
pedido. Commits liberados só neste branch.
