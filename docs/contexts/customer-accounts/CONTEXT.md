# Customer Accounts

A identidade do cliente brasileiro do storefront e seus endereços de entrega. Owned-by-ecommerce: este é o único contexto cuja fonte de verdade é o storefront.

## Language

**Client**:
Uma pessoa ou empresa que compra na loja. É distinto de **User** — **User** é staff interno (contexto Staff Access). Não há tipo "Session" genérico entre os dois.
_Avoid_: User, Customer, Buyer, Usuário

**Client Type**:
Se o **Client** é `b2c` (pessoa física, identificada por CPF) ou `b2b` (pessoa jurídica, identificada por CNPJ). É derivado do **Document**, não escolhido manualmente.

**Document**:
O CPF (de um **Client** `b2c`) ou CNPJ (de um **Client** `b2b`). Persistido só com dígitos, após validação de dígito verificador.
_Avoid_: CPF/CNPJ como termos separados — o conceito unificado é **Document**

**Client Status**:
A situação de um **Client**: `active`, `inactive` ou `blocked`. Distinto do status de um **User** do staff.

**Address**:
Um endereço de entrega pertencente a um **Client**. Um deles é o padrão. No checkout, um **Address** é snapshotado dentro do **Order** — o pedido não acompanha edições posteriores.
_Avoid_: Endereço, Location

## Relationships

- Um **Client** tem zero ou mais **Addresses**; no máximo um é o padrão
- Um **Client** tem um **Client Type** derivado do seu **Document**
- Um **Client** faz zero ou mais **Orders**
- Os dados de um **Client** são auditados, exportáveis e anonimizáveis pelo contexto Data Governance

## Example dialogue

> **Dev:** "Quando a `session` me dá `session.user.id`, isso é um **User**?"
> **Domain expert:** "Não — na instância ecommerce do Better Auth, `session.user` é o **Client**. **User** é staff, vive no outro contexto e nunca se cruza com **Client**."
> **Dev:** "O cliente escolhe se é B2B?"
> **Domain expert:** "Não escolhe — o **Client Type** sai do **Document**: CPF é `b2c`, CNPJ é `b2b`."

## Flagged ambiguities

- O Better Auth expõe o **Client** na sessão como `session.user` — colisão de nome com **User** (staff). Resolvido: o termo de domínio é **Client**; `session.user` é nomenclatura da biblioteca.
- O contexto chama-se "Customer Accounts" mas a entidade é **Client** — "Customer" é só o rótulo em inglês do contexto; a entidade nunca é "Customer".
