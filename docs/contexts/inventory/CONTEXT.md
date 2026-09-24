# Inventory

As filiais, os níveis de estoque por filial e o ledger imutável de movimentos. Gerido pelo dashboard; o storefront só **valida** disponibilidade no checkout — o débito de estoque na venda está adiado para a integração de pagamento (ADR-0003).

## Language

**Branch**:
Uma localização física que mantém estoque. Não existe filial padrão no schema; a filial de origem do frete é escolhida no dashboard (ver **Shipping Origin Branch**).
_Avoid_: Warehouse, Loja, Depósito

**Stock Level**:
A quantidade de uma **Variant** mantida numa **Branch**. Identificado pelo par (**Variant**, **Branch**).
_Avoid_: Inventory (esse é o nome do contexto, não da quantidade)

**Stock Movement**:
Uma entrada imutável no ledger de estoque — um delta aplicado a um **Stock Level**, com quantidade anterior, nova, motivo e, quando aplicável, o **Order** que o originou.
_Avoid_: Transaction, Adjustment

**Reason**:
A classificação de um **Stock Movement**. A coluna `stock_movement.reason` é `text` livre, não enum. Valores gravados hoje: `entrada_compra` (entrada por compra ao fornecedor) e `ajuste_inventario` (ajuste de inventário). `saida_venda` (saída por venda) fica reservado para o débito na transição para `paid`.

**Reorder Point**:
O nível de **Stock Level** em que um novo pedido de compra ao **Supplier** deve ser feito.

**Minimum Quantity**:
O piso de estoque de segurança de um **Stock Level** — abaixo dele a situação é de ruptura crítica. É um limiar mais baixo e mais grave que o **Reorder Point**.
_Avoid_: confundir com **Reorder Point** — são limiares distintos

**Shipping Origin Branch**:
A **Branch** apontada por `store_settings.shipping_origin_branch_id`, escolhida no dashboard. Serve **só** como origem do frete: `getShippingSettings` devolve o `branch.cep` dela para a cotação Frenet no checkout (`apps/web/src/lib/shipping/quote.ts`). Sem filial configurada, ou com CEP inválido, a origem cai na env `FRENET_SELLER_CEP`. Não define de qual filial se lê ou debita estoque: desde o ADR-0003 o storefront valida o estoque **agregado** (`SUM` em todas as filiais).

## Relationships

- Um **Stock Level** pertence a uma **Branch** e rastreia uma **Variant**
- Um **Stock Movement** registra um delta contra um par (**Variant**, **Branch**)
- Um **Stock Movement** pode referenciar o **Order** / **Order Item** que o causou
- Um membro do **Staff** é associado a uma ou mais **Branches**

## Example dialogue

> **Dev:** "O storefront escolhe de qual **Branch** debitar?"
> **Domain expert:** "Hoje o storefront nem debita — ele só **valida** o estoque agregado (soma de todas as filiais) no checkout. O débito por filial virá com a integração de pagamento, na transição para `paid`. Múltiplas **Branches** existem no modelo, mas o débito é trabalho do storefront só a partir daí."
> **Dev:** "Quando o estoque cai abaixo do **Reorder Point**, falta produto?"
> **Domain expert:** "Ainda não — o **Reorder Point** é o gatilho para comprar mais. A falta crítica é quando cai abaixo da **Minimum Quantity**."

## Flagged ambiguities

- O storefront valida o estoque **agregado** entre todas as filiais (ADR-0003) e ainda não debita; a **Shipping Origin Branch** só define a origem do frete. O estoque multi-filial (leitura/débito por filial) é linguagem e responsabilidade do dashboard.
- `saida_venda` é um valor previsto de **Reason**, mas o storefront ainda **não grava** esse movimento — só passará a gravar no `paid`, com a integração de pagamento (ADR-0003).
