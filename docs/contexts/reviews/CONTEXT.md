# Reviews

As avaliações de produto escritas por clientes e moderadas pelo staff. Criado pelo storefront; moderado pelo dashboard.

## Language

**Review**:
A avaliação de um **Tool** escrita por um **Client** — uma nota, um **título** e um texto. Toda **Review** está obrigatoriamente ligada a um **Order**: só se avalia um produto efetivamente comprado. É submetida pelo cliente no **Customer Portal** (`/dashboard/pedidos/[id]`, sheet por item) — **não** na página pública do produto.
_Avoid_: Rating (essa é só a nota), Comment, Feedback

**Rating**:
A nota numérica de uma **Review**. É um componente da **Review**, não a **Review** inteira.

**Review Window**:
O cliente só pode avaliar um **Tool** até **90 dias** após o `paid_at` do **Order** (`REVIEW_WINDOW_DAYS` em `packages/db/src/queries/reviews.ts`). Passado o prazo, a avaliação fica bloqueada.

**Review Status**:
A situação de moderação de uma **Review**: `pending` (aguardando moderação), `approved` (publicada), `rejected` (recusada) ou `spam` (lixo/bot). Só **Reviews** `approved` são visíveis publicamente no storefront.

**Moderation**:
O ato do staff de avaliar uma **Review** e levá-la de `pending` para `approved`, `rejected` ou `spam`. Registra o **Moderator**, o instante e uma nota de moderação.

**Moderator**:
O membro do **Staff** que moderou uma **Review** (`moderated_by`).

## Relationships

- Uma **Review** é escrita por um **Client** sobre um **Tool**
- Uma **Review** referencia obrigatoriamente o **Order** em que o **Tool** foi comprado
- Uma **Review** é única por (**Client**, **Tool**, **Order**) — um mesmo **Client** pode avaliar o mesmo **Tool** mais de uma vez se o comprou em **Orders** distintos
- Uma **Review** é moderada por um **Moderator** do contexto Staff Access

## Example dialogue

> **Dev:** "Qualquer **Client** pode avaliar qualquer **Tool**?"
> **Domain expert:** "Não — a **Review** exige um **Order**. Sem ter comprado, não avalia."
> **Dev:** "E se o cliente comprou a mesma furadeira duas vezes?"
> **Domain expert:** "Aí pode escrever duas **Reviews** — a unicidade é por (**Client**, **Tool**, **Order**), não por (**Client**, **Tool**)."

## Flagged ambiguities

- `rejected` e `spam` são ambos desfechos negativos de **Moderation** — `rejected` é uma **Review** legítima não publicada (ofensiva, fora de tópico); `spam` é lixo/bot. Distinção operacional do dashboard.
