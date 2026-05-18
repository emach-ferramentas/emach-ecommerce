# Inventory

As filiais, os níveis de estoque por filial e o ledger imutável de movimentos. Gerido pelo dashboard; o storefront debita estoque na venda.

## Language

**Branch**:
Uma localização física que mantém estoque. Uma das **Branches** é a padrão.
_Avoid_: Warehouse, Loja, Depósito

**Stock Level**:
A quantidade de uma **Variant** mantida numa **Branch**. Identificado pelo par (**Variant**, **Branch**).
_Avoid_: Inventory (esse é o nome do contexto, não da quantidade)

**Stock Movement**:
Uma entrada imutável no ledger de estoque — um delta aplicado a um **Stock Level**, com quantidade anterior, nova, motivo e, quando aplicável, o **Order** que o originou.
_Avoid_: Transaction, Adjustment

**Reason**:
A classificação em texto livre de um **Stock Movement** — em uso: `entrada_compra` (entrada por compra ao fornecedor), `saida_venda` (saída por venda).

**Reorder Point**:
O nível de **Stock Level** em que um novo pedido de compra ao **Supplier** deve ser feito.

**Minimum Quantity**:
O piso de estoque de segurança de um **Stock Level** — abaixo dele a situação é de ruptura crítica. É um limiar mais baixo e mais grave que o **Reorder Point**.
_Avoid_: confundir com **Reorder Point** — são limiares distintos

**Default Branch**:
A única **Branch** a que o storefront fixa todas as leituras e débitos de estoque (`getDefaultBranchId()`).

## Relationships

- Um **Stock Level** pertence a uma **Branch** e rastreia uma **Variant**
- Um **Stock Movement** registra um delta contra um par (**Variant**, **Branch**)
- Um **Stock Movement** pode referenciar o **Order** / **Order Item** que o causou
- Um membro do **Staff** é associado a uma ou mais **Branches**

## Example dialogue

> **Dev:** "O storefront escolhe de qual **Branch** debitar?"
> **Domain expert:** "Não — o storefront usa sempre a **Default Branch**. Múltiplas **Branches** existem no modelo, mas só o dashboard trabalha com elas."
> **Dev:** "Quando o estoque cai abaixo do **Reorder Point**, falta produto?"
> **Domain expert:** "Ainda não — o **Reorder Point** é o gatilho para comprar mais. A falta crítica é quando cai abaixo da **Minimum Quantity**."

## Flagged ambiguities

- O storefront opera exclusivamente na **Default Branch**; o estoque multi-filial é real no modelo, mas é linguagem e responsabilidade do dashboard.
