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
O estágio de um **Order** no seu ciclo de vida. Valores: `pending_payment` → `paid` → `preparing` → `shipped` → `delivered`; mais os desvios `payment_failed`, `canceled` (encerrado antes do envio), `returned` (mercadoria devolvida após a entrega) e `refunded` (valor estornado). O **Client** também cancela pelo portal (`cancelOrderAction`), mas só em `pending_payment` ou `payment_failed`; o cancelamento grava **Status History** com ator `system` e motivo "Cancelado pelo cliente" e devolve o uso do cupom. Depois do pagamento, o cancelamento é do staff.

**Status History**:
A trilha de transições de **Order Status** — de/para, ator e motivo de cada mudança.

**Order Note**:
Uma anotação interna do staff sobre um **Order**. Não é visível ao cliente. Guarda `status_at_creation` (status do pedido no momento da nota) e pode ser fixada (`pinned`).

**Shipping**:
O frete do **Order**, cotado no checkout via **Frenet**. A origem é o CEP da filial em `store_settings.shipping_origin_branch_id` (`getShippingSettings`), com fallback para a env `FRENET_SELLER_CEP`. Snapshota `shipping_amount`, `shipping_method`, `shipping_service_code` (serviço Frenet escolhido) e, após o envio, `shipping_tracking_code`. A cotação é _fail-open_ só para falha de infraestrutura: Frenet fora do ar ou timeout, CEP de destino que a Frenet não conhece, ou pedido sem CEP de destino válido não bloqueiam a compra e marcam `shipping_unverified = true` para o staff revisar. Já "frete a combinar" (sem caixa, sem peso/dimensões ou sem serviço cotável) e frete adulterado (serviço+preço que não bate com a cotação re-feita no servidor) recusam o pedido. O carrinho é consolidado em caixas reais (`shipping_box`) antes da cotação. O valor declarado do seguro segue `store_settings.shipping_insurance_policy` (`none` não declara; `cart_value` declara o subtotal verificado até `shipping_insurance_cap_amount`). A cotação é cacheada no Redis, então o re-quote do checkout reutiliza a exibida ao cliente.

**Coupon / Discount**:
Um **Order** pode ter um **Coupon** aplicado (`coupon_id` → uma **Promotion** do tipo promocode), cujo valor de desconto é gravado em `discount_amount`. ⚠️ Desconto **automático** de promoção (auto-promo) já vem embutido no preço da **Variant** e **não** entra em `discount_amount` — senão contaria em dobro na margem.

**Refund Request**:
A solicitação de **devolução/reembolso** de um **Order**, criada pelo **Client** no portal e conduzida pelo staff. Tem motivo (`refund_reason`: `defeito`/`item_errado`/`avaria_transporte`/`arrependimento`/`outro`) e status próprio (`refund_status`: `requested` → `under_review` → `approved` → `refunded`, ou `rejected`). É uma entidade separada (`refund_request`) — distinta do **Order Status** — com no máximo uma ativa por pedido. O **Client** só pode solicitar com o pedido em `shipped` ou `delivered`. A solicitação snapshota o total do pedido em `amount`, nasce em `requested` com ator `system` (o cliente não é `user` do staff) e aceita um texto livre de até 2000 caracteres. "Ativa" = `requested`, `under_review` ou `approved` (`ACTIVE_REFUND_STATUSES`); `refunded` e `rejected` liberam nova solicitação.

**Order Event**:
Evento operacional do ciclo de vida (`order_event`). Tipos: `tracking_set`, `branch_assigned`, `shipping_reviewed` (staff revisou um frete marcado `shipping_unverified`) e `ship_forced` (envio forçado por `super_admin` sem separação concluída). É a trilha de auditoria complementar ao **Status History**. **Order Attachment** guarda anexos do pedido. Campos fiscais (`nfe_number`, `nfe_series`, `nfe_access_key` com 44 dígitos, `nfe_url`, `nfe_xml_url`, `nfe_status`) e `payment_receipt_url`: o storefront só lê. Quem os grava (dashboard ou provedor fiscal) não está fixado no espelho: o comentário de `orders.ts` atribui `nfe_series`/`nfe_access_key` ao "ecommerce/provedor fiscal". Quando `nfe_status` vira `cancelled`, o trigger `order_nfe_cancelled_note` cria uma **Order Note** automática (sem autor).

**Order Picking**:
A separação física do **Order** numa **Branch** (`order_picking`, com itens `order_picking_item` e leituras de código de barras `order_picking_scan`). Status `in_progress`, `completed`, `exception`, `canceled`; no máximo uma em andamento por pedido (`order_picking_one_active`). Conduzida pelo dashboard.

**Checkout**:
O processo do storefront que transforma um **Cart** num **Order**, numa única transação. Exige cliente logado com e-mail verificado e respeita rate limit por cliente. O preço de cada item é revalidado no servidor (auto-promo incluída, tolerância de 1 centavo). Também grava nome, telefone e **Document** no **Client** e registra o **Consent** (`tos`, `privacy`, `marketing_email`).

**Cart**:
A seleção efêmera de **Variants** do storefront antes do checkout — vive em `localStorage`, não é persistida e não é um **Order**.

## Relationships

- Um **Order** pertence a exatamente um **Client** e é atendido por uma **Branch**
- Um **Order** tem um ou mais **Order Items**
- Um **Order** pode ter **Order Pickings**
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
