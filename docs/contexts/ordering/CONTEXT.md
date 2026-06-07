# Ordering

Os pedidos de compra e seu ciclo de vida. O storefront cria um pedido no checkout; o dashboard conduz o ciclo de vida dali em diante.

## Language

**Order**:
A compra confirmada de um **Client** — criada no momento do checkout, já com pagamento pendente. Antes disso não existe **Order**.
_Avoid_: Purchase, Pedido, Transaction

**Order Item**:
Uma linha de um **Order**. Snapshota nome, SKU, voltagem, dados fiscais e dimensões da **Variant** no momento da compra — não acompanha mudanças posteriores no Catalog.
_Avoid_: Line Item, Cart Item (um **Cart Item** vira um **Order Item** só no checkout)

**Order Number**:
O identificador legível e voltado ao cliente de um **Order**, no formato `AAAA-NNNNNN`, gerado pela sequência `order_number_seq`. É distinto do id interno (UUID).

**Order Status**:
O estágio de um **Order** no seu ciclo de vida. Valores: `pending_payment` → `paid` → `preparing` → `shipped` → `delivered`; mais os desvios `payment_failed`, `canceled` (encerrado antes do envio), `returned` (mercadoria devolvida após a entrega) e `refunded` (valor estornado).

**Status History**:
A trilha de transições de **Order Status** — de/para, ator e motivo de cada mudança.

**Order Note**:
Uma anotação interna do staff sobre um **Order**. Não é visível ao cliente. Guarda `status_at_creation` (status do pedido no momento da nota) e pode ser fixada (`pinned`).

**Shipping**:
O frete do **Order**, **cotado no checkout via SuperFrete** (origem = CEP da filial `DEFAULT_BRANCH_ID` via `getOriginBranchCep`). Snapshota `shipping_amount`, `shipping_method` (transportadora escolhida) e, após o envio, `shipping_tracking_code`. A cotação é _fail-open_ — falha da API não bloqueia a compra. (A config de origem/seguro `store_settings`/`getShippingSettings` já chegou sincronizada do dashboard; o swap no storefront é pendente.)

**Coupon / Discount**:
Um **Order** pode ter um **Coupon** aplicado (`coupon_id` → uma **Promotion** do tipo promocode), cujo valor de desconto é gravado em `discount_amount`. ⚠️ Desconto **automático** de promoção (auto-promo) já vem embutido no preço da **Variant** e **não** entra em `discount_amount` — senão contaria em dobro na margem.

**Refund Request**:
A solicitação de **devolução/reembolso** de um **Order**, criada pelo **Client** no portal e conduzida pelo staff. Tem motivo (`refund_reason`: `defeito`/`item_errado`/`avaria_transporte`/`arrependimento`/`outro`) e status próprio (`refund_status`: `requested` → `under_review` → `approved` → `refunded`, ou `rejected`). É uma entidade separada (`refund_request`) — distinta do **Order Status** — com no máximo uma ativa por pedido.

**Order Event**:
Evento operacional do ciclo de vida (`order_event`, tipos `tracking_set`/`branch_assigned`) — trilha de auditoria complementar ao **Status History**. **Order Attachment** guarda anexos do pedido; campos fiscais (`nfe_number`/`nfe_url`/`nfe_xml_url`/`nfe_status`) e `payment_receipt_url` são preenchidos pelo dashboard.

**Checkout**:
O processo do storefront que transforma um **Cart** num **Order**.

**Cart**:
A seleção efêmera de **Variants** do storefront antes do checkout — vive em `localStorage`, não é persistida e não é um **Order**.

## Relationships

- Um **Order** pertence a exatamente um **Client** e é atendido por uma **Branch**
- Um **Order** tem um ou mais **Order Items**
- Um **Order Item** referencia um **Tool** e uma **Variant** do Catalog
- Um **Order** snapshota **Shipping** (amount/method/tracking) e pode referenciar um **Coupon** (`coupon_id`)
- Um **Order** pode ter uma **Refund Request** (criada pelo cliente, conduzida pelo staff)
- Um **Order** acumula **Status History**, **Order Notes**, **Order Events** e **Order Attachments**
- Criar um **Order** apenas **valida** estoque agregado do Inventory (`SUM` em todas as filiais); o **débito** é adiado para a transição `pending_payment → paid` (ainda não cabeada — pagamento é stub). Ver ADR-0003 (supersede o ADR-0001 de débito-na-criação) e ADR-0007 do dashboard.

## Example dialogue

> **Dev:** "Quando o cliente está montando o **Cart**, isso é um **Order** com status de rascunho?"
> **Domain expert:** "Não — **Cart** não é **Order**. O **Order** só nasce quando o **Checkout** o cria, já em `pending_payment`. Não existe **Order** rascunho."
> **Dev:** "E se o cliente devolve um produto e a gente estorna?"
> **Domain expert:** "A mercadoria volta primeiro — `returned` — e depois o dinheiro — `refunded`. São dois estágios."

## Flagged ambiguities

- `returned` e `refunded` são estágios sequenciais do mesmo fluxo (devolução → estorno), mas o enum `order_status` os modela como valores planos mutuamente exclusivos — um **Order** não consegue registrar que passou por ambos. O detalhe do fluxo de devolução vive em **Refund Request** (com seu próprio `refund_status`); o `order_status` reflete só o resultado final.
- "Payment" não tem linguagem própria: o estado de pagamento vive dentro de **Order Status** (`pending_payment`/`paid`/`payment_failed`). Não há contexto de Pagamento — ver `CONTEXT-MAP.md`.
