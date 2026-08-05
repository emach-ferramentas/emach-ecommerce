# Issue para o `emach-dashboard`: descrição estruturada e specs como atributo

> Redigida a partir do storefront (PR #213). **Abrir no `emach-dashboard`** — schema e
> cadastro de produto nascem lá (ADR-0009). Este arquivo é só o rascunho pronto para colar.

---

## Título

`feat(catalogo): separar descrição de especificações no cadastro de produto`

## Corpo

### Problema

O campo `tool.description` virou depósito. No produto `desempenadeira-eletrica-para-reboco-edp-1100w`
ele tem **1.890 caracteres**, e só ~620 são descrição:

| Pedaço | Tamanho | Onde deveria estar |
|---|---|---|
| Política de troca e devolução | 203 car. | Página de trocas — é da loja, não do produto |
| Título repetido do produto | ~95 car. | Já é o `tool.name` |
| **Descrição de verdade** (3 parágrafos) | ~620 car. | `description` |
| "Diferenciais" (5 bullets) | ~370 car. | Campo próprio, ou continua na descrição |
| "Especificações Técnicas" (8 linhas) | ~250 car. | `tool_attribute_value` |
| "Conteúdo da Embalagem" (5 itens) | ~180 car. | Campo próprio |
| Aviso do fornecedor (com typo "MAGENS") | ~130 car. | Rodapé do storefront, texto fixo da loja |

Consequências que já custaram trabalho:

1. **Duas fontes de verdade para spec, e elas divergem.** O texto diz "Velocidade sem carga:
   0 a 380 RPM"; a placa técnica, alimentada por `tool_attribute_value`, diz "até 380 RPM".
   O comprador vê os dois na mesma tela.
2. **A placa fica pela metade.** Este produto tem 4 atributos cadastrados, enquanto o texto lista
   8 specs. Marca, modelo, regulagem, frequência e tensão existem só como prosa — não filtram,
   não comparam, não entram em nenhuma query.
3. **A loja abre a descrição com uma negativa jurídica.** A primeira frase abaixo do preço é
   "resguarda-se no direito de não aceitar trocas".
4. **Só 2 produtos do catálogo têm `description` preenchida.** O padrão ainda não está formado —
   é a hora barata de decidir, antes de virar centenas de blobs colados.

O storefront já mitigou o que dava para mitigar do lado dele (PR #213 em `emach-ecommerce`):
quebra o texto em parágrafos respeitando as linhas em branco e agrupa itens de lista.
Ele **não** interpreta seção nem separa conteúdo, justamente porque isso é decisão de cadastro.

### O que se pede

**1. Campos separados em `tool`** (nomes a definir no design):

- `description` — passa a ser **só a descrição**: prosa sobre o que a ferramenta faz e para quem.
- `highlights` (`text[]` ou `jsonb`) — os "Diferenciais", um por item.
- `boxContents` (`text[]` ou `jsonb`) — o "Conteúdo da Embalagem", com quantidade e item.

Migração: os produtos existentes ficam com o blob inteiro em `description` até alguém editar.
Nada quebra — o storefront renderiza `description` do mesmo jeito e ignora campo vazio.

**2. Specs vão para `tool_attribute_value`, não para texto.** Marca, modelo, regulagem de
velocidade, frequência e tensão precisam de `attribute_definition` na categoria "Ferramentas
Elétricas". Já existe a estrutura certa (`input_type`, `unit`, `options`) — é cadastro, não schema.

**3. Aviso de "imagens ilustrativas" e política de troca saem do produto.** São texto fixo da
loja e devem viver no rodapé/página de política, não copiados em cada `description` (hoje com
o typo "MAGENS MERAMENTE ILUSTRATIVAS" propagado do fornecedor).

**4. Ajuda no cadastro para quem cola do marketplace.** O texto chega pronto do fornecedor;
o formulário precisa tornar fácil fazer a coisa certa. Sugestão: ao colar um blob em
`description`, oferecer a separação nos campos novos com preview — o operador confirma ou
descarta. Sem isso o campo volta a virar depósito na primeira semana.

### Fora de escopo

- Layout do storefront — já resolvido no PR #213.
- Tradução de opção de select: era **bug do storefront** (renderizava o `value` no lugar do
  `label`), já corrigido no mesmo PR. O dado do dashboard estava certo.

### Impacto no `emach-ecommerce`

Qualquer coluna nova em `tool` chega aqui pelo PR automático do `sync-db-schema.yml`. Enquanto
os campos novos vierem `NULL`, a PDP continua exatamente como está hoje. O consumo dos campos
(bloco "Na caixa", lista de diferenciais) é trabalho posterior, do lado da loja, e depende só
de este cadastro existir.
