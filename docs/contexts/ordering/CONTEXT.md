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
Uma anotação interna do staff sobre um **Order**. Não é visível ao cliente.

**Checkout**:
O processo do storefront que transforma um **Cart** num **Order**.

**Cart**:
A seleção efêmera de **Variants** do storefront antes do checkout — vive em `localStorage`, não é persistida e não é um **Order**.

## Relationships

- Um **Order** pertence a exatamente um **Client** e é atendido por uma **Branch**
- Um **Order** tem um ou mais **Order Items**
- Um **Order Item** referencia um **Tool** e uma **Variant** do Catalog
- Um **Order** acumula entradas de **Status History** e **Order Notes**
- Criar um **Order** debita estoque do Inventory na mesma transação (ver ADR-0001)

## Example dialogue

> **Dev:** "Quando o cliente está montando o **Cart**, isso é um **Order** com status de rascunho?"
> **Domain expert:** "Não — **Cart** não é **Order**. O **Order** só nasce quando o **Checkout** o cria, já em `pending_payment`. Não existe **Order** rascunho."
> **Dev:** "E se o cliente devolve um produto e a gente estorna?"
> **Domain expert:** "A mercadoria volta primeiro — `returned` — e depois o dinheiro — `refunded`. São dois estágios."

## Flagged ambiguities

- `returned` e `refunded` são estágios sequenciais do mesmo fluxo (devolução → estorno), mas o enum `order_status` os modela como valores planos mutuamente exclusivos — um **Order** não consegue registrar que passou por ambos. Limitação conhecida do modelo.
- "Payment" não tem linguagem própria: o estado de pagamento vive dentro de **Order Status** (`pending_payment`/`paid`/`payment_failed`). Não há contexto de Pagamento — ver `CONTEXT-MAP.md`.
