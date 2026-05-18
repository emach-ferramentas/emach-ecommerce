# Staff Access

A identidade, os papéis e as filiais do staff interno da EMACH. Inteiramente owned-by-dashboard — o storefront nunca toca este contexto (invariante P0: nunca importar `@emach/db/schema/auth` nem `@emach/auth/dashboard`).

## Language

**User**:
Um membro do staff interno. É distinto de **Client** — **Client** é quem compra na loja. Os dois nunca se cruzam: instâncias de auth, tabelas e tipos de sessão isolados.
_Avoid_: Client, Customer, Staff Member como termo separado, Funcionário

**Role**:
O nível de privilégio de um **User**: `super_admin`, `admin`, `manager` ou `user`. As regras concretas de autorização de cada **Role** são linguagem do dashboard.

**User Status**:
A situação de um **User**: `pending` (aguardando ativação), `active` ou `suspended`. Distinto do **Client Status** do contexto Customer Accounts.

**Branch Assignment**:
A associação entre um **User** e as **Branches** em que ele opera (`user_branch`). Owned-by-dashboard.

## Relationships

- Um **User** tem exatamente uma **Role** e um **User Status**
- Um **User** é associado a zero ou mais **Branches** via **Branch Assignment**
- Um **User** conduz o ciclo de vida de **Orders**, modera **Reviews**, autora **Promotions** e mantém o Catalog

## Example dialogue

> **Dev:** "O **User** com **Role** `user` é um cliente comum?"
> **Domain expert:** "Não — `user` ali é o **Role** de menor privilégio do staff. Cliente é **Client**, vive em outro contexto e nem aparece nesta tabela."

## Flagged ambiguities

- "user" é sobrecarregado: é o nome da entidade **User** e também o valor de menor privilégio do enum `user_role`. Resolvido: a entidade é **User**; o **Role** mínimo escreve-se sempre como o valor `user`, nunca como "o user".
- "User" colide com **Client** entre contextos — ver a ambiguidade registrada em Customer Accounts. **User** = staff; **Client** = comprador; jamais intercambiáveis.
