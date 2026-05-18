# Context Map

O domínio EMACH é servido por dois apps que compartilham uma única base PostgreSQL (Supabase): o **storefront** (`emach-ecommerce`, este repo) e o **dashboard** (`emach-dashboard`, repo irmão). Este mapa descreve os bounded contexts do sistema inteiro e anota qual app escreve em cada um.

> A DB real é a fonte de verdade. Os schema files em `packages/db/src/schema/` são um espelho versionado e podem estar defasados — ver `docs/agents/domain.md`.

## Contexts

- [Catalog](./docs/contexts/catalog/CONTEXT.md) — o que está à venda: ferramentas, variantes (SKU), categorias, atributos técnicos, fornecedores. _Escrito pelo dashboard; o storefront só lê._
- [Customer Accounts](./docs/contexts/customer-accounts/CONTEXT.md) — identidade do cliente brasileiro (B2C/B2B) e seus endereços. _Escrito pelo storefront._
- [Staff Access](./docs/contexts/staff-access/CONTEXT.md) — identidade, papéis e filiais do staff interno. _Escrito pelo dashboard._
- [Ordering](./docs/contexts/ordering/CONTEXT.md) — pedidos, itens e o ciclo de vida do pedido. _Criado pelo storefront no checkout; o ciclo de vida é conduzido pelo dashboard._
- [Inventory](./docs/contexts/inventory/CONTEXT.md) — filiais, níveis de estoque e o ledger de movimentos. _Gerido pelo dashboard; o storefront debita na venda._
- [Promotions](./docs/contexts/promotions/CONTEXT.md) — descontos automáticos e cupons aplicados ao catálogo. _Escrito pelo dashboard._
- [Reviews](./docs/contexts/reviews/CONTEXT.md) — avaliações de produto por clientes, moderadas pelo staff. _Criado pelo storefront; moderado pelo dashboard._
- [Data Governance](./docs/contexts/data-governance/CONTEXT.md) — tratamento lícito de dados pessoais (LGPD): consentimento, auditoria, exportação e anonimização. _Escrito por ambos._

## Relationships

- **Catalog → Ordering**: um **Order Item** referencia um **Tool** e uma **Variant** por id e snapshota nome, SKU, voltagem, dados fiscais (NCM/CEST) e dimensões no momento da compra. O preço de venda é derivado do preço-base da **Variant**.
- **Catalog ↔ Inventory**: um **Stock Level** é mantido por par (**Variant**, **Branch**). Inventory rastreia estoque da unidade-de-venda do Catalog.
- **Catalog ↔ Promotions**: uma **Promotion** liga-se a um ou mais **Tools** (`promotion_tool`) e aplica um desconto percentual no nível do **Tool**.
- **Ordering → Inventory**: a criação de um **Order** debita o **Stock Level** e grava um **Stock Movement** (`saida_venda`, ator `system`) na mesma transação. O cancelamento/estorno/devolução de um **Order** — conduzido pelo dashboard — credita o estoque de volta com um **Stock Movement** inverso. `stock_movement` é o ledger compartilhado entre os dois contextos. Ver ADR-0001.
- **Customer Accounts → Ordering**: um **Order** pertence a exatamente um **Client**; o checkout snapshota um **Address** do cliente em `order.shipping_address`.
- **Customer Accounts ↔ Data Governance**: Data Governance audita, exporta e anonimiza os dados de um **Client**; o checkout registra o **Consent** do cliente.
- **Ordering ↔ Reviews**: uma **Review** referencia obrigatoriamente um **Order** — só se avalia um produto efetivamente comprado.
- **Catalog ↔ Reviews / Customer Accounts ↔ Reviews**: uma **Review** é escrita por um **Client** sobre um **Tool**; é única por (**Client**, **Tool**, **Order**).
- **Staff Access ↔ Inventory**: um membro do **Staff** é associado a uma ou mais **Branches** (`user_branch`); o dashboard gere estoque a partir dessas filiais.
- **Staff Access → Ordering**: o **Staff** conduz o ciclo de vida do **Order** (preparação, envio, cancelamento) e registra histórico e notas.
- **Staff Access → Promotions / Catalog / Reviews**: o **Staff** autora promoções, mantém o catálogo e modera reviews.

## Notas de fronteira

- **Cart** não é um contexto — é estado efêmero client-side (`localStorage`) no storefront. Um **Order** só passa a existir quando o checkout o cria, já em `pending_payment`.
- **Payment** não é um contexto próprio hoje — o estado de pagamento vive em `order.status` (`pending_payment`/`paid`/`payment_failed`) mais `payment_method`/`payment_provider_ref`. Tornar-se-á um contexto se entrar uma integração real com provedor de pagamento.
- **Shipping** não é um contexto — frete é calculado no checkout e seus dados ficam embutidos no **Order** (`shipping_*`).
- Não há integração via **API key** entre os apps: eles compartilham a DB diretamente. A tabela `api_key` não existe na DB real.
