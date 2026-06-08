# Redesign do catálogo: árvore de categorias, filtros ativos e toolbar

**Data:** 2026-06-08
**Rota:** `/catalog` (`apps/web/src/app/(shop)/catalog`)
**Escopo:** desktop apenas. Refinamento dentro do `DESIGN.md` (Ferrari-inspired) — evolução, não ruptura.

## Problema

A página de catálogo funciona, mas a **sidebar de categorias** é o ponto fraco: a árvore inteira é renderizada plana e **sempre 100% expandida** (`flattenTree` + indentação por `›` e `depth`). Com poucos níveis já fica comprida, plana e difícil de escanear; a hierarquia some no meio do ruído. Faltam ainda:

- **Feedback de filtros ativos** — não há como ver/remover o que está aplicado (categoria, voltagem, preço, promoção) sem mexer em cada controle.
- **Contagem por categoria** — o usuário não sabe quantos produtos há em cada ramo.

## Decisões (validadas no companion visual)

### 1. Árvore de categorias — Accordion por raiz + faixa lateral D1

- **Accordion por raiz:** categorias-raiz aparecem **fechadas** por padrão; um **chevron** abre/fecha cada nó que tem filhos. Substitui o "tudo aberto e plano" de hoje.
- **Auto-expansão do caminho ativo:** ao carregar com uma categoria selecionada, todos os **ancestrais** até a categoria ativa já vêm abertos.
- **Faixa lateral D1 (fiel ao DESIGN.md — "accent, not atmosphere"):**
  - Uma **barra vertical vermelha sólida** (`emach-red` / `#DA291C`, ~3px, `border-left`) corre ao lado da **seção raiz que contém a categoria ativa**. Sem fundo/degradê vermelho (degradê = "atmosfera", proibido).
  - A **folha ativa** (categoria selecionada) é destacada com **Deep Red `#9D2211`** (token oficial de _active state_) + peso 700. Sem fundo colorido.
- **Contador por categoria:** UI **preparada** (slot à direita de cada linha, cinza, `tabular-nums`), mas **não populado nesta entrega** — ver Dependências.

**Semântica de interação** (coerente com o backend, que já filtra a subárvore via `c.path LIKE root.path || '%'`):

- Clicar no **nome/linha** da categoria (qualquer nível) → **filtra** por ela (navega `?cat=slug`), incluindo descendentes. Se o nó tem filhos, também o expande.
- Clicar no **chevron** (apenas nós com filhos) → apenas **toggle** de expandir/colapsar, sem navegar.
- "Todas" → limpa o filtro de categoria.

### 2. Filtros ativos — Chips em linha própria (opção A)

- Uma **barra de chips** acima da toolbar de contagem/sort, rotulada `FILTROS` (Barlow Condensed, uppercase).
- Um chip por filtro ativo, derivado dos `searchParams` atuais: **Categoria**, **Voltagem** (um chip por voltagem), **Preço** (faixa), **Em promoção**, **Busca** (`q`).
- Cada chip: rótulo do tipo (Barlow Condensed, uppercase, cinza) + valor + **×** para remover. Remover = navega zerando aquele filtro.
- **"Limpar tudo"** ao fim, em **Deep Red** (texto) — única presença de vermelho na barra. Chips são **neutros** (branco/cinza, cantos retos) — vermelho fica fora deles.
- A barra só aparece quando há ≥1 filtro ativo.

### 3. Toolbar + cards — polimento

- **Toolbar:** mantém contagem (`N produtos (x–y)`) à esquerda, sort `<select>` + toggle grid/lista à direita. Ajustes de espaçamento/alinhamento e cantos retos (2px). Sem mudança funcional.
- **ProductCard:** já está alinhado ao sistema (hover lift, badge de desconto vermelho, estado "Esgotado"). Polimento **leve** apenas: consistência de hierarquia tipográfica (categoria label / nome / preço) e espaçamento. **Não** reinventar o card.

## Arquitetura / componentes

Hoje tudo vive em `catalog-content.tsx` (~494 linhas, client component). O redesign **extrai** dois componentes focados, reduzindo o tamanho do arquivo e isolando responsabilidades:

| Componente | Arquivo (novo/alterado) | Responsabilidade |
|---|---|---|
| `CategoryTree` | `_components/category-tree.tsx` (novo) | Render recursivo da árvore como accordion; estado de expansão; faixa lateral + folha ativa. Recebe `categoryTree`, `currentCategorySlug`, callback de navegação, e `counts?` opcional. |
| `ActiveFilters` | `_components/active-filters.tsx` (novo) | Deriva os chips dos filtros atuais; cada chip remove seu filtro; "Limpar tudo". Recebe o estado de filtros + callbacks. |
| `CatalogContent` | `_components/catalog-content.tsx` (alterado) | Orquestra; mantém `navigate`/`buildHref`/estado de view/preço; compõe `CategoryTree` + `ActiveFilters` + toolbar + grid/list. Remove `flattenTree`. |

- **Estado de expansão:** `useState<Set<string>>` de IDs expandidos em `CategoryTree`, inicializado com os ancestrais da categoria ativa (derivados de `parentId`/`path` do `CategoryNode`). Toggle pelo chevron muta o `Set`.
- **Sem mudança de dados de servidor:** `page.tsx`, `getTools`, `getCategoryTree` permanecem como estão. `buildHref` e as chaves de `searchParams` não mudam.
- Componentes em arquivos separados (sem barrel — proibido em `apps/web/src`).

## Fluxo de dados

`page.tsx` (Server Component) → busca `tools`, `total`, `categoryTree` (inalterado) → `CatalogContent` (client) distribui props para `CategoryTree` e `ActiveFilters`. Navegação continua via `router.replace` + `buildHref` (URL como fonte de verdade dos filtros).

## Estados e edge cases

- **Sem filtros:** barra de chips não renderiza.
- **Sem categoria ativa ("Todas"):** nenhuma raiz auto-expandida; nenhuma faixa vermelha; "Todas" marcado.
- **Categoria ativa profunda:** todos os ancestrais expandidos; faixa na raiz que a contém; folha em Deep Red.
- **Nó sem filhos:** sem chevron; clique sempre filtra.
- **Lista vazia / paginação:** comportamento atual preservado.
- **Contador ausente** (estado atual): a linha simplesmente não mostra número (`counts` vazio).

## Acessibilidade

- Chevron como `<button>` com `aria-expanded` e `aria-label` ("Expandir/Recolher {categoria}").
- Linha de categoria mantém `aria-current="page"` na ativa (já existe).
- Chips: × como `<button>` com `aria-label` ("Remover filtro {tipo}").
- Foco visível (cantos retos, sem outline arredondado).

## Fora de escopo

- **Mobile / drawer de filtros** — adiado (decisão: só desktop agora). O grid `[260px_1fr]` permanece; não pioramos o estado mobile atual, mas também não o resolvemos.
- **Reinvenção do card** ou do grid.

## Dependências / follow-ups

- **Contadores por categoria (cross-repo, ADR-0009):** a contagem ideal nasce em `getCategoryTree` no `emach-dashboard` (acrescentar `productCount` por nó = produtos na **subárvore**, coerente com o filtro `path LIKE`). Chega aqui via PR de sync. A UI desta entrega já consome um `counts?` opcional; quando o campo existir, basta ligar. **Não bloqueia esta entrega.**
- Abrir issue/pedido no dashboard para o `productCount`.

## Verificação

- `bun check-types` (não pega SQL/RSC — ver abaixo).
- Smoke visual em `localhost:3009/catalog`: árvore fechada por padrão; expandir/colapsar; categoria ativa com faixa + Deep Red + ancestrais abertos; chips aparecem/removem; "Limpar tudo"; toggle grid/lista; paginação.
