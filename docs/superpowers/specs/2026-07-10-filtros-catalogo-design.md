# Filtros do catálogo — acordeões + drill-down de categoria

Data: 2026-07-10 · Status: aprovado em brainstorming (direção "B" escolhida em mockup visual com 3 opções)

## Problema

O sidebar de filtros do catálogo (`apps/web/src/app/(shop)/catalog/_components/`) tem defeitos de usabilidade e viola o design system:

1. **Árvore de categorias mistura dois gestos**: clicar num pai seleciona E expande (`category-tree.tsx`); o chevron de expandir é um alvo de 12px separado do rótulo. Com 3 níveis abertos vira uma parede de ~12 linhas com indentação irregular (folhas ganham spacer de 24px).
2. **Side-stripe vermelha** no caminho ativo — anti-pattern banido pelo DESIGN.md. Item ativo em `text-emach-red-deep` usa vermelho como estado de seleção, violando "vermelho é verbo, uma vez por tela" (a vez da tela pertence ao quick-add do ProductCard).
3. **Hierarquia tipográfica achatada**: labels de seção (13px semibold) quase iguais aos itens (14px); grupos separados só por margem, sem hairlines; "Apenas em promoção" órfão sem grupo.
4. **Sem contagens**: `CategoryTree` aceita `counts` mas ninguém passa — usuário filtra às cegas.
5. **Preço sem affordance**: aplicar é só blur/Enter; inputs sem `R$`; sem faixas prontas (padrão de e-commerce BR).
6. **Voltagem subvendida**: o atributo nº 1 do domínio (variante = voltagem) como checkboxes genéricos, ignorando a linguagem de selos do ProductCard.
7. **Alvos de toque** ~33px (`py-1.5`) abaixo dos 44px no drawer mobile.

## Decisões (validadas com o usuário)

- **Direção B** (acordeões + drill-down), escolhida sobre "A · refino da árvore" e "C · categoria no hero escuro". Motivo: ataca o problema central (árvore), padrão familiar de marketplace BR, escala pra atributos futuros (potência, marca) sem redesign de página.
- **Facet counts nesta rodada**, via query local no `apps/web` (rota pública; não espera ciclo de sync do dashboard).
- **Faixas de preço estáticas** (labels previsíveis), não derivadas da distribuição.
- Modelo de drill-down validado visualmente em 3 estados (raízes → nível intermediário → folha).

## Escopo

Reescrever o corpo dos filtros e adicionar facet counts. **Fora de escopo**: toolbar (ordenação, grade/lista), chips de filtros ativos (`active-filters.tsx`), grid de produtos, paginação, esquema de URL, hero do catálogo.

## UX/UI por grupo

Painel compartilhado desktop/drawer (como hoje, via `idPrefix`). Grupos como itens de `Accordion` (Base UI, `packages/ui`), **todos abertos por padrão**, com hairline (`border-border`) entre grupos, header com label em Barlow Condensed uppercase (11.5px, tracking 0.14em, `near-black`) + badge com nº de seleções do grupo (quando > 0) + chevron. Vermelho não aparece no painel; estado ativo = fundo `#e6e6e6` + `font-bold` + `near-black`.

### Categoria — drill-down por nível

Substitui a árvore. Mostra apenas:

- **`← <pai>`** (linha "voltar"; no nível 1, "← Todas as categorias"; oculta quando nada selecionado);
- **categoria ativa** destacada (fundo + bold) com contagem;
- **irmãs/filhas do nível atual**, cada uma com contagem e indicador `↓` quando tem filhas.

Interação: clicar num item **filtra por ele e desce um nível** (se tiver filhas); `←` filtra pelo pai. Sem categoria ativa, lista as raízes + "Todas". Estado intermediário mostra a ativa + filhas (a ativa filtra o grid em agregado; descer é opcional).

### Preço

`RadioGroup` com 4 faixas estáticas + contagens:

| Label | pmin | pmax |
|---|---|---|
| Até R$ 200 | — | 200 |
| R$ 200 – 500 | 200 | 500 |
| R$ 500 – 1.000 | 500 | 1000 |
| Acima de R$ 1.000 | 1000 | — |

Abaixo, linha "personalizado": inputs `Mín`/`Máx` com prefixo `R$` visível + botão `OK` (o affordance que faltava; Enter/blur continuam funcionando). **Sem parâmetro novo de URL**: faixa mapeia pros `pmin`/`pmax` existentes. Se `pmin`/`pmax` da URL não casam com nenhum preset, nenhum radio marcado e os inputs mostram os valores.

### Voltagem

`ToggleGroup` (multiple) 2×2 com os selos `127V / 220V / Bivolt / 380V`, cada um com contagem. Selecionado = fundo `near-black`, texto branco. Contagem 0 = desabilitado (exceto se já selecionado — precisa ser removível).

### Promoção

Linha única com `Switch` + "Apenas em promoção" + contagem. `Switch` não existe no `packages/ui` — adicionar via `shadcn add switch` (Base UI) e rodar `bun check` (o `shadcn add` não passa pelo hook de lint).

## Arquitetura

```
apps/web/src/app/(shop)/catalog/
  _components/
    filter-panel.tsx        # reescrito: acordeões + grupos acima
    category-drilldown.tsx  # NOVO — substitui category-tree.tsx (deletar)
    filter-drawer.tsx       # rodapé ganha botão "VER N PRODUTOS" (já recebe total)
  _lib/
    drilldown-level.ts      # NOVO — pura: (tree, activeSlug) → {back, active, rows}
    price-ranges.ts         # NOVO — PRICE_RANGES + casamento pmin/pmax ↔ preset
    facet-counts.ts         # NOVO — query de agregação (server-only)
```

- `drilldown-level.ts` reutiliza `collectPathToActive` de `_lib/category-tree.ts` (helper fica; o componente `category-tree.tsx` morre).
- `catalog-filters.ts` (buildHref, deriveActiveFilters) **não muda**.

## Facet counts

Query de agregação **local em `apps/web`** (`facet-counts.ts`, server-only). Catálogo é rota pública: import direto de `@emach/db` é permitido (a mediação por `@emach/auth` vale pra rota autenticada). **Não** editar as queries dashboard-owned de `packages/db` (ADR-0009).

Semântica padrão de faceta — cada grupo conta com os filtros dos **outros** grupos aplicados, nunca o próprio:

- `byCategory: Record<categoryId, number>` — aplica preço + voltagem + promo + busca; conta por categoria (agregado: pai soma as filhas).
- `byPriceRange: Record<rangeKey, number>` — aplica categoria + voltagem + promo + busca.
- `byVoltage: Record<VoltageKey, number>` — aplica categoria + preço + promo + busca.
- `promo: number` — aplica categoria + preço + voltagem + busca.

`page.tsx` calcula `facetCounts` no server (junto da query de produtos existente) e passa pro `CatalogContent` → `FilterPanel`. Preço considerado = **`MIN(price_amount)` das variantes do tool, sem desconto de promo** — é exatamente o predicado de preço do `buildToolListWhere` de `getTools`; as contagens precisam bater com o total do grid, então espelham a semântica real do filtro (não o preço exibido). Nota: `CategoryNode.productCount` já existe, mas vem do shell cacheado (600s) e não reflete os outros filtros — serve de fallback visual, não substitui a query dinâmica.

## Mobile

Mesmo `FilterPanel` no drawer. O rodapé com `VER N PRODUTOS` + "Limpar" **já existe** em `filter-drawer.tsx` (nada a fazer ali). Resta garantir linhas de toque ≥44px no drawer (`min-h-11 lg:min-h-9` nas linhas de drill-down/radios/selos).

## Acessibilidade

- Acordeão, radio e toggle-group: teclado/ARIA do Base UI.
- Drill-down: `aria-current="page"` na ativa (como hoje); `←` é `<button>` com label "Voltar para <pai>".
- Contagens dentro do texto acessível do item ("Furadeiras de Impacto, 18 produtos").
- Contraste: contagens em `gray-60` (#666) sobre `gray-10` ≥ 4.5:1; nada de `gray-50` em texto informativo.
- Selo desabilitado (count 0) mantém contraste ≥3:1 e `aria-disabled`.

## Testes

- **Unit** (CI): `drilldown-level.test.ts` (raiz/intermediário/folha/slug inexistente), `price-ranges.test.ts` (mapeamento pmin/pmax ↔ preset, valores custom), testes existentes de `catalog-filters` intactos.
- **Integração** (local): `facet-counts.test.ts` contra o DB — **adicionar à lista `INTEGRATION`** em `apps/web/vitest.config.ts` (CI é unit-only, sem `.env`/DB).
- **Smoke**: `bun dev:web` + catálogo com categoria/preço/voltagem combinados; conferir contagens contra o total do grid; drawer mobile.

## Riscos e observações

- Banco único dev=prod: facet counts é **read-only**; nenhum write envolvido.
- Custo da query: 4 agregações por render do catálogo; aceitável no volume atual (~centenas de produtos). Se pesar, consolidar em 1 round-trip (GROUPING SETS) ou cachear por combinação de filtros.
- `voltagesByTool`/selos do card usam `lib/variant-voltages.ts` — o filtro de voltagem já existe na URL (`voltage`); nada muda no contrato.
