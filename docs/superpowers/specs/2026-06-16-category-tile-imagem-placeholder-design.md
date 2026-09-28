# Imagem da categoria na home + placeholder com ícone

> **Status em 2026-09-28:** implementado. `getCategoryImages()` em `apps/web/src/app/(shop)/page.tsx:56` ordena por `t.created_at ASC, t.id ASC, ti.sort_order ASC`, filtra `t.status = 'active'` e não tem mais o fallback cross-categoria. `apps/web/src/components/category-tile.tsx:8` mapeia o ícone por slug raiz (`Drill`, `Wrench`, `Disc3`, `HardHat`, fallback `Wrench`).

**Data:** 2026-06-16
**Área:** `apps/web` — home (`app/(shop)/page.tsx`) + `components/category-tile.tsx`
**Branch:** `feat/category-tile-imagem-criterio-placeholder`

## Contexto

A seção "Explorar por categoria" da home renderiza até 4 tiles dark (spotlight de
estúdio). Cada tile mostra a foto de uma ferramenta da categoria. A escolha da
imagem acontece na query `getCategoryImages()` em `app/(shop)/page.tsx`.

Dois problemas identificados na conversa:

1. **Critério da imagem.** A ordenação original (`ti.sort_order, ti.created_at DESC`)
   ordenava por **imagem**, não por ferramenta — pegava "a imagem de menor
   sort_order entre todas as ferramentas da categoria", de qualquer ferramenta.
   O desejado: a imagem primária da **primeira ferramenta cadastrada** na categoria.

2. **Fallback enganoso + sem placeholder.** Quando a categoria não tinha imagem
   própria, um segundo `db.execute` pegava uma foto **arbitrária de outra
   categoria** (`DISTINCT ON (url)`). E o tile, quando `imageUrl` é null, não
   renderiza nada (`{category.imageUrl && ...}`) — fica só fundo + número + texto.

## Decisões

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | Ordenar por `t.created_at ASC, t.id ASC, ti.sort_order ASC` | "Primeira ferramenta cadastrada", e dela a imagem primária. `t.id` desempata. |
| 2 | Filtrar `WHERE t.status = 'active'` | Evita emprestar foto de ferramenta `draft`/`discontinued`. **Coluna é `status` (enum `draft\|active\|discontinued`), não `is_active`.** |
| 3 | **Remover** o fallback cross-categoria (2º `db.execute`) | Mostrar foto de outra categoria é enganoso. Categoria sem imagem → `null` → placeholder cuida. Simplifica a função (~20 linhas a menos). |
| 4 | Placeholder com **ícone por categoria** no tile | Quando `imageUrl` é null, renderizar ícone lucide centralizado. Segue a convenção `CATEGORY_ICONS` de `product-image.tsx`. |

## Design da implementação

### 1. `app/(shop)/page.tsx` — `getCategoryImages()`

- `candidates` CTE: `JOIN tool t ON t.id = tc.tool_id`, `WHERE t.status = 'active'`,
  `ORDER BY t.created_at ASC, t.id ASC, ti.sort_order ASC`. (ORDER BY + JOIN já
  aplicados; falta o filtro de status e o comentário.)
- Remover o bloco `missing`/`fallbacks` inteiro (linhas ~85-105; já removido, a função hoje ocupa `app/(shop)/page.tsx:56-93`). A função passa a
  conter só a query `owned` + montagem do `Map`.
- Comentário curto no SQL explicando o critério.

### 2. `components/category-tile.tsx` — placeholder

- Mapping local das 4 raízes (slugs reais confirmados via DB):
  `ferramentas-eletricas → Drill`, `ferramentas-manuais → Wrench`,
  `acessorios → Disc3`, `equipamentos → HardHat`, fallback `Wrench`.
- Quando `category.imageUrl` é null, no lugar da `<Image>` (camada z-2),
  renderizar o ícone centralizado.
- Estilo casado ao tile dark: branco translúcido (≈`text-white/16`) sobre o
  spotlight, **acendendo no hover/auto-cycle** (espelha `group-hover` +
  `group-data-[active=true]`), igual aos outros elementos do tile.
  `aria-hidden` (decorativo; o nome da categoria já rotula o link).

## Unidades e isolamento

- `getCategoryImages()` continua com uma responsabilidade só (slug → url), agora
  sem o ramo de fallback. Contrato de saída inalterado: `Map<string, string>`
  (categorias ausentes simplesmente não entram no map → `imageUrl: null`).
- `CategoryTile` ganha um ramo de render (ícone vs imagem). Display puro, sem
  estado novo. O mapping fica top-level no módulo (sem `new` em loop).

## Riscos / não-validável agora

- **Placeholder não aparece com os dados atuais.** As 4 categorias raiz têm imagem
  própria, então o ramo do ícone não renderiza na home hoje. Validação visual do
  placeholder exige forçar `imageUrl = null` temporariamente (ou dados de teste).
- **Critério "primeira cadastrada" também é invisível hoje:** as 4 ferramentas-fonte
  têm `created_at` idêntico (seed em massa), então o desempate cai em `t.id`. O
  efeito real aparece com cadastros incrementais.

## Plano de execução

1. Commit deste design doc (o plano). ← este commit
2. Query: filtro `status = 'active'` + remover fallback + comentário → commit.
3. Placeholder com ícone no tile → commit.
4. `bun check-types` + smoke visual (`bun dev:web`, conferir `/`).
5. Push + abrir PR com descrição completa.
