# Promotions

Os descontos aplicados ao catálogo — campanhas automáticas e cupons. Escrito pelo dashboard.

## Language

**Promotion**:
Uma campanha de desconto que incide sobre um ou mais **Tools**. É o termo guarda-chuva; toda **Promotion** é de uma das duas espécies abaixo.
_Avoid_: usar "promotion" para significar a espécie automática — ver ambiguidades

**Automatic Promotion**:
Uma **Promotion** cujo desconto é aplicado automaticamente aos **Tools** no seu escopo, sem o cliente digitar nada. O desconto vem embutido no preço da **Variant**.

**Promocode**:
Uma **Promotion** cujo desconto exige que o cliente informe um **Code** no checkout. **Implementado** (#56): `validateCoupon()` consulta a tabela `promotion`, valida escopo, expiração, `min_order_amount` e limite de uso; ao confirmar, o checkout grava `order.coupon_id` e incrementa `redemption_count` (com `FOR UPDATE`, idempotente).
_Avoid_: Coupon, Cupom, Voucher (no código/UI aparece "cupom"; no domínio é **Promocode**)

**Code**:
A string que identifica um **Promocode** e que o cliente digita para resgatá-lo.

**Discount Type / Value**:
O desconto de uma **Promotion** é descrito por `discount_type` (`percent` ou `fixed`) + `discount_value`. (O antigo `discount_pct` foi removido no redesenho de promoções — #54.)

**Scope**:
O conjunto de **Tools** sobre o qual uma **Promotion** incide (`promotion_tool`). Um **Promocode** com `applies_to_all = true` incide sobre todo o catálogo, sem escopo restrito.

**Limites de uso**:
`max_redemptions` (teto de resgates) + `redemption_count` (resgates feitos) e `min_order_amount` (valor mínimo do pedido) — validados no resgate de um **Promocode**.

## Relationships

- Uma **Promotion** incide sobre um ou mais **Tools** (seu **Scope**), ou sobre todo o catálogo se `applies_to_all`
- Uma **Promotion** é uma **Automatic Promotion** ou um **Promocode**
- Um **Promocode** tem um **Code**; uma **Automatic Promotion** não tem
- No checkout: o desconto da **Automatic Promotion** entra embutido no `unit_price` do **Order Item**; o do **Promocode** é gravado em `order.discount_amount`, com o pedido referenciando `order.coupon_id`

## Example dialogue

> **Dev:** "A **Promotion** aplica desconto na **Variant** ou no **Tool**?"
> **Domain expert:** "No **Tool** — o escopo é por **Tool**, e o percentual vale para todas as **Variants** dele."
> **Dev:** "O cliente digita um código para a **Automatic Promotion**?"
> **Domain expert:** "Não — automática não tem código. Só o **Promocode** exige o **Code**."

## Flagged ambiguities

- "Promotion" é sobrecarregado: é o nome da entidade e também o valor de tipo da espécie automática (`type='promotion'`). Resolvido: a entidade é **Promotion**; as espécies são **Automatic Promotion** e **Promocode** — não usar "promotion" cru para a espécie.
- O desconto de uma **Automatic Promotion** é embutido no `unit_price` do **Order Item** e **não** entra em `order.discount_amount`; já o **Promocode** é gravado em `order.discount_amount` (com `order.coupon_id`). Somar os dois contaria o auto-desconto em dobro na margem — a separação é proposital. Ver `lib/auto-promo.ts` (server-only).
