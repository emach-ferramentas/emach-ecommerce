# Seção de promoção da home — layout adaptativo por contagem de produtos

**Data:** 2026-06-24
**Status:** implementado. Evidência: `apps/web/src/components/promo-highlight.tsx` escolhe o layout por `selectPromoLayout(promotion.tools.length)`.
**Área:** `apps/web` (storefront) + 1 ajuste de regra em `packages/db` (query de leitura)

## 1. Problema

A seção de promoção em destaque na home (`PromoHighlight`) renderiza os produtos
num grid fixo de 4 colunas (`ProductGrid` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).
Com 2 ou 3 produtos a seção fica visualmente quebrada (colunas vazias à direita),
e não há tratamento editorial por contagem.

### Causa raiz da invisibilidade observada (separar do escopo de UI)

Durante a investigação ficou claro que a promoção criada **não aparecia** na home
**não** por causa da quantidade de produtos, e sim porque
`getFeaturedPromotion` (`packages/db/src/queries/promotions.ts`) filtra por
**`featured = true`**, e nenhuma promoção no banco estava marcada como destacada.
O número 4 que parecia um "mínimo" é na verdade o **teto** `TOOLS_PER_PROMO = 4`
(`LIMIT 4` na query) — nunca houve mínimo de produtos.

> **Pré-requisito operacional (fora deste código):** marcar a promoção como
> `featured = true` é feito no `emach-dashboard` (promoção é tabela
> owned-by-dashboard). Sem isso a seção não aparece, independente do layout.
> Melhorar o aviso disso no dashboard é trabalho cross-repo → vira issue separada,
> fora desta spec.

## 2. Objetivo

Tornar a seção de promoção uma vitrine editorial que se adapta à contagem de
produtos (2, 3 ou 4), reaproveitando a estética atual (fundo preto, cards
`surface="elevated"` #242424, selo de desconto vermelho, cantos retos, voltagens,
tipografia Barlow) e os dados que o produto já carrega.

## 3. Decisões de design (aprovadas)

Unidade base nova: **card horizontal "text/img"** — imagem de um lado, bloco de
texto do outro, conteúdo distribuído verticalmente para não deixar espaço vazio.

| Nº de produtos | Layout | Observações |
|---|---|---|
| **< 2** | **Seção não renderiza** | Produto continua aparecendo nas listagens normais do catálogo, com seu desconto. |
| **2** | 2 cards horizontais **alternados** (espelhados), inline (1 linha) | 1º imagem à esquerda, 2º imagem à direita. Tratamento mais editorial. |
| **3** | 3 cards horizontais **iguais**, inline (1 linha) | Imagem 40% / texto 60%. Todos com imagem à esquerda. |
| **4** | **Grid vertical atual, sem mudança** | Mantém `ProductGrid` + `ProductCard` vertical. Em 4 colunas o horizontal espremeria o texto. |

### Regras transversais

- **Mínimo de 2:** com 0 ou 1 produto válido, a seção inteira some.
- **Sem espaço vazio:** no card horizontal a **imagem é elástica** (preenche a
  altura da célula) e o texto é distribuído com `justify-between` (bloco superior:
  categoria · nome · avaliação; bloco inferior: preço + economia + CTA).
- **Mobile:** todos os cards horizontais **colapsam para vertical** (imagem em cima,
  texto embaixo), igual ao card atual. O layout horizontal/inline é comportamento
  de desktop (`md:`/`lg:` para cima).
- **Dados reais, nada inventado** — o card horizontal usa o que o `ToolListItem` já
  traz:
  - avaliação: `avgRating` + `reviewCount` (estrelas)
  - selos de voltagem: `voltagesByTool` (já passado ao `PromoHighlight`)
  - economia em R$: `Number(priceAmount) - Number(discountedAmount)`
  - desconto %: já calculado hoje no `ProductCard`

## 4. Arquitetura de componentes

### 4.1 Novo: `PromoProductCard` (card horizontal)

`apps/web/src/components/promo-product-card.tsx` — Client Component (usa `useCart`
via `QuickAddButton`, igual ao `ProductCard`).

Props:

```ts
interface PromoProductCardProps {
  tool: ToolListItem;
  voltages?: Voltage[];
  /** Espelha o card (imagem à direita). Usado no 2º card do caso de 2. */
  mirrored?: boolean;
}
```

Estrutura (desktop):

- Container `grid md:grid-cols-[40%_1fr]` (ou `[1fr_40%]` quando `mirrored`).
- **Imagem** (`relative`, elástica — ocupa 100% da altura da célula via
  `h-full` + `object-cover` no `next/image`/`ProductImage`), com:
  - selo de desconto `-N%` (reuso da lógica `discountPercent`)
  - selos de voltagem (`bottom-left`, igual ao card atual)
  - `QuickAddButton` quando `inStock`; overlay "Esgotado" quando não.
- **Texto** (`flex flex-col justify-between`, `text-right` quando `mirrored`):
  - topo: `SectionLabel` (categoria) · nome · avaliação (estrelas + contagem)
  - base: preço + preço antigo riscado + selo "Economize R$ X" + CTA
- Mobile (`< md`): `grid-cols-1` / `flex-col` → imagem (aspect-square) em cima,
  texto embaixo; `mirrored` é ignorado (sempre imagem em cima).
- Stretched `Link` cobrindo o card (igual ao `ProductCard`), abaixo do quick-add.

A formatação de preço usa `fmtNumericBRL` (`@/lib/format`), igual ao card atual.

### 4.2 Modificar: `PromoHighlight`

`apps/web/src/components/promo-highlight.tsx` — passa a escolher o layout por
`promotion.tools.length`:

- `length === 2` → grid de 2 colunas com dois `PromoProductCard`; o segundo recebe
  `mirrored`.
- `length === 3` → grid de 3 colunas com três `PromoProductCard` (sem `mirrored`).
- `length >= 4` → mantém o `ProductGrid surface="elevated"` atual (vertical).
- `length < 2` → não renderiza a `<section>` (o gate principal está no `page.tsx`,
  ver 4.3; este `return null` interno é defesa em profundidade).

O cabeçalho (título + `PromoCountdown`) e o rodapé ("Ver todas as ofertas")
permanecem iguais.

### 4.3 Regra de mínimo: no storefront, não na query

`packages/db/src/queries/promotions.ts` é **owned-by-dashboard** e sincronizado via
CI (o arquivo veio do PR de sync #157). Editar `getFeaturedPromotion` aqui seria
sobrescrito pelo próximo sync. A regra "mínimo de 2 produtos" é **decisão de
apresentação do storefront**, então mora no storefront, **sem tocar o arquivo
sincronizado**.

`apps/web/src/app/(shop)/page.tsx` — gate de render:

```diff
- {featuredPromotion && (
+ {featuredPromotion && featuredPromotion.tools.length >= 2 && (
    <PromoHighlight promotion={featuredPromotion} voltagesByTool={voltagesByTool} />
  )}
```

`getFeaturedPromotion` continua retornando `null` só quando `tools.length === 0`
(sem mudança na query). O `PromoHighlight` também guarda internamente (`length < 2`
→ não renderiza a `<section>`) como defesa em profundidade.

## 5. Comportamento mobile

Todos os cards horizontais usam `grid-cols-1` no mobile e `md:grid-cols-[...]`
para cima. O caso de 2 some com o `mirrored` (ambos imagem-em-cima). O caso de 4
já é responsivo hoje (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).

## 6. Out of scope

- Aviso no dashboard quando uma promoção `featured` tem < 2 produtos (cross-repo).
- Mudar o teto `TOOLS_PER_PROMO = 4`.
- Layout para 5+ produtos (impossível hoje pelo `LIMIT 4`).
- Qualquer mudança em `catalog.ts` / `ToolListItem` (dashboard-owned).

## 7. Testes

- **Unit (componente):** render do `PromoProductCard` com/sem desconto, com/sem
  voltagens, `inStock` true/false, `mirrored` true/false (estrutura/classes).
- **Unit (seleção de layout):** `PromoHighlight` escolhe o arranjo certo para
  2, 3 e 4 produtos; não renderiza para < 2.
- **Gate de mínimo:** a home (`page.tsx`) não renderiza a seção quando a promoção
  featured tem < 2 produtos; renderiza com ≥ 2. (Sem teste de query — a regra mora
  no storefront, não em `getFeaturedPromotion`.)
- **Smoke visual** (obrigatório, CLAUDE.md): `bun dev:web` + visitar a home com
  promoção featured de 2, 3 e 4 produtos. `check-types` não pega layout quebrado.

## 8. Riscos / notas

- Alturas casadas entre cards na mesma linha dependem de `align-items: stretch`
  (default do grid) + imagem elástica. Validar com nomes de produto de 1 e 2 linhas.
- `QuickAddButton` é client; `PromoProductCard` precisa ser client (igual ao
  `ProductCard`) — não quebrar o boundary (sem `async` em client component).
- Conferir contraste dos selos/`SectionLabel tone="light"` sobre #242424 (já usado
  hoje no card elevated, deve manter).
