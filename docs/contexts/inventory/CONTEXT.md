# Inventory

As filiais, os níveis de estoque por filial e o ledger imutável de movimentos. Gerido pelo dashboard; o storefront só **valida** disponibilidade no checkout — o débito de estoque na venda está adiado para a integração de pagamento (ADR-0003).

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
A **Branch** definida pela env `DEFAULT_BRANCH_ID`. Hoje serve **só** como **origem do frete**: `getOriginBranchCep()` (`apps/web/src/lib/origin-branch.ts`) busca o `branch.cep` dessa filial para a cotação SuperFrete no checkout. (Não existe `getDefaultBranchId()` nem `default-branch.ts`.) **Não** é mais a filial de leitura/débito de estoque — desde o ADR-0003 o storefront valida o estoque **agregado** (`SUM` em todas as filiais), sem fixar filial. A origem do frete migrará para `storeSettings.shippingOriginBranchId` (singleton admin-configurável): a tabela `store_settings` e a query `getShippingSettings` (origem + política de seguro `none`|`cart_value` + cap) **já chegaram sincronizadas** do dashboard (#119); falta só o swap `getOriginBranchCep → getShippingSettings` no storefront.

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

- O storefront valida o estoque **agregado** entre todas as filiais (ADR-0003) e ainda não debita; a `DEFAULT_BRANCH_ID` hoje só define a origem do frete. O estoque multi-filial (leitura/débito por filial) é linguagem e responsabilidade do dashboard.
- `saida_venda` está no enum de **Reason**, mas o storefront ainda **não grava** esse movimento — só passará a gravar no `paid`, com a integração de pagamento (ADR-0003).
