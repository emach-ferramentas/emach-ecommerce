# Follow-ups do cupom no checkout — design

> **Status em 2026-09-28:** implementado, com dois desvios. As unidades A, B e C estão no código: `numericToCents` e `fmtNumericBRL` únicos, `apps/web/src/lib/auto-promo.ts` (`fetchAutoPromosByToolId`, `autoPromoToolIdsFromMap`) injetado em `validateCoupon`, e `apps/web/src/app/checkout/_actions/revalidate-cart.ts` chamado no mount de `checkout-content.tsx`. A Fase final (issue de handoff no `emach-dashboard`) não foi verificada, porque este repo não lê o dashboard; `order.coupon_id` já consta em `packages/db/src/schema/orders.ts`.

> Resolve a issue **#57** (follow-ups consolidados pós **PR #56**, que fechou #55).
> Escopo desta rodada: itens **2, 3, 5, 6** (ecommerce-owned). Itens **1 e 4**
> (cross-repo, dashboard) viram um issue de handoff no `emach-dashboard`,
> criado **após** o PR deste repo ser aberto.

## Contexto

O PR #56 entregou a aplicação de cupom no checkout (`promotion.type='promocode'`)
e corrigiu o breakage do sync `discount_pct → discount_value`. Ficaram seis
follow-ups conhecidos. Este spec ataca os quatro que vivem neste repo e deixa os
dois cross-repo documentados num handoff estruturado.

Base técnica travada no design do #55/#56 (não muda aqui): cupom e promoção
automática são a mesma tabela `promotion`, distinguidas por `type`; desconto de
cupom incide **só em itens elegíveis**, **nunca empilha** com auto-promo (item
sob auto-promo vigente é excluído da base); `redemption_count` incrementa **na
criação do pedido**; a guarda `PRICE_TOLERANCE_CENTS` em `place-order` impede
fechar pedido com preço divergente do real.

## Ordem de implementação

Deliberada, por dependência: **A (utils) → B (helper auto-promo) → C
(revalidação de preço)**. C consome o helper de B; B consome o util de A.

---

## Unidade A — Consolidar utils (item 6)

Refactor puro, sem comportamento novo. Remove duplicações introduzidas no #56.

- `numericToCents` (`apps/web/src/lib/format.ts`) passa a ser o **único**
  conversor string→centavos. Remover:
  - `centsFromString` em `apps/web/src/app/checkout/_lib/place-order.ts` (cópia
    exata) — substituir todos os usos por `numericToCents`; ajustar imports em
    testes que importem `centsFromString`.
  - `Math.round(Number(x) * 100)` inline em `validate-coupon.ts` e
    `apply-coupon.ts` — usar `numericToCents`.
- `validate-coupon.ts`: trocar o `toLocaleString` inline (erro de pedido mínimo)
  por `fmtNumericBRL` (`lib/format.ts`).
- Shape do cart-item do cupom: definir **um** `zod` schema exportado (em
  `apply-coupon.ts`; _nota 2026-09-28: ficou em `apps/web/src/app/checkout/_lib/coupon-schema.ts`, porque arquivo `"use server"` só exporta funções async_) e tipar `CouponField.cartItems` com `z.infer<...>[number]`,
  eliminando a redeclaração de `CouponCartItem` em `coupon-field.tsx`. Assim um
  rename no schema quebra em tsc.

**Interface:** sem novas assinaturas públicas; apenas remoção de
`centsFromString`.

**Verificação:** `check-types` + suíte existente verdes (refactor não muda
comportamento).

---

## Unidade B — Helper único de auto-promo + set injetável (itens 3 e 5)

Elimina a regra de elegibilidade de auto-promo reescrita em dois pontos
ecommerce e as queries redundantes por resgate de cupom.

- Novo módulo **server-only** `apps/web/src/lib/auto-promo.ts` (fonte única).
  Não estender `lib/promotions.ts`: esse arquivo exporta `effectiveAutoDiscountCents`
  (puro) e é importado por `product-info.tsx`, que é `"use client"` — incluir a
  query de DB lá vazaria o driver pro bundle do cliente. Conteúdo:
  - `fetchAutoPromosByToolId(tx, toolIds, now): Map<toolId, AutoPromo[]>` —
    movido de `place-order.ts` sem mudança de lógica (promoções `type='promotion'`
    ativas e vigentes, global via `applies_to_all` ou específica via
    `promotion_tool`).
  - `autoPromoToolIdsFromMap(map): Set<toolId>` — deriva o conjunto de tools com
    auto-promo vigente, preservando a semântica atual de `fetchAutoPromoToolIds`
    (tool presente no map = tem promo vigente).
- `validateCoupon(tx, code, lines, autoPromoToolIds?)` ganha 4º parâmetro
  **opcional**:
  - **recebido** (chamada de dentro do `placeOrder`) → usa direto, **zero query**
    de auto-promo;
  - **ausente** (preview standalone no `apply-coupon`) → computa via
    `fetchAutoPromosByToolId` + `autoPromoToolIdsFromMap`.
  - O `fetchAutoPromoToolIds` interno de `validate-coupon.ts` é removido (passa a
    usar o helper canônico).
- `place-order.ts`: `prepareLines` já monta o `Map`; `placeOrder` deriva o `Set`
  com `autoPromoToolIdsFromMap` e injeta em `validateCoupon` — remove as 1-2
  queries redundantes (item 5).
- `packages/db/src/queries/catalog.ts` (owned-by-dashboard): **não tocar**
  (synced via CI — qualquer edição local seria sobrescrita no próximo PR de sync,
  ADR-0009). O comentário que documenta o espelhamento vai no **novo módulo
  `auto-promo.ts`**, apontando que o SQL `LATERAL` de `catalog.ts` aplica a mesma
  regra de elegibilidade e nasce no dashboard.

**Interface:** `validateCoupon(tx, code, lines, autoPromoToolIds?)` —
retrocompatível (4º arg opcional).

**Invariante preservada:** o conjunto de tools excluídas da base do cupom é
idêntico ao de hoje, venha ele do set injetado ou do helper — coberto por teste.

**Verificação:** testes de `validate-coupon` e `place-order` verdes; teste novo
afirmando que injetar o set produz a mesma exclusão que computá-lo.

---

## Unidade C — Revalidação de preço no checkout (item 2)

Corrige a causa do display enganoso: o resumo do checkout calcula o subtotal a
partir do snapshot de preço no `localStorage` (gravado quando o item foi
adicionado), enquanto cupom e `place-order` usam o preço real atual do DB.
Quando a auto-promo muda entre adicionar e checkout (ex.: expira), os números
divergem.

- Novo server action `apps/web/src/app/checkout/_actions/revalidate-cart.ts`
  (`revalidateCartAction`), molde do `quote-shipping`:
  - input `zod`: `cartItems[]` (`variantId`, `toolId`, `quantity`);
    _nota 2026-09-28: o schema atual só recebe `toolId` e `variantId`, sem `quantity`, e a resposta ganhou `unavailable: string[]` (variante sem preço, removida ou oculta); `checkout-content.tsx` remove esses itens do carrinho com toast_;
  - re-busca o preço real da variante + auto-promo vigente **reusando o helper da
    Unidade B**;
  - retorna por variante `{ variantId, finalPriceCents }` (preço efetivo atual).
- `checkout-content.tsx`:
  - **no mount** (gatilho único; o preço unitário não muda com quantidade),
    chama `revalidateCartAction` com os itens do carrinho;
  - compara o `finalPriceCents` retornado com o snapshot;
  - se divergir, **silenciosamente** (decisão de produto: sem aviso ao cliente):
    1. usa os preços frescos no subtotal/desconto/total exibidos;
    2. **atualiza o snapshot no `localStorage`** via `cart-context` — senão a
       guarda `PRICE_TOLERANCE_CENTS` do `place-order` rejeitaria o submit;
  - aplica `Math.max(0, total)` no display do total (defesa contra total negativo
    com snapshot baixo + cupom alto).

**Interface:** `revalidateCartAction(input): Promise<{ ok: true; prices:
Array<{ variantId: string; finalPriceCents: number }> } | { ok: false; error }>`.
_Nota 2026-09-28: o retorno de sucesso hoje também traz `unavailable: string[]`._

**Fronteira:** o action é a única fonte de preço fresco; o componente só
reconcilia display + snapshot. A regra de auto-promo não é reimplementada aqui —
vem de B.

**Verificação:** smoke live na rota `/checkout` (porta 3008) — cenário do repro
do #57 (item com auto-promo expirada): subtotal exibido bate com o preço real e
com o desconto do cupom; total nunca negativo; submit passa sem
`"Preços atualizados, refaça o checkout"`.

---

## Fase final — Handoff issue no `emach-dashboard` (itens 1 e 4)

**Após o PR deste repo ser aberto.** Criar um issue no `emach-dashboard` (conteúdo
estruturado com a skill `handoff`), citando a nossa issue **#57** e o **PR** novo,
explicando o porquê e o "como":

- **Item 1 (imediato/crítico):** commitar `order.coupon_id` em
  `packages/db/src/schema/orders.ts` do dashboard — coluna já existe no DB
  compartilhado e a edição está no working tree de lá sem commit. Sem isso,
  `db:check-drift` acusa drift e um `db:push` do dashboard tentaria **dropar** a
  coluna. Forma exata:
  ```ts
  // order, após discountAmount:
  couponId: text("coupon_id").references(() => promotion.id, { onDelete: "set null" }),
  ```
- **Item 4 (semântica):** documentar que `order.discountAmount` captura **só o
  cupom** — a economia da auto-promo já está embutida no `subtotalAmount` (snapshot
  de preço por item). Relatórios de margem/desconto no dashboard que lerem
  `discountAmount` como "desconto total concedido" vão subcontar. Derivar a
  economia de auto-promo, se necessário, comparando `order_item.unit_price` com o
  preço de catálogo na data.

## Fora de escopo

- Unificar de fato o SQL de `catalog.ts` com o helper TS (exigiria o helper
  nascer no dashboard e ser sincronizado — proposta opcional, não nesta rodada).
- Migrar o incremento de `redemption_count` para um webhook de `paid` (depende do
  Asaas, ainda inexistente).
- Qualquer mudança de UX além da revalidação silenciosa (sem aviso, por decisão).
