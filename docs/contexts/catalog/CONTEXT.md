# Catalog

O que a EMACH vende: o cadastro de itens, suas variantes compráveis, a árvore de categorias e as especificações técnicas. Escrito pelo dashboard; o storefront só lê.

## Language

**Tool**:
A entidade-pai do catálogo — um item à venda (ferramenta elétrica ou manual, EPI, instrumento de medição ou acessório).
_Avoid_: Product, Item, Produto

**Variant**:
Uma forma comprável concreta de um **Tool** — combina voltagem e preço próprios. O custo foi removido do sistema (#119); a **Variant** não guarda custo. Um **Tool** tem no máximo uma **Variant** padrão (índice único parcial `tool_variant_one_default_per_tool`). O banco não exige que um **Tool** tenha **Variant** nem padrão; um rascunho (`status = 'draft'`) pode não ter nenhuma. Se o gate de publicação do dashboard exige variante: não verificado. É a **Variant**, não o **Tool**, que é a unidade de venda e de estoque.
Só é vendável a **Variant** com `visible_on_site = true` e `price_amount` preenchido; sem preço ou oculta, ela some da página do produto e é recusada no cupom, na revalidação do carrinho, no `placeOrder` e na recompra. `price_amount` e `barcode` são nulos em rascunho. Um **Tool** sem peso e dimensões tem frete "a combinar" (o CHECK `active_requires_shipping_data` só exige esses campos quando `status = 'active'`).
_Avoid_: SKU (como nome da entidade)

**SKU**:
O código único de controle de estoque de uma **Variant**. É um atributo da **Variant**, não a **Variant** em si.

**Category**:
Um nó na árvore hierárquica de categorias (profundidade máxima 5; `path` e `depth` são calculados por trigger e o ciclo é barrado). Uma **Category** inativa (`is_active = false`) fica fora das consultas da vitrine. Um **Tool** pode estar em várias, e no máximo uma delas é a primária (`tool_category.is_primary`).

**Attribute**:
Uma definição de especificação técnica (voltagem, torque, RPM, peso…) associada a uma **Category**. O valor concreto de um **Attribute** para um **Tool** é separado da definição.
_Avoid_: Spec, Especificação, Feature

**Supplier**:
O fornecedor de quem o estoque é comprado (proveniência da entrada de compra).
_Avoid_: Vendor, Fabricante (o fabricante é `manufacturer_name`, um campo livre — não é o **Supplier**)

**Primary image** (imagem primária):
A imagem que representa um **Tool** nas listagens do storefront (previews de pedido, devolução e recompra): a primeira por `sortOrder`. É um atributo do **Tool**, não da **Category** — um **Tool** classificado em mais de uma **Category** (X e Y) exibe a mesma imagem primária sob qualquer uma delas.
_Avoid_: thumbnail, foto principal

## Relationships

- Um **Tool** tem zero ou mais **Variants** (um rascunho pode não ter nenhuma); no máximo uma é a **Variant** padrão
- Uma **Variant** pertence a exatamente um **Tool**
- Um **Tool** é classificado em uma ou mais **Categories**
- Uma **Category** tem no máximo uma **Category** pai (árvore)
- Um **Attribute** é definido para uma **Category**; um **Tool** carrega valores de **Attribute**
- Um **Supplier** se liga ao estoque, não ao **Tool**: cada **Stock Movement** de entrada por compra (`entrada_compra`) registra o `supplier_id` de origem. O **Tool** não guarda fornecedor.

## Example dialogue

> **Dev:** "Quando o cliente adiciona algo ao carrinho, ele escolhe o **Tool** ou a **Variant**?"
> **Domain expert:** "A **Variant** — é ela que tem preço e estoque. O **Tool** é o agrupamento que ganha uma página; a página deixa o cliente escolher entre as **Variants** (127V, 220V…)."
> **Dev:** "E o **Attribute** 'torque' vale para qualquer **Tool**?"
> **Domain expert:** "Não — um **Attribute** é definido por **Category**. Furadeiras têm torque; um capacete de EPI não."

## Flagged ambiguities

- "Product" é usado na camada de apresentação do storefront (rota `/product/[slug]`, componentes `product-*`) para significar **Tool** — resolvido: o termo canônico é **Tool**; "Product" é drift de apresentação a reconciliar.
- "Tool" é impreciso como guarda-chuva — o catálogo inclui EPIs e acessórios que não são ferramentas. Aceito deliberadamente: renomear custaria uma migration cross-repo para ganho marginal.
