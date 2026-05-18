# Catalog

O que a EMACH vende: o cadastro de itens, suas variantes compráveis, a árvore de categorias e as especificações técnicas. Escrito pelo dashboard; o storefront só lê.

## Language

**Tool**:
A entidade-pai do catálogo — um item à venda (ferramenta elétrica ou manual, EPI, instrumento de medição ou acessório).
_Avoid_: Product, Item, Produto

**Variant**:
Uma forma comprável concreta de um **Tool** — combina voltagem, preço e custo próprios. Toda **Tool** tem ao menos uma, e exatamente uma é a padrão. É a **Variant**, não o **Tool**, que é a unidade de venda e de estoque.
_Avoid_: SKU (como nome da entidade)

**SKU**:
O código único de controle de estoque de uma **Variant**. É um atributo da **Variant**, não a **Variant** em si.

**Category**:
Um nó na árvore hierárquica de categorias sob a qual um **Tool** é classificado.

**Attribute**:
Uma definição de especificação técnica (voltagem, torque, RPM, peso…) associada a uma **Category**. O valor concreto de um **Attribute** para um **Tool** é separado da definição.
_Avoid_: Spec, Especificação, Feature

**Supplier**:
O fornecedor de quem um **Tool** é adquirido.
_Avoid_: Vendor, Fabricante (o fabricante é `manufacturer_name`, um campo livre — não é o **Supplier**)

## Relationships

- Um **Tool** tem uma ou mais **Variants**; exatamente uma é a **Variant** padrão
- Uma **Variant** pertence a exatamente um **Tool**
- Um **Tool** é classificado em uma ou mais **Categories**
- Uma **Category** tem no máximo uma **Category** pai (árvore)
- Um **Attribute** é definido para uma **Category**; um **Tool** carrega valores de **Attribute**
- Um **Tool** é adquirido de no máximo um **Supplier**

## Example dialogue

> **Dev:** "Quando o cliente adiciona algo ao carrinho, ele escolhe o **Tool** ou a **Variant**?"
> **Domain expert:** "A **Variant** — é ela que tem preço e estoque. O **Tool** é o agrupamento que ganha uma página; a página deixa o cliente escolher entre as **Variants** (127V, 220V…)."
> **Dev:** "E o **Attribute** 'torque' vale para qualquer **Tool**?"
> **Domain expert:** "Não — um **Attribute** é definido por **Category**. Furadeiras têm torque; um capacete de EPI não."

## Flagged ambiguities

- "Product" é usado na camada de apresentação do storefront (rota `/product/[slug]`, componentes `product-*`) para significar **Tool** — resolvido: o termo canônico é **Tool**; "Product" é drift de apresentação a reconciliar.
- "Tool" é impreciso como guarda-chuva — o catálogo inclui EPIs e acessórios que não são ferramentas. Aceito deliberadamente: renomear custaria uma migration cross-repo para ganho marginal.
