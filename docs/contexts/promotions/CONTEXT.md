# Promotions

Os descontos aplicados ao catálogo — campanhas automáticas e cupons. Escrito pelo dashboard.

## Language

**Promotion**:
Uma campanha de desconto que incide sobre um ou mais **Tools**. É o termo guarda-chuva; toda **Promotion** é de uma das duas espécies abaixo.
_Avoid_: usar "promotion" para significar a espécie automática — ver ambiguidades

**Automatic Promotion**:
Uma **Promotion** cujo desconto percentual é aplicado automaticamente aos **Tools** no seu escopo, sem o cliente digitar nada. É a única espécie que o checkout aplica hoje.

**Promocode**:
Uma **Promotion** cujo desconto exige que o cliente informe um **Code**. Termo vivo e pretendido — a implementação no storefront ainda é um stub (ver ambiguidades).
_Avoid_: Coupon, Cupom, Voucher

**Code**:
A string que identifica um **Promocode** e que o cliente digita para resgatá-lo.

**Discount Percentage**:
O percentual de desconto de uma **Promotion** (`discount_pct`).

**Scope**:
O conjunto de **Tools** sobre o qual uma **Promotion** incide.

## Relationships

- Uma **Promotion** incide sobre um ou mais **Tools** (seu **Scope**)
- Uma **Promotion** é uma **Automatic Promotion** ou um **Promocode**
- Um **Promocode** tem um **Code**; uma **Automatic Promotion** não tem
- No checkout, só **Automatic Promotions** são aplicadas; o desconto entra embutido no `unit_price` do **Order Item**

## Example dialogue

> **Dev:** "A **Promotion** aplica desconto na **Variant** ou no **Tool**?"
> **Domain expert:** "No **Tool** — o escopo é por **Tool**, e o percentual vale para todas as **Variants** dele."
> **Dev:** "O cliente digita um código para a **Automatic Promotion**?"
> **Domain expert:** "Não — automática não tem código. Só o **Promocode** exige o **Code**."

## Flagged ambiguities

- "Promotion" é sobrecarregado: é o nome da entidade e também o valor de tipo da espécie automática (`type='promotion'`). Resolvido: a entidade é **Promotion**; as espécies são **Automatic Promotion** e **Promocode** — não usar "promotion" cru para a espécie.
- **Promocode** é termo vivo, mas a implementação no storefront é um stub: a caixa "Cupom de desconto" do cart aplica 10% fixo hardcoded para qualquer string e o checkout ignora cupom — nenhum dos dois consulta a tabela `promotion`. Gap a implementar.
- O desconto de uma **Automatic Promotion** é embutido no `unit_price` do **Order Item**; `order.discount_amount` fica `"0"` — o **Order** não rastreia o desconto de promoção separadamente.
