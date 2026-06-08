# Redesign do catálogo (árvore, filtros ativos, toolbar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a sidebar de categorias do `/catalog` num accordion por raiz (com faixa lateral vermelha no ramo ativo), adicionar chips de filtros ativos e polir a toolbar/cards — tudo dentro do DESIGN.md (desktop).

**Architecture:** Extrair a lógica de filtros e de árvore para módulos puros e testáveis em `_lib/`, e dois componentes client focados (`CategoryTree`, `ActiveFilters`) de `catalog-content.tsx`. O Server Component (`page.tsx`) e as queries (`getTools`/`getCategoryTree`, owned-by-dashboard) **não mudam**. URL continua sendo a fonte de verdade dos filtros.

**Tech Stack:** Next 16 (App Router, RSC), React 19 (Compiler ativo — sem `useMemo`/`useCallback`), Tailwind v4, lucide-react, vitest 2.

**Spec:** `docs/superpowers/specs/2026-06-08-catalog-categories-redesign-design.md`

---

## File structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/web/src/app/(shop)/catalog/_lib/catalog-filters.ts` | Criar | Tipos (`SortKey`, `VoltageKey`, `FilterState`, `FilterUpdate`, `ActiveFilter`), `buildHref` (movido), `deriveActiveFilters`. Puro. |
| `apps/web/src/app/(shop)/catalog/_lib/catalog-filters.test.ts` | Criar | Testes de `buildHref` + `deriveActiveFilters`. |
| `apps/web/src/app/(shop)/catalog/_lib/category-tree.ts` | Criar | `collectPathToActive(tree, slug)`. Puro. |
| `apps/web/src/app/(shop)/catalog/_lib/category-tree.test.ts` | Criar | Testes de `collectPathToActive`. |
| `apps/web/src/app/(shop)/catalog/_components/category-tree.tsx` | Criar | Accordion recursivo: chevron, faixa lateral D1, folha ativa Deep Red, slot de contador. |
| `apps/web/src/app/(shop)/catalog/_components/active-filters.tsx` | Criar | Barra de chips removíveis + "Limpar tudo". |
| `apps/web/src/app/(shop)/catalog/_components/catalog-content.tsx` | Modificar | Importar utils/components do `_lib`/`_components`; remover `flattenTree` e o `<nav>` antigo; compor `ActiveFilters` + `CategoryTree`; polir toolbar. |
| `apps/web/src/components/product-card.tsx` | Modificar | Polimento leve de hierarquia/espaçamento. |

> **Nota de execução:** componentes client herdam state do parent? Não — quem implementar deve **Read cada arquivo antes de Edit** e rodar `bun check-types` antes de cada commit. Caminho da rota tem `(shop)` — sempre entre aspas em comandos de shell.

---

## Task 1: Módulo puro de filtros (`_lib/catalog-filters.ts`) + testes

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_lib/catalog-filters.ts`
- Test: `apps/web/src/app/(shop)/catalog/_lib/catalog-filters.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

```ts
// apps/web/src/app/(shop)/catalog/_lib/catalog-filters.test.ts
import { describe, expect, it } from "vitest";
import {
	buildHref,
	deriveActiveFilters,
	type FilterState,
} from "./catalog-filters";

const base: FilterState = {
	currentCategorySlug: null,
	currentCategoryName: null,
	query: "",
	sort: "relevance",
	voltages: [],
	priceMin: null,
	priceMax: null,
	onlyPromo: false,
};

describe("buildHref", () => {
	it("returns empty string with no filters", () => {
		expect(buildHref(base, {})).toBe("");
	});
	it("omits default sort and page 1, keeps the rest", () => {
		expect(
			buildHref(base, { cat: "furadeiras", sort: "relevance", page: 1 })
		).toBe("?cat=furadeiras");
	});
	it("serializes voltages joined by comma", () => {
		expect(buildHref(base, { voltage: ["127V", "220V"] })).toBe(
			"?voltage=127V%2C220V"
		);
	});
});

describe("deriveActiveFilters", () => {
	it("returns empty when nothing is active", () => {
		expect(deriveActiveFilters(base)).toEqual([]);
	});

	it("adds a category chip removable by clearing cat", () => {
		const r = deriveActiveFilters({
			...base,
			currentCategorySlug: "furadeiras",
			currentCategoryName: "Furadeiras",
		});
		expect(r).toHaveLength(1);
		expect(r[0]).toMatchObject({
			kind: "Categoria",
			value: "Furadeiras",
			remove: { cat: null },
		});
	});

	it("adds one chip per voltage, preserving the others on remove", () => {
		const r = deriveActiveFilters({ ...base, voltages: ["127V", "220V"] });
		expect(r).toHaveLength(2);
		expect(r[0].remove).toEqual({ voltage: ["220V"] });
		expect(r[1].remove).toEqual({ voltage: ["127V"] });
	});

	it("adds a single price chip removing both bounds", () => {
		const r = deriveActiveFilters({ ...base, priceMin: 100, priceMax: 500 });
		expect(r).toHaveLength(1);
		expect(r[0]).toMatchObject({
			kind: "Preço",
			remove: { pmin: null, pmax: null },
		});
	});

	it("adds a promo chip and a search chip", () => {
		const r = deriveActiveFilters({ ...base, onlyPromo: true, query: "serra" });
		const ids = r.map((f) => f.id);
		expect(ids).toContain("promo");
		expect(ids).toContain("q");
	});
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/web && bunx vitest run "src/app/(shop)/catalog/_lib/catalog-filters.test.ts"`
Expected: FAIL — `Cannot find module './catalog-filters'`.

- [ ] **Step 3: Implementar o módulo**

```ts
// apps/web/src/app/(shop)/catalog/_lib/catalog-filters.ts
export type SortKey =
	| "relevance"
	| "price-asc"
	| "price-desc"
	| "name-asc"
	| "newest";
export type VoltageKey = "127V" | "220V" | "Bivolt" | "380V";

export interface FilterState {
	currentCategorySlug: string | null;
	currentCategoryName: string | null;
	query: string;
	sort: SortKey;
	voltages: VoltageKey[];
	priceMin: number | null;
	priceMax: number | null;
	onlyPromo: boolean;
}

export interface FilterUpdate {
	cat?: string | null;
	q?: string | null;
	sort?: SortKey | null;
	voltage?: VoltageKey[] | null;
	pmin?: number | null;
	pmax?: number | null;
	promo?: boolean | null;
	page?: number | null;
}

export interface ActiveFilter {
	id: string;
	/** Rótulo do tipo do filtro (vazio quando o valor já é autoexplicativo). */
	kind: string;
	value: string;
	remove: FilterUpdate;
}

export function buildHref(current: FilterState, updates: FilterUpdate): string {
	const params = new URLSearchParams();
	const cat = "cat" in updates ? updates.cat : current.currentCategorySlug;
	const q = "q" in updates ? updates.q : current.query;
	const sort = "sort" in updates ? updates.sort : current.sort;
	const voltage = "voltage" in updates ? updates.voltage : current.voltages;
	const pmin = "pmin" in updates ? updates.pmin : current.priceMin;
	const pmax = "pmax" in updates ? updates.pmax : current.priceMax;
	const promo = "promo" in updates ? updates.promo : current.onlyPromo;
	const page = "page" in updates ? updates.page : null;

	if (cat) {
		params.set("cat", cat);
	}
	if (q) {
		params.set("q", q);
	}
	if (sort && sort !== "relevance") {
		params.set("sort", sort);
	}
	if (voltage && voltage.length > 0) {
		params.set("voltage", voltage.join(","));
	}
	if (pmin != null) {
		params.set("pmin", String(pmin));
	}
	if (pmax != null) {
		params.set("pmax", String(pmax));
	}
	if (promo) {
		params.set("promo", "1");
	}
	if (page && page > 1) {
		params.set("page", String(page));
	}

	const qs = params.toString();
	return qs ? `?${qs}` : "";
}

export function deriveActiveFilters(state: FilterState): ActiveFilter[] {
	const out: ActiveFilter[] = [];

	if (state.currentCategorySlug && state.currentCategoryName) {
		out.push({
			id: "cat",
			kind: "Categoria",
			value: state.currentCategoryName,
			remove: { cat: null },
		});
	}

	if (state.query.trim()) {
		out.push({
			id: "q",
			kind: "Busca",
			value: `“${state.query.trim()}”`,
			remove: { q: null },
		});
	}

	for (const v of state.voltages) {
		const rest = state.voltages.filter((x) => x !== v);
		out.push({
			id: `voltage-${v}`,
			kind: "Voltagem",
			value: v,
			remove: { voltage: rest.length > 0 ? rest : null },
		});
	}

	if (state.priceMin != null || state.priceMax != null) {
		const min = state.priceMin != null ? `R$ ${state.priceMin}` : "—";
		const max = state.priceMax != null ? `R$ ${state.priceMax}` : "—";
		out.push({
			id: "price",
			kind: "Preço",
			value: `${min} – ${max}`,
			remove: { pmin: null, pmax: null },
		});
	}

	if (state.onlyPromo) {
		out.push({
			id: "promo",
			kind: "",
			value: "Em promoção",
			remove: { promo: null },
		});
	}

	return out;
}
```

> Diferença ante o `buildHref` atual: `page` passa a default `null` (em vez de `current.page`) quando não informado — o caller já zera a página em toda navegação de filtro, então remover a dependência de `current.page` simplifica e mantém o mesmo comportamento. `FilterState` não tem mais `page`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/web && bunx vitest run "src/app/(shop)/catalog/_lib/catalog-filters.test.ts"`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(shop)/catalog/_lib/catalog-filters.ts" "apps/web/src/app/(shop)/catalog/_lib/catalog-filters.test.ts"
git commit -m "feat(catalog): módulo puro de filtros (buildHref + deriveActiveFilters)"
```

---

## Task 2: Caminho até a categoria ativa (`_lib/category-tree.ts`) + testes

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_lib/category-tree.ts`
- Test: `apps/web/src/app/(shop)/catalog/_lib/category-tree.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

```ts
// apps/web/src/app/(shop)/catalog/_lib/category-tree.test.ts
import type { CategoryNode } from "@emach/db/queries/catalog";
import { describe, expect, it } from "vitest";
import { collectPathToActive } from "./category-tree";

function node(
	id: string,
	slug: string,
	children: CategoryNode[] = []
): CategoryNode {
	return {
		id,
		slug,
		name: id,
		parentId: null,
		path: id,
		depth: 0,
		sortOrder: 0,
		isActive: true,
		children,
	};
}

const tree: CategoryNode[] = [
	node("eletricas", "ferramentas-eletricas", [
		node("furadeiras", "furadeiras-parafusadeiras", [
			node("impacto", "furadeiras-de-impacto"),
		]),
	]),
	node("manuais", "ferramentas-manuais"),
];

describe("collectPathToActive", () => {
	it("returns empty set when slug is null", () => {
		expect(collectPathToActive(tree, null).size).toBe(0);
	});

	it("returns empty set when slug is not found", () => {
		expect(collectPathToActive(tree, "inexistente").size).toBe(0);
	});

	it("includes the active leaf and all its ancestors", () => {
		const ids = collectPathToActive(tree, "furadeiras-de-impacto");
		expect([...ids].sort()).toEqual(["eletricas", "furadeiras", "impacto"]);
	});

	it("includes a matched root itself", () => {
		const ids = collectPathToActive(tree, "ferramentas-manuais");
		expect([...ids]).toEqual(["manuais"]);
	});
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/web && bunx vitest run "src/app/(shop)/catalog/_lib/category-tree.test.ts"`
Expected: FAIL — `Cannot find module './category-tree'`.

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/app/(shop)/catalog/_lib/category-tree.ts
import type { CategoryNode } from "@emach/db/queries/catalog";

/**
 * IDs de todos os nós no caminho da raiz até a categoria ativa (inclusive ela).
 * Usado para auto-expandir o accordion e marcar a raiz do ramo ativo.
 */
export function collectPathToActive(
	tree: CategoryNode[],
	activeSlug: string | null
): Set<string> {
	const ids = new Set<string>();
	if (!activeSlug) {
		return ids;
	}

	function walk(nodes: CategoryNode[], trail: string[]): boolean {
		for (const n of nodes) {
			const nextTrail = [...trail, n.id];
			if (n.slug === activeSlug) {
				for (const id of nextTrail) {
					ids.add(id);
				}
				return true;
			}
			if (n.children.length > 0 && walk(n.children, nextTrail)) {
				return true;
			}
		}
		return false;
	}

	walk(tree, []);
	return ids;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/web && bunx vitest run "src/app/(shop)/catalog/_lib/category-tree.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(shop)/catalog/_lib/category-tree.ts" "apps/web/src/app/(shop)/catalog/_lib/category-tree.test.ts"
git commit -m "feat(catalog): collectPathToActive para auto-expansão da árvore"
```

---

## Task 3: Componente `CategoryTree` (accordion + faixa D1)

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_components/category-tree.tsx`

- [ ] **Step 1: Implementar o componente**

```tsx
// apps/web/src/app/(shop)/catalog/_components/category-tree.tsx
"use client";

import type { CategoryNode } from "@emach/db/queries/catalog";
import { cn } from "@emach/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { collectPathToActive } from "../_lib/category-tree";

interface CategoryTreeProps {
	tree: CategoryNode[];
	activeSlug: string | null;
	/** Contagem de produtos por categoria (id → total). Opcional; ver ADR-0009. */
	counts?: Record<string, number>;
	onSelect: (slug: string | null) => void;
}

export function CategoryTree({
	tree,
	activeSlug,
	counts,
	onSelect,
}: CategoryTreeProps) {
	const [expanded, setExpanded] = useState<Set<string>>(() =>
		collectPathToActive(tree, activeSlug)
	);

	// Recomputado a cada render (barato): caminho do filtro ativo, p/ a faixa.
	const activePath = collectPathToActive(tree, activeSlug);

	function toggle(id: string) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	function select(node: CategoryNode) {
		onSelect(node.slug);
		if (node.children.length > 0 && !expanded.has(node.id)) {
			toggle(node.id);
		}
	}

	function renderNode(node: CategoryNode, depth: number) {
		const hasChildren = node.children.length > 0;
		const isOpen = expanded.has(node.id);
		const isActive = node.slug === activeSlug;
		const count = counts?.[node.id];
		const indent = 4 + depth * 14;

		return (
			<div key={node.id}>
				<div className="flex items-center">
					{hasChildren ? (
						<button
							aria-expanded={isOpen}
							aria-label={
								isOpen ? `Recolher ${node.name}` : `Expandir ${node.name}`
							}
							className="flex size-6 shrink-0 items-center justify-center text-gray-50 hover:text-near-black"
							onClick={() => toggle(node.id)}
							type="button"
						>
							<ChevronRight
								className={cn(
									"size-3 transition-transform duration-200",
									isOpen && "rotate-90"
								)}
							/>
						</button>
					) : (
						<span aria-hidden="true" className="size-6 shrink-0" />
					)}
					<button
						aria-current={isActive ? "page" : undefined}
						className={cn(
							"flex flex-1 items-center gap-2 py-1.5 pr-2 text-left text-[14px] transition-colors hover:text-near-black",
							isActive
								? "font-bold text-emach-red-deep"
								: depth === 0
									? "font-semibold text-near-black"
									: "text-gray-60"
						)}
						onClick={() => select(node)}
						style={{ paddingLeft: `${indent}px` }}
						type="button"
					>
						<span className="flex-1">{node.name}</span>
						{count != null && (
							<span className="text-[11px] text-gray-50 tabular-nums">
								{count}
							</span>
						)}
					</button>
				</div>
				{hasChildren && isOpen && (
					<div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
				)}
			</div>
		);
	}

	return (
		<nav aria-label="Categorias" className="flex flex-col">
			<div className="mb-2.5 font-semibold text-[13px]">Categoria</div>
			<button
				aria-current={activeSlug === null ? "page" : undefined}
				className={cn(
					"py-1.5 pl-4 text-left text-[14px] transition-colors hover:text-near-black",
					activeSlug === null
						? "font-bold text-emach-red-deep"
						: "font-semibold text-near-black"
				)}
				onClick={() => onSelect(null)}
				type="button"
			>
				Todas
			</button>
			{tree.map((root) =>
				activePath.has(root.id) ? (
					<div className="border-emach-red border-l-2" key={root.id}>
						{renderNode(root, 0)}
					</div>
				) : (
					<div className="border-l-2 border-l-transparent" key={root.id}>
						{renderNode(root, 0)}
					</div>
				)
			)}
		</nav>
	);
}
```

> A faixa vermelha (`border-l-2 border-emach-red`) envolve **a raiz inteira** do ramo ativo (header + descendentes abertos) — um único acento coeso (D1). Raízes inativas usam borda transparente de mesma largura, para o texto não "saltar" 2px ao trocar de categoria.

- [ ] **Step 2: Verificar tipos**

Run: `cd apps/web && bun check-types`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(shop)/catalog/_components/category-tree.tsx"
git commit -m "feat(catalog): CategoryTree accordion com faixa lateral no ramo ativo"
```

---

## Task 4: Componente `ActiveFilters` (chips)

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_components/active-filters.tsx`

- [ ] **Step 1: Implementar o componente**

```tsx
// apps/web/src/app/(shop)/catalog/_components/active-filters.tsx
"use client";

import { X } from "lucide-react";
import type { ActiveFilter, FilterUpdate } from "../_lib/catalog-filters";

interface ActiveFiltersProps {
	filters: ActiveFilter[];
	onRemove: (update: FilterUpdate) => void;
	onClearAll: () => void;
}

export function ActiveFilters({
	filters,
	onRemove,
	onClearAll,
}: ActiveFiltersProps) {
	if (filters.length === 0) {
		return null;
	}

	return (
		<div className="mb-4 flex flex-wrap items-center gap-2">
			<span className="mr-0.5 font-bold font-display text-[11px] text-gray-50 uppercase tracking-[0.12em]">
				Filtros
			</span>
			{filters.map((f) => (
				<span
					className="inline-flex items-center gap-2 rounded-[2px] border border-border bg-white py-1 pr-1.5 pl-2.5 text-[12.5px] text-near-black"
					key={f.id}
				>
					{f.kind && (
						<span className="font-display text-[10px] text-gray-50 uppercase tracking-[0.1em]">
							{f.kind}
						</span>
					)}
					<span>{f.value}</span>
					<button
						aria-label={`Remover filtro ${f.kind || f.value}`}
						className="flex size-4 items-center justify-center text-gray-50 transition-colors hover:text-near-black"
						onClick={() => onRemove(f.remove)}
						type="button"
					>
						<X className="size-3" />
					</button>
				</span>
			))}
			<button
				className="ml-1 font-display text-[11px] text-emach-red-deep uppercase tracking-[0.08em] hover:text-emach-red"
				onClick={onClearAll}
				type="button"
			>
				Limpar tudo
			</button>
		</div>
	);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd apps/web && bun check-types`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(shop)/catalog/_components/active-filters.tsx"
git commit -m "feat(catalog): ActiveFilters com chips removíveis e limpar tudo"
```

---

## Task 5: Integrar em `catalog-content.tsx`

**Files:**
- Modify: `apps/web/src/app/(shop)/catalog/_components/catalog-content.tsx`

- [ ] **Step 1: Read o arquivo atual** (obrigatório antes de editar).

- [ ] **Step 2: Substituir imports e tipos locais**

Trocar o bloco de imports + os tipos `SortKey`/`VoltageKey`/`FilterUpdate`/`FilterCurrent` + as funções `buildHref`/`flattenTree` por imports do `_lib` e dos novos componentes. O topo do arquivo passa a ser:

```tsx
"use client";

import type { CategoryNode, ToolListItem } from "@emach/db/queries/catalog";
import { Checkbox } from "@emach/ui/components/checkbox";
import { cn } from "@emach/ui/lib/utils";
import { Grid3x3, List } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageContainer } from "@/components/page-container";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { SectionLabel } from "@/components/section-label";
import { fmtNumericBRL } from "@/lib/format";
import { ActiveFilters } from "./active-filters";
import { CategoryTree } from "./category-tree";
import {
	buildHref,
	deriveActiveFilters,
	type FilterState,
	type FilterUpdate,
	type SortKey,
	type VoltageKey,
} from "../_lib/catalog-filters";

const VOLTAGE_OPTIONS: VoltageKey[] = ["127V", "220V", "Bivolt", "380V"];
```

Remover (agora vivem no `_lib`): as declarações locais de `type SortKey`, `type VoltageKey`, `interface FilterUpdate`, `interface FilterCurrent`, e as funções `buildHref` e `flattenTree`.

- [ ] **Step 3: Ajustar o corpo do componente**

O `interface CatalogContentProps` permanece igual (mantém `page`/`pageSize` etc.). Dentro do componente, trocar a montagem de `current` para usar `FilterState` (sem `page`) e derivar os chips:

```tsx
	const current: FilterState = {
		currentCategorySlug,
		currentCategoryName,
		query,
		sort,
		voltages,
		priceMin,
		priceMax,
		onlyPromo,
	};

	function navigate(updates: FilterUpdate) {
		const href =
			`${pathname}${buildHref(current, { ...updates, page: null })}` as Route;
		startTransition(() => {
			router.replace(href, { scroll: false });
		});
	}

	function navigatePage(nextPage: number) {
		const href = `${pathname}${buildHref(current, { page: nextPage })}` as Route;
		startTransition(() => {
			router.replace(href, { scroll: true });
		});
	}

	function clearAll() {
		startTransition(() => {
			router.replace(pathname as Route, { scroll: false });
		});
	}

	const activeFilters = deriveActiveFilters(current);
```

Remover a antiga linha `const flatCategories = flattenTree(categoryTree);`. As funções `toggleVoltage`/`applyPriceFilters` e o cálculo de `totalPages`/`showFrom`/`showTo` permanecem.

- [ ] **Step 4: Substituir o `<aside>` (bloco de categorias)**

Trocar todo o `<nav aria-label="Categorias">…</nav>` (o bloco que mapeava `flatCategories`) por:

```tsx
				<CategoryTree
					activeSlug={currentCategorySlug}
					onSelect={(slug) => navigate({ cat: slug })}
					tree={categoryTree}
				/>
```

O cabeçalho `FILTROS` e os blocos de Faixa de preço / Apenas em promoção / Voltagem permanecem como estão.

- [ ] **Step 5: Inserir a barra de chips acima da toolbar**

No início da coluna de conteúdo (a `<div>` que hoje começa com a toolbar `mb-6 flex items-center justify-between`), inserir **antes** da toolbar:

```tsx
				<ActiveFilters
					filters={activeFilters}
					onClearAll={clearAll}
					onRemove={(update) => navigate(update)}
				/>
```

- [ ] **Step 6: Polir a toolbar**

Na toolbar, ajustar a borda para usar a mesma cor do sistema e respiro consistente (cantos retos já vêm dos `emach-*`). Trocar a classe do contêiner da toolbar de:

`className="mb-6 flex items-center justify-between border-border border-b py-3"`

para:

`className="mb-5 flex flex-wrap items-center justify-between gap-3 border-border border-b pb-3"`

(remove o padding-top redundante já que os chips ficam acima; permite wrap em larguras menores).

- [ ] **Step 7: Verificar tipos**

Run: `cd apps/web && bun check-types`
Expected: sem erros (em especial, nenhum símbolo `flattenTree`/`FilterCurrent` órfão).

- [ ] **Step 8: Smoke visual** em `http://localhost:3009/catalog`:
  - Árvore inicia fechada (raízes), "Todas" ativo.
  - Clicar numa raiz: filtra + expande; faixa vermelha aparece na raiz; URL ganha `?cat=`.
  - Entrar numa subcategoria por URL (`?cat=furadeiras-de-impacto`): ancestrais já abertos, folha em Deep Red, faixa na raiz "Ferramentas Elétricas".
  - Chevron expande/colapsa sem navegar.
  - Aplicar voltagem/preço/promo: chips aparecem; remover um chip atualiza a lista; "Limpar tudo" zera tudo.
  - Toggle grade/lista e paginação seguem funcionando.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/src/app/(shop)/catalog/_components/catalog-content.tsx"
git commit -m "feat(catalog): integrar CategoryTree e ActiveFilters; polir toolbar"
```

---

## Task 6: Polimento leve do `ProductCard`

**Files:**
- Modify: `apps/web/src/components/product-card.tsx`

- [ ] **Step 1: Read o arquivo** (obrigatório antes de editar).

- [ ] **Step 2: Ajustes de hierarquia/espaçamento**

Aplicar apenas refinamentos (sem mudar estrutura): no bloco de conteúdo (`<div className="flex flex-1 flex-col gap-1 bg-gray-10 px-2 py-3">`), aumentar o padding lateral para alinhar com o card e dar respiro ao texto:

- `px-2 py-3` → `px-3 py-3.5`

E garantir contraste do label de variante (`Mais opções de voltagem`) trocando `text-gray-60` por `text-gray-50` para diferenciá-lo do nome do produto.

> YAGNI: nenhuma mudança de comportamento, badge, hover ou imagem. Se no smoke o card já parecer equilibrado, este task pode ser fechado sem alterações — registrar isso no commit/relato em vez de forçar mudança.

- [ ] **Step 3: Verificar tipos**

Run: `cd apps/web && bun check-types`
Expected: sem erros.

- [ ] **Step 4: Smoke visual** — cards na grade do `/catalog` com espaçamento consistente.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/product-card.tsx
git commit -m "style(catalog): polir espaçamento e hierarquia do ProductCard"
```

---

## Verificação final

- [ ] `cd apps/web && bunx vitest run "src/app/(shop)/catalog"` — todos os testes verdes.
- [ ] `bun check-types` na raiz — sem erros.
- [ ] Smoke completo em `localhost:3009/catalog` cobrindo os cenários do Task 5 Step 8.
- [ ] (Opcional) `bun check` para lint/format (shadcn/ultracite).

## Follow-up (fora deste plano)

- Abrir pedido no `emach-dashboard` para `getCategoryTree` retornar `productCount` por nó (produtos na subárvore). Quando chegar via PR de sync, passar `counts` ao `<CategoryTree>` em `catalog-content.tsx` — a UI já está pronta.
