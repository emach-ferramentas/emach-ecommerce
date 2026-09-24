# Página de produto (PDP) — redesign com ritmo chiaroscuro

**Data:** 2026-06-11
**Status:** obsoleto. Substituído por `2026-07-03-pdp-redesign-design.md` (placa técnica), implementado em `apps/web/src/app/(shop)/product/[slug]/_components/plate-layout.ts`.
**Rota afetada:** `/product/[slug]` (`apps/web/src/app/(shop)/product/[slug]/`)

## Problema

A PDP é funcional mas pré-alinhamento ao ritmo claro/escuro do home. Pontos levantados
pelo usuário + confirmados em código e screenshot na app viva (`:3008`):

- **Breadcrumb no topo** ocupa a primeira faixa da página (`page.tsx:114-140`).
- **Ficha técnica clara e enorme** (`product-tabs.tsx`): layout de abas com sidebar
  (`min-h-[520px]`, `grid-cols-[280px_1fr]`) que fica **vazio** quando o produto tem
  poucas specs — e o banco hoje tem **1 a 4 specs por produto** (furadeira = 4, vários
  com 1). Não acompanha o chiaroscuro do home.
- **Aba "Entrega e Garantia"** (`product-tabs.tsx:189-204`) é **100% hardcoded** (texto
  genérico, não vem do banco). Redundante com os selos do bloco de compra.
- **Bug de formatação numérica:** `formatNumber`/`formatRange` fazem `String(v)` sobre
  `numeric(14,4)` do Postgres → renderiza `650.0000 W`, `0.0000 – 2800.0000 RPM` (ponto
  decimal, 4 zeros). Deveria ser PT-BR sem zeros: `650 W`, `até 2.800 RPM`.
- **Comentários claros e enxutos** (`product-reviews.tsx`): só média + nº + %recomendam,
  numa coluna; o dado `reviewStats.distribution` existe mas **não é exibido**.
- **Bloco de compra** (`product-info.tsx`): desconto sub-comunicado (só preço riscado),
  selos num box `bg-gray-10` sobre fundo `gray-10` (mesmo tom — não separa, viola
  DESIGN.md §superfície clara), cards de variante com 3ª linha poluída (SKU + "Padrão").

## Ordem das seções (ritmo claro/escuro/claro/escuro)

Confirmada com o usuário. Hoje: Breadcrumb → Detalhes → Ficha → Comentários → Relacionados.

| # | Seção | Superfície | Componente |
|---|---|---|---|
| 1 | **Detalhes** (galeria + compra) | claro (`gray-10`) | `ProductGallery` + `ProductInfo` |
| 2 | **Ficha técnica** | **escura** (cinema) | `ProductTabs` → vira `ProductSpecs` |
| 3 | **Você também pode gostar** | claro | `RelatedProducts` |
| 4 | **Comentários** | **escura** (cinema) | `ProductReviews` |

Mudanças de ordem vs. hoje: **breadcrumb removido**; **Relacionados sobe** para antes dos
Comentários (claro→escuro→claro→escuro). Editar a composição em `page.tsx`.

## Decisões por seção (confirmadas)

### 1. Detalhes — bloco de compra (`product-info.tsx`)

Mantém estrutura e **toda a lógica** (cart, variante, frete, share). Mudanças de
apresentação:

- **Badge de desconto + economia** (ADOTADO): quando há `activePromotion` com desconto,
  exibir selo `−15%` (vermelho, calculado de `baseCents` × `finalAmount`) ao lado do
  preço, e linha verde "Você economiza R$ X" (`base − final`). Sem promoção → nada.
- **Selos com borda hairline** (ADOTADO): trocar o box `bg-gray-10` por container com
  `border` hairline (`#e0e0e0`) e divisórias verticais; **3 selos**: Frete Brasil /
  Garantia 2 anos / **Compra segura (nota fiscal)** (3º novo). Segue DESIGN.md (card
  separa por borda, não por cor).
- **Variantes — card limpo** (ADOTADO):
  - Remover a 3ª linha (SKU + "· Padrão"). Card = **voltagem + preço**.
  - Label da seção: "Opções disponíveis" → **"Voltagem"**.
  - **Preço no card só quando difere** entre as variantes (se todas iguais, mostrar só a
    voltagem — o preço já está grande acima). Comparar `priceAmount` (pós-desconto) das
    variantes.
  - **Esgotado = tratamento visual**: card apagado (`opacity ~.45`), borda **tracejada**,
    preço riscado, tag "Esgotado" no canto. Não some; não é selecionável. (Hoje vira
    texto "· Esgotado".)
- **NÃO adotados** (descartados pelo usuário nesta entrega): indicador de status de
  estoque ("Em estoque · pronta entrega"); rating clicável que rola até os comentários.

Regra Ferrari Red preservada: **um** CTA `primary` (vermelho) — "Comprar agora".

### 2. Ficha técnica — seção escura (`product-tabs.tsx` → `ProductSpecs`)

Redesenho completo. **Sem abas.** Tema escuro tom cinema (radial
`#272727 → #0a0a0a → #000`, igual `.emach-bg-cinema` / `PromoHighlight`).

- **Layout 2 colunas full-bleed** com divisórias de ponta a ponta (grade contínua):
  - **Esquerda (~36%):** label "A ferramenta" + **descrição** (`tool.description`) +
    **selos** (Garantia 2 anos, Frete Brasil) + "Precisa de ajuda?" no rodapé.
    *(reaproveita o conteúdo da removida aba "Entrega e Garantia").*
  - **Direita (1fr):** contador "**N specs**" ancorado à direita + **instrumentos** (top
    3–4 specs por `sortOrder`, números grandes em Barlow Condensed) + **grid** denso
    (2 col, divisória central) com o restante.
- **Regra de escala** (dirigida pelos dados — resolve o problema de "poucas vs muitas"):
  - `≤ 4 specs` → só os instrumentos (sem grid).
  - `> 4 specs` → 3–4 instrumentos (primeiros por `sortOrder`) + grid com o resto.
- **Aba "Entrega e Garantia": REMOVIDA.** Vira os selos da coluna esquerda.
- **Aba "Descrição": absorvida** na coluna esquerda (não é mais aba).
- **Fix de formatação numérica** (`formatNumber`/`formatRange`): converter o `numeric`
  (string `"650.0000"`) para número e formatar PT-BR sem zeros à direita (`650`,
  `2.800`, `1,8`). Para `numeric_range` começando em 0 → "até {max}". Centralizar num
  helper (ex. `lib/format.ts > fmtSpecValue`).
- Tipografia legível sobre escuro: texto secundário ≥ `rgba(255,255,255,.66)`, corpo
  `~14–15px`.

### 3. Você também pode gostar (`related-products.tsx`)

Mantida (clara). Só **muda de posição** (sobe para antes dos comentários). Conteúdo e
grid de `ProductCard` inalterados.

### 4. Comentários — seção escura (`product-reviews.tsx`)

Tema escuro tom cinema (mesmo da ficha — coesão; "Você também pode gostar" clara entre
as duas evita que grudem).

- **Resumo full-width no topo**, 2 colunas internas:
  - Esquerda: média gigante (`avg`, Barlow Condensed) + estrelas + "`count` avaliações ·
    `recommend`% recomendam".
  - Direita: **barras de distribuição** por estrela (5★…1★), usando
    `reviewStats.distribution` (dado já disponível, hoje não exibido).
- **Lista de reviews em 2 colunas** (aproveitar o espaço; pedido do usuário), mesma grade
  de divisórias da ficha (linha entre reviews, divisória vertical central).
- Cada review: avatar de iniciais + nome + estrelas + data + texto.
- Manter ordenação (`ReviewSort`) e paginação existentes; só restilizar para o tema dark
  (botão "Ver mais"/paginação com tratamento claro sobre escuro).

## Galeria (`product-gallery.tsx`)

**Sem mudança estrutural.** O componente **já** vira carrossel vertical acima de 5
imagens (`MAX_STATIC_THUMBS = 5`); a furadeira aparece estática só porque tem 3 imagens.
Layout confirmado: **thumbs verticais à esquerda** (atual). Limiar de carrossel mantido
(setas só quando passa de 5 — evitar UI morta com poucas fotos). Nenhuma edição prevista
salvo ajuste fino de alinhamento, se necessário na verificação visual.

## Arquitetura / componentes

```
app/(shop)/product/[slug]/
  page.tsx                    (EDIT) remove breadcrumb; reordena: Detalhes → Specs → Related → Reviews
  _components/
    product-info.tsx          (EDIT) badge desconto + economia; selos hairline (3); variantes limpas + esgotado visual; label "Voltagem"
    product-tabs.tsx          (REWRITE→ product-specs.tsx) seção escura 2-col, sem abas, sem "Entrega e Garantia", fix numérico
    product-reviews.tsx       (EDIT) tema dark, resumo + barras de distribuição, lista 2 colunas
    related-products.tsx      (no-op de conteúdo; só reposicionado em page.tsx)
    product-gallery.tsx       (no-op previsto)
lib/format.ts                 (EDIT) helper fmtSpecValue (numeric PT-BR sem zeros) + reuso para range
```

- Renomear `ProductTabs` → `ProductSpecs` (não há mais abas; nome reflete o conteúdo).
  Atualizar import em `page.tsx`. Remover dep de `@emach/ui/components/tabs` se não usada
  em outro lugar.
- Reaproveitar tokens existentes: `--cinema-1/2/3`, classe `.emach-bg-cinema`,
  `SectionLabel tone="accent"`, `PageContainer`.

## Trabalho de dados (dev — para validar a ficha no app real)

A riqueza da ficha depende de `attribute_definition` + `tool_attribute_value`. As
definições de atributo são **owned-by-dashboard** (ADR-0009) — a fonte real é o dashboard.
Para validar o layout localmente nos dois extremos (poucas vs muitas specs), popular via
**seed dev** (idempotente): uma ferramenta "carregada" (~10 specs: potência, RPM,
impactos/min, torque, mandril, percussão, voltagem, peso, ruído, cabo) e manter casos de
3 specs. **Não** é mudança de schema; só dados. Marcar como passo separado da
implementação visual.

## Não-objetivos (fora de escopo)

- Não adicionar **novos** `attribute_definition` em produção (nasce no dashboard, ADR-0009).
- Não mexer em lógica de carrinho/frete/variante/promoção (só apresentação).
- Não implementar status de estoque textual nem rating-âncora (descartados nesta entrega).
- Não alterar o carrossel da galeria além de ajuste fino.

## Verificação

- `bun check-types` limpo.
- Smoke visual na app viva (`:3008`):
  - PDP sem breadcrumb; ordem Detalhes → Ficha(escura) → Relacionados(claro) →
    Comentários(escuro).
  - Ficha: numérico PT-BR (`650 W`, `até 2.800 RPM`); 2 colunas; sem aba "Entrega".
    Testar com produto de poucas specs (só instrumentos) **e** com o seed carregado
    (instrumentos + grid).
  - Bloco de compra: badge `−15%` + economia num produto em promoção; selos com borda;
    variante limpa; simular variante esgotada.
  - Comentários: dark, barras de distribuição, 2 colunas.
- `bun check-types` **não** pega SQL/coluna inválida em SSR — visitar as rotas afetadas.
