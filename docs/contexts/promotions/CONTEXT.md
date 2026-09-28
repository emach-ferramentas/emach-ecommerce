# Promotions

Os descontos aplicados ao catálogo — campanhas automáticas e cupons. Escrito pelo dashboard.

## Language

**Promotion**:
Uma campanha de desconto que incide sobre um ou mais **Tools**. É o termo guarda-chuva; toda **Promotion** é de uma das duas espécies abaixo.
_Avoid_: usar "promotion" para significar a espécie automática — ver ambiguidades

**Automatic Promotion**:
Uma **Promotion** cujo desconto é aplicado automaticamente aos **Tools** no seu escopo, sem o cliente digitar nada. O desconto vem embutido no preço da **Variant**. Só vale dentro da vigência (`starts_at` a `ends_at`) e com `active = true`. Se mais de uma **Automatic Promotion** cobre o mesmo **Tool**, vale a que dá o menor preço, sem empilhar. O `fixed` desconta um valor por unidade, com piso em zero. Uma delas pode ser a promoção em destaque da home (`featured`, no máximo uma).

**Promocode**:
Uma **Promotion** cujo desconto exige que o cliente informe um **Code** no checkout. **Implementado** (#56): `validateCoupon()` consulta a tabela `promotion` (código sem diferenciar maiúscula, `type = 'promocode'`, `active`, dentro de `starts_at`/`ends_at`), valida escopo, limite de uso e `min_order_amount`. O desconto e o pedido mínimo são calculados sobre o subtotal **elegível**: itens no escopo e **sem** **Automatic Promotion** vigente (o cupom não empilha com auto-promo). O `fixed` é limitado ao subtotal elegível. Falhas que revelam a existência do código (`invalid`, `expired`, `exhausted`) saem ao cliente como "Cupom inválido ou indisponível". Ao confirmar, o checkout trava a linha da promoção (`FOR UPDATE`), re-checa `max_redemptions`, grava `order.coupon_id` e incrementa `redemption_count` na mesma transação do pedido. Se o cliente cancela o pedido (`pending_payment`/`payment_failed`), o uso é devolvido (`redemption_count - 1`, piso zero).
_Avoid_: Coupon, Cupom, Voucher (no código/UI aparece "cupom"; no domínio é **Promocode**)

**Code**:
A string que identifica um **Promocode** e que o cliente digita para resgatá-lo.

**Discount Type / Value**:
O desconto de uma **Promotion** é descrito por `discount_type` (`percent` ou `fixed`) + `discount_value`. (O antigo `discount_pct` foi removido no redesenho de promoções — #54.)

**Scope**:
O conjunto de **Tools** sobre o qual uma **Promotion** incide (`promotion_tool`). Com `applies_to_all = true`, tanto uma **Automatic Promotion** quanto um **Promocode** incidem sobre todo o catálogo, sem escopo restrito (o **Promocode** ainda exclui os **Tools** que já têm **Automatic Promotion** vigente).

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
