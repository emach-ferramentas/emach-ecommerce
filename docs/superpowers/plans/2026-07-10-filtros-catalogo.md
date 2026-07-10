# Filtros do catálogo (acordeões + drill-down + facet counts) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o sidebar de filtros do catálogo conforme o spec `docs/superpowers/specs/2026-07-10-filtros-catalogo-design.md`: categoria em drill-down por nível, grupos em acordeão, faixas de preço prontas, selos de voltagem, switch de promoção e contagens por faceta.

**Architecture:** 3 libs puras novas em `_lib` (faixas de preço, derivação do nível de drill-down, query de facet counts) + 1 componente novo (`category-drilldown.tsx`, substitui `category-tree.tsx`) + reescrita do `filter-panel.tsx` usando Accordion/RadioGroup do `packages/ui` e um `Switch` novo. Os facet counts são calculados no server (`page.tsx`, junto do `getTools`) e espelham EXATAMENTE os predicados de `buildToolListWhere` (`packages/db/src/queries/tools.ts:89-136`) para as contagens baterem com o grid.

**Tech Stack:** Next 16 (App Router, React 19, React Compiler), drizzle-orm `sql` template, Base UI (shadcn base-lyra), Tailwind 4, Vitest.

## Global Constraints

- Monorepo bun/turbo: CWD é a RAIZ (`/home/othavio/Projects/emach/emach-ecommerce`); nunca `cd apps/web`; paths absolutos.
- **Banco único dev=prod compartilhado: NUNCA INSERT/UPDATE/seed/truncate.** Tudo neste plano é read-only no DB (facet counts e teste de integração só fazem SELECT).
- **Não editar nada em `packages/db/src/{schema,queries}/`** (dashboard-owned, ADR-0009). Helpers internos de `queries/catalog-helpers.ts` não são importáveis fora de `queries/` — replicar fragmentos localmente.
- Proibido: `console.*` (usar `log` de `@/lib/evlog` se precisar logar), `any`/`as any`/`@ts-ignore`, `key={index}`, `React.forwardRef`, `useMemo`/`useCallback` manuais (React Compiler ativo), barrel files, `.forEach()` em hot path.
- Design: vermelho NÃO aparece no painel de filtros (estado ativo = fundo `#e6e6e6`/`bg-near-black`, nunca `emach-red`); superfície clara única `gray-10`; hairline = `border-border` (NUNCA `border-gray-10`); cantos retos (sem rounded, ou `rounded-[2px]`); labels de seção em `font-display` (Barlow Condensed) uppercase tracking largo; sem em-dash em copy.
- Alvos de toque ≥44px no mobile: linhas interativas do painel usam `min-h-11 lg:min-h-9`.
- Commits: Conventional Commits em PT, subject ≤50 chars. Antes de CADA commit: `bun check-types --force` (turbo serve PASS velho sem `--force`) e `bun check`.
- Read cada arquivo antes de Edit (`cat`/`sed` não contam para o harness); se Edit falhar com `string not found`, re-Read antes de re-tentar.
- Teste que toca o DB é integração: entra na lista `INTEGRATION` de `apps/web/vitest.config.ts` (CI é unit-only, sem `.env`).

---

### Task 1: Lib de faixas de preço (`price-ranges.ts`)

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_lib/price-ranges.ts`
- Test: `apps/web/src/app/(shop)/catalog/_lib/price-ranges.test.ts`

**Interfaces:**
- Consumes: nada (lib pura, sem imports do projeto).
- Produces: `PriceRangeKey` (union), `PriceRange { key: PriceRangeKey; label: string; pmin: number | null; pmax: number | null }`, `PRICE_RANGES: PriceRange[]` (4 itens, na ordem de exibição), `matchPriceRange(pmin: number | null, pmax: number | null): PriceRangeKey | null`. Tasks 3 e 6 dependem desses nomes exatos.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/(shop)/catalog/_lib/price-ranges.test.ts
import { describe, expect, it } from "vitest";
import { matchPriceRange, PRICE_RANGES } from "./price-ranges";

describe("PRICE_RANGES", () => {
	it("tem 4 faixas na ordem de exibição", () => {
		expect(PRICE_RANGES.map((r) => r.key)).toEqual([
			"ate-200",
			"200-500",
			"500-1000",
			"acima-1000",
		]);
	});

	it("labels em BRL sem em-dash", () => {
		expect(PRICE_RANGES.map((r) => r.label)).toEqual([
			"Até R$ 200",
			"R$ 200 – 500",
			"R$ 500 – 1.000",
			"Acima de R$ 1.000",
		]);
	});
});

describe("matchPriceRange", () => {
	it("casa cada preset pelos limites exatos", () => {
		expect(matchPriceRange(null, 200)).toBe("ate-200");
		expect(matchPriceRange(200, 500)).toBe("200-500");
		expect(matchPriceRange(500, 1000)).toBe("500-1000");
		expect(matchPriceRange(1000, null)).toBe("acima-1000");
	});

	it("null quando não há filtro de preço", () => {
		expect(matchPriceRange(null, null)).toBeNull();
	});

	it("null para valores custom que não casam com preset", () => {
		expect(matchPriceRange(150, 900)).toBeNull();
		expect(matchPriceRange(200, null)).toBeNull();
		expect(matchPriceRange(null, 500)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter=web test "price-ranges"`
Expected: FAIL — `Cannot find module './price-ranges'` (ou equivalente).

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/app/(shop)/catalog/_lib/price-ranges.ts
export type PriceRangeKey = "ate-200" | "200-500" | "500-1000" | "acima-1000";

export interface PriceRange {
	key: PriceRangeKey;
	label: string;
	/** Limites que a faixa aplica em pmin/pmax da URL (null = sem limite). */
	pmax: number | null;
	pmin: number | null;
}

// Faixas estáticas (decisão do spec). O en dash (–) do label é tipográfico
// de intervalo numérico, não em-dash de prosa.
export const PRICE_RANGES: PriceRange[] = [
	{ key: "ate-200", label: "Até R$ 200", pmin: null, pmax: 200 },
	{ key: "200-500", label: "R$ 200 – 500", pmin: 200, pmax: 500 },
	{ key: "500-1000", label: "R$ 500 – 1.000", pmin: 500, pmax: 1000 },
	{ key: "acima-1000", label: "Acima de R$ 1.000", pmin: 1000, pmax: null },
];

/** Preset cujos limites casam EXATAMENTE com pmin/pmax da URL; senão null. */
export function matchPriceRange(
	pmin: number | null,
	pmax: number | null
): PriceRangeKey | null {
	if (pmin === null && pmax === null) {
		return null;
	}
	const found = PRICE_RANGES.find((r) => r.pmin === pmin && r.pmax === pmax);
	return found?.key ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter=web test "price-ranges"`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
bun check-types --force && bun check
git add "apps/web/src/app/(shop)/catalog/_lib/price-ranges.ts" "apps/web/src/app/(shop)/catalog/_lib/price-ranges.test.ts"
git commit -m "feat: faixas de preço prontas do catálogo"
```

---

### Task 2: Lib de drill-down de categoria (`drilldown-level.ts`)

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_lib/drilldown-level.ts`
- Test: `apps/web/src/app/(shop)/catalog/_lib/drilldown-level.test.ts`

**Interfaces:**
- Consumes: `CategoryNode` de `@emach/db/queries/categories` (shape: `{ id, slug, name, parentId, path, depth, sortOrder, isActive, productCount, children: CategoryNode[] }`).
- Produces (Task 5 depende dos nomes exatos):

```ts
export interface DrilldownRow {
	hasChildren: boolean;
	id: string;
	name: string;
	slug: string;
}
export interface DrilldownLevel {
	active: { id: string; name: string; slug: string } | null;
	back: { name: string; slug: string | null } | null;
	rows: DrilldownRow[];
	rowsAreChildren: boolean;
}
export function deriveDrilldownLevel(
	tree: CategoryNode[],
	activeSlug: string | null
): DrilldownLevel;
```

Semântica (validada em mockup — 3 estados):
- `activeSlug` null ou slug inexistente → `{ active: null, back: null, rows: raízes, rowsAreChildren: false }`.
- Ativo com filhas → `rows` = filhas (`rowsAreChildren: true`); `back` = pai, ou `{ name: "Todas as categorias", slug: null }` se o ativo é raiz.
- Ativo folha → `rows` = irmãs EXCLUINDO o ativo (`rowsAreChildren: false`); `back` = mesma regra do pai.

- [ ] **Step 1: Write the failing test**

O teste monta uma árvore fixture local (sem DB — lib pura). Helper `node()` para construir `CategoryNode` mínimo válido.

```ts
// apps/web/src/app/(shop)/catalog/_lib/drilldown-level.test.ts
import type { CategoryNode } from "@emach/db/queries/categories";
import { describe, expect, it } from "vitest";
import { deriveDrilldownLevel } from "./drilldown-level";

let seq = 0;
function node(
	name: string,
	children: CategoryNode[] = []
): CategoryNode {
	seq += 1;
	const id = `id-${seq}`;
	return {
		id,
		slug: name.toLowerCase().replace(/\s+/g, "-"),
		name,
		parentId: null,
		path: `/${id}`,
		depth: 0,
		sortOrder: seq,
		isActive: true,
		productCount: 0,
		children,
	};
}

const impacto = node("Furadeiras de Impacto");
const bateria = node("Parafusadeiras a Bateria");
const furadeiras = node("Furadeiras e Parafusadeiras", [impacto, bateria]);
const serras = node("Serras Elétricas", [node("Serra Circular")]);
const eletricas = node("Ferramentas Elétricas", [furadeiras, serras]);
const manuais = node("Ferramentas Manuais");
const tree = [eletricas, manuais];

describe("deriveDrilldownLevel", () => {
	it("sem seleção: raízes, sem voltar", () => {
		const level = deriveDrilldownLevel(tree, null);
		expect(level.active).toBeNull();
		expect(level.back).toBeNull();
		expect(level.rows.map((r) => r.name)).toEqual([
			"Ferramentas Elétricas",
			"Ferramentas Manuais",
		]);
		expect(level.rowsAreChildren).toBe(false);
		expect(level.rows[0]?.hasChildren).toBe(true);
		expect(level.rows[1]?.hasChildren).toBe(false);
	});

	it("nível intermediário: filhas + voltar pro nível acima", () => {
		const level = deriveDrilldownLevel(tree, furadeiras.slug);
		expect(level.active?.name).toBe("Furadeiras e Parafusadeiras");
		expect(level.back).toEqual({
			name: "Ferramentas Elétricas",
			slug: eletricas.slug,
		});
		expect(level.rows.map((r) => r.name)).toEqual([
			"Furadeiras de Impacto",
			"Parafusadeiras a Bateria",
		]);
		expect(level.rowsAreChildren).toBe(true);
	});

	it("raiz com filhas: voltar = Todas as categorias (slug null)", () => {
		const level = deriveDrilldownLevel(tree, eletricas.slug);
		expect(level.back).toEqual({ name: "Todas as categorias", slug: null });
		expect(level.rowsAreChildren).toBe(true);
	});

	it("folha: irmãs sem o ativo + voltar pro pai", () => {
		const level = deriveDrilldownLevel(tree, impacto.slug);
		expect(level.active?.name).toBe("Furadeiras de Impacto");
		expect(level.back?.name).toBe("Furadeiras e Parafusadeiras");
		expect(level.rows.map((r) => r.name)).toEqual([
			"Parafusadeiras a Bateria",
		]);
		expect(level.rowsAreChildren).toBe(false);
	});

	it("folha na raiz: voltar = Todas as categorias", () => {
		const level = deriveDrilldownLevel(tree, manuais.slug);
		expect(level.back).toEqual({ name: "Todas as categorias", slug: null });
		expect(level.rows.map((r) => r.name)).toEqual(["Ferramentas Elétricas"]);
	});

	it("slug inexistente cai no estado sem seleção", () => {
		const level = deriveDrilldownLevel(tree, "nao-existe");
		expect(level.active).toBeNull();
		expect(level.rows).toHaveLength(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter=web test "drilldown-level"`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/app/(shop)/catalog/_lib/drilldown-level.ts
import type { CategoryNode } from "@emach/db/queries/categories";

export interface DrilldownRow {
	hasChildren: boolean;
	id: string;
	name: string;
	slug: string;
}

export interface DrilldownLevel {
	/** Categoria ativa; null quando nada selecionado ("Todas"). */
	active: { id: string; name: string; slug: string } | null;
	/** Nível acima; slug null = "Todas as categorias"; null = já está no topo. */
	back: { name: string; slug: string | null } | null;
	/** Itens exibidos abaixo do ativo (nunca incluem o próprio ativo). */
	rows: DrilldownRow[];
	/** true = rows são filhas do ativo (ganham recuo); false = irmãs/raízes. */
	rowsAreChildren: boolean;
}

function toRow(n: CategoryNode): DrilldownRow {
	return {
		id: n.id,
		slug: n.slug,
		name: n.name,
		hasChildren: n.children.length > 0,
	};
}

function findWithParent(
	nodes: CategoryNode[],
	slug: string,
	parent: CategoryNode | null
): { node: CategoryNode; parent: CategoryNode | null } | null {
	for (const n of nodes) {
		if (n.slug === slug) {
			return { node: n, parent };
		}
		const inChildren = findWithParent(n.children, slug, n);
		if (inChildren) {
			return inChildren;
		}
	}
	return null;
}

export function deriveDrilldownLevel(
	tree: CategoryNode[],
	activeSlug: string | null
): DrilldownLevel {
	const found = activeSlug ? findWithParent(tree, activeSlug, null) : null;
	if (!found) {
		return {
			active: null,
			back: null,
			rows: tree.map(toRow),
			rowsAreChildren: false,
		};
	}

	const { node, parent } = found;
	const back = parent
		? { name: parent.name, slug: parent.slug }
		: { name: "Todas as categorias", slug: null };
	const active = { id: node.id, name: node.name, slug: node.slug };

	if (node.children.length > 0) {
		return {
			active,
			back,
			rows: node.children.map(toRow),
			rowsAreChildren: true,
		};
	}

	const siblings = (parent ? parent.children : tree).filter(
		(s) => s.id !== node.id
	);
	return { active, back, rows: siblings.map(toRow), rowsAreChildren: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter=web test "drilldown-level"`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
bun check-types --force && bun check
git add "apps/web/src/app/(shop)/catalog/_lib/drilldown-level.ts" "apps/web/src/app/(shop)/catalog/_lib/drilldown-level.test.ts"
git commit -m "feat: lib de drill-down de categorias"
```

---

### Task 3: Facet counts (`facet-counts.ts`) — query server-only + teste de integração

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_lib/facet-counts.ts`
- Test: `apps/web/src/app/(shop)/catalog/_lib/facet-counts.test.ts` (INTEGRAÇÃO — read-only)
- Modify: `apps/web/vitest.config.ts:8-17` (adicionar o teste à lista `INTEGRATION`)

**Interfaces:**
- Consumes: `db` de `@emach/db`; `STOREFRONT_TOOL_STATUSES` de `@emach/db/queries/tools`; `PRICE_RANGES`, `PriceRangeKey` da Task 1; `VoltageKey` de `./catalog-filters`.
- Produces (Task 6 depende dos nomes exatos):

```ts
export interface FacetCountsInput {
	categoryId?: string;
	onlyPromo: boolean;
	priceMax?: number;
	priceMin?: number;
	search?: string;
	voltages: VoltageKey[];
}
export interface FacetCounts {
	byCategory: Record<string, number>; // categoryId → count (subárvore agregada)
	byPriceRange: Record<PriceRangeKey, number>;
	byVoltage: Record<VoltageKey, number>;
	promo: number;
	total: number; // tudo exceto categoria aplicado (linha "Todas" do drill-down)
}
export async function getFacetCounts(input: FacetCountsInput): Promise<FacetCounts>;
```

**Regra de ouro:** cada grupo é contado com os filtros dos OUTROS grupos aplicados, nunca o próprio. Os predicados replicam 1:1 `buildToolListWhere` (`packages/db/src/queries/tools.ts:89-136`) — preço compara `MIN(price_amount)` das variantes (base, sem promo); categoria via `EXISTS` com `path LIKE root.path || '%'`; promo via `EXISTS` de promotion ativa. NÃO importar `catalog-helpers` (interno de `queries/`); replicar os fragmentos localmente com comentário apontando a origem.

- [ ] **Step 1: Write the failing test**

Teste de integração **read-only** por consistência: compara `getFacetCounts` com `getTools` (mesmo predicado ⇒ mesmos números), robusto a mudanças de dado no banco compartilhado. NENHUM write.

```ts
// apps/web/src/app/(shop)/catalog/_lib/facet-counts.test.ts
import { db } from "@emach/db";
import { getCategoryTree } from "@emach/db/queries/categories";
import { getTools } from "@emach/db/queries/tools";
import { describe, expect, it } from "vitest";
import { getFacetCounts } from "./facet-counts";
import { PRICE_RANGES } from "./price-ranges";

const NO_FILTERS = { onlyPromo: false, voltages: [] as never[] };

describe("getFacetCounts (integração read-only: consistência com getTools)", () => {
	it("byVoltage bate com getTools filtrado pela mesma voltagem", async () => {
		const counts = await getFacetCounts(NO_FILTERS);
		for (const v of ["127V", "220V", "Bivolt", "380V"] as const) {
			const { total } = await getTools(db, { voltage: [v], limit: 1 });
			expect(counts.byVoltage[v] ?? 0).toBe(total);
		}
	});

	it("byPriceRange bate com getTools pmin/pmax de cada faixa", async () => {
		const counts = await getFacetCounts(NO_FILTERS);
		for (const r of PRICE_RANGES) {
			const { total } = await getTools(db, {
				priceMin: r.pmin ?? undefined,
				priceMax: r.pmax ?? undefined,
				limit: 1,
			});
			expect(counts.byPriceRange[r.key]).toBe(total);
		}
	});

	it("promo bate com getTools onlyPromo", async () => {
		const counts = await getFacetCounts(NO_FILTERS);
		const { total } = await getTools(db, { onlyPromo: true, limit: 1 });
		expect(counts.promo).toBe(total);
	});

	it("byCategory de uma raiz bate com getTools categoryId", async () => {
		const [counts, tree] = await Promise.all([
			getFacetCounts(NO_FILTERS),
			getCategoryTree(db),
		]);
		const root = tree[0];
		if (!root) {
			return; // banco sem categorias: nada a verificar
		}
		const { total } = await getTools(db, { categoryId: root.id, limit: 1 });
		expect(counts.byCategory[root.id] ?? 0).toBe(total);
	});

	it("cross-filtro: byVoltage respeita categoria ativa", async () => {
		const tree = await getCategoryTree(db);
		const root = tree[0];
		if (!root) {
			return;
		}
		const counts = await getFacetCounts({ ...NO_FILTERS, categoryId: root.id });
		const { total } = await getTools(db, {
			categoryId: root.id,
			voltage: ["220V"],
			limit: 1,
		});
		expect(counts.byVoltage["220V"] ?? 0).toBe(total);
	});

	it("total (sem categoria) bate com getTools sem filtros", async () => {
		const counts = await getFacetCounts(NO_FILTERS);
		const { total } = await getTools(db, { limit: 1 });
		expect(counts.total).toBe(total);
	});
});
```

- [ ] **Step 2: Registrar como teste de integração**

Em `apps/web/vitest.config.ts`, adicionar à lista `INTEGRATION` (depois da linha `"**/catalog/_lib/category-tree.test.ts",`):

```ts
	"**/catalog/_lib/facet-counts.test.ts",
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run --filter=web test "facet-counts"`
Expected: FAIL — módulo `./facet-counts` não existe.

- [ ] **Step 4: Write the implementation**

```ts
// apps/web/src/app/(shop)/catalog/_lib/facet-counts.ts
import { db } from "@emach/db";
import { STOREFRONT_TOOL_STATUSES } from "@emach/db/queries/tools";
import { type SQL, sql } from "drizzle-orm";
import type { VoltageKey } from "./catalog-filters";
import { PRICE_RANGES, type PriceRangeKey } from "./price-ranges";

// Contagens por faceta do catálogo. Server-only (importado só por page.tsx).
// Os predicados replicam buildToolListWhere (packages/db/src/queries/tools.ts,
// dashboard-owned — não importável daqui): se aquele WHERE mudar, este arquivo
// precisa acompanhar. O teste de integração (consistência com getTools) acusa
// divergência.

export interface FacetCountsInput {
	categoryId?: string;
	onlyPromo: boolean;
	priceMax?: number;
	priceMin?: number;
	search?: string;
	voltages: VoltageKey[];
}

export interface FacetCounts {
	byCategory: Record<string, number>;
	byPriceRange: Record<PriceRangeKey, number>;
	byVoltage: Record<VoltageKey, number>;
	promo: number;
	total: number;
}

const STATUS_SQL = sql`t.status IN (${sql.join(
	STOREFRONT_TOOL_STATUSES.map((s) => sql`${s}`),
	sql`, `
)})`;

const PROMO_SQL = sql`EXISTS (
	SELECT 1 FROM promotion p
	WHERE p.type = 'promotion'
	  AND p.active = true
	  AND (p.starts_at IS NULL OR p.starts_at <= now())
	  AND (p.ends_at IS NULL OR p.ends_at > now())
	  AND (
	    p.applies_to_all = true
	    OR EXISTS (SELECT 1 FROM promotion_tool pt WHERE pt.promotion_id = p.id AND pt.tool_id = t.id)
	  )
)`;

interface PredicateFlags {
	withCategory: boolean;
	withPrice: boolean;
	withPromo: boolean;
	withVoltage: boolean;
}

function buildPredicates(
	input: FacetCountsInput,
	flags: PredicateFlags
): SQL {
	const filters = [STATUS_SQL, sql`t.visible_on_site = true`];

	if (input.search && input.search.trim() !== "") {
		const term = `%${input.search.trim()}%`;
		filters.push(sql`(t.name ILIKE ${term} OR t.model ILIKE ${term})`);
	}

	if (flags.withCategory && input.categoryId) {
		filters.push(sql`EXISTS (
			SELECT 1
			FROM tool_category tc
			JOIN category c ON c.id = tc.category_id
			JOIN category root ON root.id = ${input.categoryId}
			WHERE tc.tool_id = t.id
			  AND (c.id = root.id OR c.path LIKE root.path || '%')
		)`);
	}

	if (flags.withVoltage && input.voltages.length > 0) {
		filters.push(sql`EXISTS (
			SELECT 1 FROM tool_variant tvf
			WHERE tvf.tool_id = t.id
			  AND tvf.voltage::text IN (${sql.join(
					input.voltages.map((v) => sql`${v}`),
					sql`, `
				)})
		)`);
	}

	if (flags.withPrice && typeof input.priceMin === "number") {
		filters.push(
			sql`(SELECT MIN(price_amount) FROM tool_variant WHERE tool_id = t.id) >= ${input.priceMin}`
		);
	}
	if (flags.withPrice && typeof input.priceMax === "number") {
		filters.push(
			sql`(SELECT MIN(price_amount) FROM tool_variant WHERE tool_id = t.id) <= ${input.priceMax}`
		);
	}

	if (flags.withPromo && input.onlyPromo) {
		filters.push(PROMO_SQL);
	}

	return sql.join(filters, sql` AND `);
}

export async function getFacetCounts(
	input: FacetCountsInput
): Promise<FacetCounts> {
	// Cada faceta conta com TODOS os grupos aplicados, exceto o próprio.
	const exceptCategory = buildPredicates(input, {
		withCategory: false,
		withPrice: true,
		withPromo: true,
		withVoltage: true,
	});
	const exceptPrice = buildPredicates(input, {
		withCategory: true,
		withPrice: false,
		withPromo: true,
		withVoltage: true,
	});
	const exceptVoltage = buildPredicates(input, {
		withCategory: true,
		withPrice: true,
		withPromo: true,
		withVoltage: false,
	});
	const exceptPromo = buildPredicates(input, {
		withCategory: true,
		withPrice: true,
		withPromo: false,
		withVoltage: true,
	});

	const priceBuckets = PRICE_RANGES.map((r) => {
		const conds: SQL[] = [];
		if (r.pmin !== null) {
			conds.push(sql`s.minp >= ${r.pmin}`);
		}
		if (r.pmax !== null) {
			conds.push(sql`s.minp <= ${r.pmax}`);
		}
		return sql`COUNT(*) FILTER (WHERE ${sql.join(conds, sql` AND `)})::int AS ${sql.raw(`"${r.key}"`)}`;
	});

	const [categoryRes, priceRes, voltageRes, promoRes, totalRes] =
		await Promise.all([
			db.execute<{ category_id: string; n: number | string }>(sql`
				SELECT root.id AS category_id, COUNT(DISTINCT t.id)::int AS n
				FROM category root
				JOIN category c ON (c.id = root.id OR c.path LIKE root.path || '%')
				JOIN tool_category tc ON tc.category_id = c.id
				JOIN tool t ON t.id = tc.tool_id
				WHERE root.is_active = true AND ${exceptCategory}
				GROUP BY root.id
			`),
			db.execute<Record<PriceRangeKey, number | string>>(sql`
				SELECT ${sql.join(priceBuckets, sql`, `)}
				FROM (
					SELECT (SELECT MIN(price_amount) FROM tool_variant WHERE tool_id = t.id) AS minp
					FROM tool t
					WHERE ${exceptPrice}
				) s
			`),
			db.execute<{ voltage: VoltageKey; n: number | string }>(sql`
				SELECT tv.voltage::text AS voltage, COUNT(DISTINCT t.id)::int AS n
				FROM tool t
				JOIN tool_variant tv ON tv.tool_id = t.id
				WHERE tv.voltage IS NOT NULL AND ${exceptVoltage}
				GROUP BY tv.voltage
			`),
			db.execute<{ n: number | string }>(sql`
				SELECT COUNT(*)::int AS n
				FROM tool t
				WHERE ${exceptPromo} AND ${PROMO_SQL}
			`),
			db.execute<{ n: number | string }>(sql`
				SELECT COUNT(*)::int AS n
				FROM tool t
				WHERE ${exceptCategory}
			`),
		]);

	const byCategory: Record<string, number> = {};
	for (const row of categoryRes.rows) {
		byCategory[row.category_id] = Number(row.n) || 0;
	}

	const priceRow = priceRes.rows[0];
	const byPriceRange = Object.fromEntries(
		PRICE_RANGES.map((r) => [r.key, Number(priceRow?.[r.key]) || 0])
	) as Record<PriceRangeKey, number>;

	const byVoltage: Record<VoltageKey, number> = {
		"127V": 0,
		"220V": 0,
		Bivolt: 0,
		"380V": 0,
	};
	for (const row of voltageRes.rows) {
		byVoltage[row.voltage] = Number(row.n) || 0;
	}

	return {
		byCategory,
		byPriceRange,
		byVoltage,
		promo: Number(promoRes.rows[0]?.n) || 0,
		total: Number(totalRes.rows[0]?.n) || 0,
	};
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter=web test "facet-counts"`
Expected: PASS (6 testes). Se falhar por diferença de contagem, o predicado local divergiu de `buildToolListWhere` — comparar lado a lado com `packages/db/src/queries/tools.ts:89-136` antes de mexer em qualquer outra coisa.

- [ ] **Step 6: Confirmar que o CI não roda o teste**

Run: `VITEST_UNIT_ONLY=1 bun run --filter=web test:ci 2>&1 | grep -c "facet-counts"`
Expected: `0` (excluído pela lista INTEGRATION).

- [ ] **Step 7: Commit**

```bash
bun check-types --force && bun check
git add "apps/web/src/app/(shop)/catalog/_lib/facet-counts.ts" "apps/web/src/app/(shop)/catalog/_lib/facet-counts.test.ts" apps/web/vitest.config.ts
git commit -m "feat: facet counts do catálogo"
```

---

### Task 4: Componente `Switch` (base-lyra) no `packages/ui`

**Files:**
- Create: `packages/ui/src/components/switch.tsx`

**Interfaces:**
- Consumes: `@base-ui/react/switch` (primitivo Base UI já presente via `@base-ui/react`), `cn` de `@emach/ui/lib/utils`.
- Produces: `Switch` (export nomeado), props de `SwitchPrimitive.Root.Props` — em particular `checked: boolean`, `onCheckedChange: (checked: boolean) => void`, `id`. Task 6 usa `<Switch checked id onCheckedChange />`.

Nota: escrito à mão no idioma base-lyra dos vizinhos (`radio-group.tsx` é o modelo: primitivo Base UI + `cn` + `data-slot` + tokens semânticos). Evita o `shadcn add` (que não passa pelo hook de lint e traria estilo com radius default pra ajustar de qualquer jeito).

- [ ] **Step 1: Write the component**

```tsx
// packages/ui/src/components/switch.tsx
"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@emach/ui/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
	return (
		<SwitchPrimitive.Root
			className={cn(
				"relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full bg-border outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary",
				className
			)}
			data-slot="switch"
			{...props}
		>
			<SwitchPrimitive.Thumb
				className="block size-3.5 translate-x-0.5 rounded-full bg-white transition-transform data-checked:translate-x-[15px]"
				data-slot="switch-thumb"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
```

(Track exceção de radius: DESIGN.md permite círculo em controles — o switch é um controle, mesma classe de exceção do avatar/radio.)

- [ ] **Step 2: Verify types and lint**

Run: `bun check-types --force && bun check`
Expected: PASS nos dois. Se `@base-ui/react/switch` não resolver, conferir o nome do subpath com `ls node_modules/@base-ui/react/` a partir da raiz (o pacote expõe um diretório por primitivo).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/switch.tsx
git commit -m "feat: componente switch base-lyra"
```

---

### Task 5: Componente `CategoryDrilldown` (substitui `CategoryTree`)

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_components/category-drilldown.tsx`
- Delete: `apps/web/src/app/(shop)/catalog/_components/category-tree.tsx`
- Delete (se órfãos — ver Step 3): `apps/web/src/app/(shop)/catalog/_lib/category-tree.ts`, `apps/web/src/app/(shop)/catalog/_lib/category-tree.test.ts` + entrada `"**/catalog/_lib/category-tree.test.ts"` em `apps/web/vitest.config.ts`
- Modify (temporário, para o build não quebrar): `apps/web/src/app/(shop)/catalog/_components/filter-panel.tsx` (troca do import/uso — a reescrita completa do panel é a Task 6; aqui só a substituição mínima do bloco de categoria)

**Interfaces:**
- Consumes: `deriveDrilldownLevel`, `DrilldownLevel` (Task 2); `CategoryNode` de `@emach/db/queries/categories`; `cn` de `@emach/ui/lib/utils`; ícones `ArrowLeft`/`ChevronDown` de `lucide-react`.
- Produces: `CategoryDrilldown` com props:

```ts
interface CategoryDrilldownProps {
	activeSlug: string | null;
	/** facetCounts.byCategory (id → count). */
	counts: Record<string, number>;
	onSelect: (slug: string | null) => void;
	/** facetCounts.total — contagem da linha "Todas". */
	totalCount: number;
	tree: CategoryNode[];
}
```

Regras visuais (Global Constraints valem): SEM vermelho, SEM side-stripe; ativo = `bg-[#e6e6e6] font-bold`; linhas `min-h-11 lg:min-h-9`; contagem à direita em `text-[11.5px] text-gray-60 tabular-nums`; filhas do ativo com recuo + hairline (`ml-2.5 border-border border-l pl-1.5`) apenas quando `rowsAreChildren`.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/(shop)/catalog/_components/category-drilldown.tsx
"use client";

import type { CategoryNode } from "@emach/db/queries/categories";
import { cn } from "@emach/ui/lib/utils";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { deriveDrilldownLevel } from "../_lib/drilldown-level";

interface CategoryDrilldownProps {
	activeSlug: string | null;
	counts: Record<string, number>;
	onSelect: (slug: string | null) => void;
	totalCount: number;
	tree: CategoryNode[];
}

/**
 * Navegação de categoria por nível (drill-down): mostra só o nível atual,
 * a linha "voltar" e a categoria ativa. Clicar num item filtra por ele e
 * desce um nível; "voltar" filtra pelo pai. Substitui a árvore expandível.
 */
export function CategoryDrilldown({
	tree,
	activeSlug,
	counts,
	totalCount,
	onSelect,
}: CategoryDrilldownProps) {
	const level = deriveDrilldownLevel(tree, activeSlug);

	const rowClass =
		"flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-2 py-1 text-left text-[14px] text-gray-60 transition-colors hover:text-near-black lg:min-h-9";

	return (
		<nav aria-label="Categorias" className="flex flex-col">
			{level.back && (
				<button
					className="flex min-h-11 cursor-pointer items-center gap-1.5 px-2 py-1 text-left text-[13px] text-gray-60 transition-colors hover:text-near-black lg:min-h-9"
					onClick={() => onSelect(level.back?.slug ?? null)}
					type="button"
				>
					<ArrowLeft aria-hidden="true" className="size-3 shrink-0" />
					{level.back.name}
				</button>
			)}

			{level.active ? (
				<div
					aria-current="page"
					className="flex min-h-11 items-center bg-[#e6e6e6] px-2 py-1 font-bold text-[14px] text-near-black lg:min-h-9"
				>
					<span className="flex-1">{level.active.name}</span>
					<span className="pl-2 text-[11.5px] text-gray-60 tabular-nums">
						{counts[level.active.id] ?? 0}
					</span>
				</div>
			) : (
				<div
					aria-current="page"
					className="flex min-h-11 items-center bg-[#e6e6e6] px-2 py-1 font-bold text-[14px] text-near-black lg:min-h-9"
				>
					<span className="flex-1">Todas</span>
					<span className="pl-2 text-[11.5px] text-gray-60 tabular-nums">
						{totalCount}
					</span>
				</div>
			)}

			<div
				className={cn(
					"flex flex-col",
					level.rowsAreChildren && "ml-2.5 border-border border-l pl-1.5"
				)}
			>
				{level.rows.map((row) => (
					<button
						className={rowClass}
						key={row.id}
						onClick={() => onSelect(row.slug)}
						type="button"
					>
						<span className="flex-1">{row.name}</span>
						{row.hasChildren && (
							<ChevronDown
								aria-hidden="true"
								className="size-3 shrink-0 text-gray-60"
							/>
						)}
						<span className="pl-1 text-[11.5px] text-gray-60 tabular-nums">
							{counts[row.id] ?? 0}
						</span>
					</button>
				))}
			</div>
		</nav>
	);
}
```

- [ ] **Step 2: Substituição mínima no `filter-panel.tsx`**

Read `filter-panel.tsx`, depois: trocar o import `import { CategoryTree } from "./category-tree";` por `import { CategoryDrilldown } from "./category-drilldown";` e o bloco `<CategoryTree .../>` por:

```tsx
<CategoryDrilldown
	activeSlug={activeSlug}
	counts={{}}
	onSelect={onSelectCategory}
	totalCount={0}
	tree={tree}
/>
```

(`counts`/`totalCount` reais chegam na Task 6 via `facetCounts`; aqui o objetivo é o app compilar e navegar sem a árvore antiga.)

- [ ] **Step 3: Apagar a árvore antiga e verificar órfãos**

```bash
rm "apps/web/src/app/(shop)/catalog/_components/category-tree.tsx"
rg -n "collectPathToActive|category-tree" apps/web/src packages
```

- Se `collectPathToActive`/`_lib/category-tree` não tiver NENHUM uso restante além do próprio lib+teste: apagar `_lib/category-tree.ts` e `_lib/category-tree.test.ts`, e remover a linha `"**/catalog/_lib/category-tree.test.ts",` de `apps/web/vitest.config.ts`.
- Se aparecer uso em outro lugar (ex.: header/menu), manter o lib e apagar só o componente.

- [ ] **Step 4: Verify**

Run: `bun check-types --force && bun check && bun run --filter=web test:ci`
Expected: PASS nos três (o CI unit-only não depende do DB).

- [ ] **Step 5: Commit**

```bash
git add -A "apps/web/src/app/(shop)/catalog" apps/web/vitest.config.ts
git commit -m "feat: drill-down de categorias no filtro"
```

---

### Task 6: Reescrita do `FilterPanel` (acordeões) + fiação dos facet counts

**Files:**
- Modify: `apps/web/src/app/(shop)/catalog/_components/filter-panel.tsx` (reescrita completa)
- Modify: `apps/web/src/app/(shop)/catalog/_components/catalog-content.tsx` (prop `facetCounts`, handler de faixa de preço, repasse aos dois `FilterPanel`)
- Modify: `apps/web/src/app/(shop)/catalog/page.tsx` (calcular `getFacetCounts` no `Promise.all`, passar `facetCounts`)

**Interfaces:**
- Consumes: `Accordion/AccordionContent/AccordionItem/AccordionTrigger` de `@emach/ui/components/accordion`; `RadioGroup/RadioGroupItem` de `@emach/ui/components/radio-group`; `Switch` (Task 4); `CategoryDrilldown` (Task 5); `PRICE_RANGES`, `matchPriceRange` (Task 1); `getFacetCounts`, `FacetCounts` (Task 3).
- Produces: novas props do `FilterPanel` (o `idPrefix` e os callbacks existentes continuam):

```ts
interface FilterPanelProps {
	activeSlug: string | null;
	facetCounts: FacetCounts;
	idPrefix: string;
	onApplyPrice: () => void;
	onlyPromo: boolean;
	onPmaxChange: (value: string) => void;
	onPminChange: (value: string) => void;
	onSelectCategory: (slug: string | null) => void;
	onSelectPriceRange: (pmin: number | null, pmax: number | null) => void;
	onTogglePromo: (value: boolean) => void;
	onToggleVoltage: (value: VoltageKey) => void;
	pmaxValue: string;
	pminValue: string;
	priceMax: number | null;
	priceMin: number | null;
	tree: CategoryNode[];
	voltages: VoltageKey[];
}
```

- [ ] **Step 1: Reescrever `filter-panel.tsx`**

Read o arquivo atual primeiro. Substituir o conteúdo por:

```tsx
// apps/web/src/app/(shop)/catalog/_components/filter-panel.tsx
"use client";

import type { CategoryNode } from "@emach/db/queries/categories";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@emach/ui/components/accordion";
import { RadioGroup, RadioGroupItem } from "@emach/ui/components/radio-group";
import { Switch } from "@emach/ui/components/switch";
import { cn } from "@emach/ui/lib/utils";
import type { VoltageKey } from "../_lib/catalog-filters";
import type { FacetCounts } from "../_lib/facet-counts";
import { matchPriceRange, PRICE_RANGES } from "../_lib/price-ranges";
import { CategoryDrilldown } from "./category-drilldown";

const VOLTAGE_OPTIONS: VoltageKey[] = ["127V", "220V", "Bivolt", "380V"];
const FILTER_SECTIONS = ["categoria", "preco", "voltagem"];

interface FilterPanelProps {
	activeSlug: string | null;
	facetCounts: FacetCounts;
	/** Prefixo de id p/ evitar colisão entre instâncias (desktop × drawer). */
	idPrefix: string;
	onApplyPrice: () => void;
	onlyPromo: boolean;
	onPmaxChange: (value: string) => void;
	onPminChange: (value: string) => void;
	onSelectCategory: (slug: string | null) => void;
	onSelectPriceRange: (pmin: number | null, pmax: number | null) => void;
	onTogglePromo: (value: boolean) => void;
	onToggleVoltage: (value: VoltageKey) => void;
	pmaxValue: string;
	pminValue: string;
	priceMax: number | null;
	priceMin: number | null;
	tree: CategoryNode[];
	voltages: VoltageKey[];
}

/** Badge de nº de seleções ativas no header de um grupo. */
function SectionBadge({ count }: { count: number }) {
	if (count === 0) {
		return null;
	}
	return (
		<span className="ml-2 flex h-4 min-w-4 items-center justify-center bg-near-black px-1 font-bold text-[10px] text-white">
			{count}
		</span>
	);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="font-bold font-display text-[11.5px] text-near-black uppercase tracking-[0.14em]">
			{children}
		</span>
	);
}

/**
 * Corpo dos filtros do catálogo, compartilhado entre a sidebar desktop
 * (`hidden lg:block`) e o drawer mobile (`Sheet`). `idPrefix` mantém os
 * `htmlFor`/`id` únicos quando ambas as instâncias coexistem no DOM.
 */
export function FilterPanel({
	idPrefix,
	tree,
	activeSlug,
	facetCounts,
	onSelectCategory,
	pminValue,
	pmaxValue,
	priceMin,
	priceMax,
	onPminChange,
	onPmaxChange,
	onApplyPrice,
	onSelectPriceRange,
	onlyPromo,
	onTogglePromo,
	voltages,
	onToggleVoltage,
}: FilterPanelProps) {
	const promoId = `${idPrefix}-filter-promo`;
	const matchedRange = matchPriceRange(priceMin, priceMax);
	const hasPrice = priceMin !== null || priceMax !== null;

	return (
		<div>
			<Accordion defaultValue={FILTER_SECTIONS}>
				<AccordionItem value="categoria">
					<AccordionTrigger className="py-3.5 hover:no-underline">
						<SectionLabel>Categoria</SectionLabel>
						<SectionBadge count={activeSlug ? 1 : 0} />
					</AccordionTrigger>
					<AccordionContent className="pb-4">
						<CategoryDrilldown
							activeSlug={activeSlug}
							counts={facetCounts.byCategory}
							onSelect={onSelectCategory}
							totalCount={facetCounts.total}
							tree={tree}
						/>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="preco">
					<AccordionTrigger className="py-3.5 hover:no-underline">
						<SectionLabel>Preço</SectionLabel>
						<SectionBadge count={hasPrice ? 1 : 0} />
					</AccordionTrigger>
					<AccordionContent className="pb-4">
						<RadioGroup
							aria-label="Faixa de preço"
							onValueChange={(value) => {
								const range = PRICE_RANGES.find((r) => r.key === value);
								if (range) {
									onSelectPriceRange(range.pmin, range.pmax);
								}
							}}
							value={matchedRange ?? ""}
						>
							{PRICE_RANGES.map((r) => {
								const id = `${idPrefix}-price-${r.key}`;
								return (
									<label
										className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[14px] lg:min-h-9"
										htmlFor={id}
										key={r.key}
									>
										<RadioGroupItem id={id} value={r.key} />
										<span
											className={cn(
												"flex-1",
												matchedRange === r.key
													? "font-semibold text-near-black"
													: "text-gray-60"
											)}
										>
											{r.label}
										</span>
										<span className="text-[11.5px] text-gray-60 tabular-nums">
											{facetCounts.byPriceRange[r.key]}
										</span>
									</label>
								);
							})}
						</RadioGroup>
						<div className="mt-2.5 flex items-center gap-1.5">
							<input
								aria-label="Preço mínimo em reais"
								className="emach-input emach-input--sm w-full"
								inputMode="numeric"
								onChange={(e) => onPminChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										onApplyPrice();
									}
								}}
								placeholder="R$ mín"
								type="number"
								value={pminValue}
							/>
							<input
								aria-label="Preço máximo em reais"
								className="emach-input emach-input--sm w-full"
								inputMode="numeric"
								onChange={(e) => onPmaxChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										onApplyPrice();
									}
								}}
								placeholder="R$ máx"
								type="number"
								value={pmaxValue}
							/>
							<button
								className="flex h-9 shrink-0 cursor-pointer items-center border border-near-black bg-white px-3 font-display font-bold text-[12px] uppercase tracking-[0.08em] transition-colors hover:bg-near-black hover:text-white"
								onClick={onApplyPrice}
								type="button"
							>
								OK
							</button>
						</div>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="voltagem">
					<AccordionTrigger className="py-3.5 hover:no-underline">
						<SectionLabel>Voltagem</SectionLabel>
						<SectionBadge count={voltages.length} />
					</AccordionTrigger>
					<AccordionContent className="pb-4">
						<div className="grid grid-cols-2 gap-1.5">
							{VOLTAGE_OPTIONS.map((v) => {
								const selected = voltages.includes(v);
								const count = facetCounts.byVoltage[v];
								const disabled = count === 0 && !selected;
								return (
									<button
										aria-pressed={selected}
										className={cn(
											"flex min-h-11 cursor-pointer items-center justify-center gap-1.5 border font-semibold text-[13px] transition-colors lg:min-h-9",
											selected
												? "border-near-black bg-near-black text-white"
												: "border-border bg-white text-near-black hover:border-near-black",
											disabled &&
												"cursor-not-allowed opacity-45 hover:border-border"
										)}
										disabled={disabled}
										key={v}
										onClick={() => onToggleVoltage(v)}
										type="button"
									>
										{v}
										<span
											className={cn(
												"text-[11px] tabular-nums",
												selected ? "text-white/55" : "text-gray-60"
											)}
										>
											{count}
										</span>
									</button>
								);
							})}
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<label
				className="flex min-h-11 cursor-pointer items-center gap-2.5 border-border border-t py-3.5 lg:min-h-9"
				htmlFor={promoId}
			>
				<Switch
					checked={onlyPromo}
					id={promoId}
					onCheckedChange={(v) => onTogglePromo(v === true)}
				/>
				<span className="text-[14px]">Apenas em promoção</span>
				<span className="ml-auto text-[11.5px] text-gray-60 tabular-nums">
					{facetCounts.promo}
				</span>
			</label>
		</div>
	);
}
```

Nota Base UI: `Accordion` (Root) aceita `defaultValue` como array e abre múltiplos itens por padrão (`openMultiple` default true). Se o TS reclamar da assinatura de `onValueChange` do `RadioGroup` (Base UI tipa `value` como `unknown`), converter com `String(value)` antes do `find` — nunca `as any`.

- [ ] **Step 2: Fiar `catalog-content.tsx`**

Read o arquivo, depois:

1. Import: `import type { FacetCounts } from "../_lib/facet-counts";`
2. Adicionar em `CatalogContentProps`: `facetCounts: FacetCounts;` e desestruturar no componente.
3. Novo handler junto de `applyPriceFilters`:

```tsx
function selectPriceRange(pmin: number | null, pmax: number | null) {
	setPminLocal(pmin === null ? "" : String(pmin));
	setPmaxLocal(pmax === null ? "" : String(pmax));
	navigate({ pmin, pmax });
}
```

4. Nos DOIS usos de `<FilterPanel ...>` (sidebar desktop e drawer), adicionar as props novas:

```tsx
facetCounts={facetCounts}
onSelectPriceRange={selectPriceRange}
priceMax={priceMax}
priceMin={priceMin}
```

5. Remover o cabeçalho `FILTROS` duplicado da sidebar desktop? NÃO — manter o `<div className="pb-4 ...">FILTROS</div>` como está (o drawer tem o próprio header).

- [ ] **Step 3: Fiar `page.tsx`**

Read o arquivo, depois em `CatalogResults`:

```tsx
import { getFacetCounts } from "./_lib/facet-counts";
// ...
const [{ tools, total }, categoryTree, facetCounts] = await Promise.all([
	getTools(db, {
		categoryId,
		search,
		voltage: voltages.length > 0 ? voltages : undefined,
		priceMin,
		priceMax,
		onlyPromo,
		sort,
		limit: PAGE_SIZE,
		offset: (page - 1) * PAGE_SIZE,
	}),
	getCachedCategoryTree(),
	getFacetCounts({
		categoryId,
		search,
		voltages,
		priceMin,
		priceMax,
		onlyPromo,
	}),
]);
```

E passar `facetCounts={facetCounts}` no `<CatalogContent ...>`.

- [ ] **Step 4: Verify**

Run: `bun check-types --force && bun check && bun run --filter=web test:ci`
Expected: PASS nos três.

Run (integração, local): `bun run --filter=web test "facet-counts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(shop)/catalog"
git commit -m "feat: filtros do catálogo em acordeões"
```

---

### Task 7: Verificação integrada (run-time + perceptual + dados)

**Files:** nenhum novo (correções pontuais se o smoke acusar).

`bun check-types` não pega SQL inválido em template string — o smoke run-time é obrigatório (CLAUDE.md). "Pronto" exige 3 provas: funcional, perceptual e dados.

- [ ] **Step 1: Suíte completa local**

Run: `bun run --filter=web test`
Expected: PASS. Lembrete do CLAUDE.md: testes de integração contra o DB compartilhado são flaky sob concorrência — 1-3 falhas que SOMEM ao re-rodar isolado não são regressão; re-rodar o arquivo isolado antes de culpar a mudança.

- [ ] **Step 2: Smoke run-time (funcional + dados)**

Com o dev server na porta 3003 (já rodando nesta sessão; senão `bun dev:web`):

1. Visitar `http://localhost:3003/catalog` — painel renderiza com acordeões abertos, linha "Todas" com contagem.
2. Descer 2 níveis de categoria (ex.: Ferramentas Elétricas → Furadeiras e Parafusadeiras) — URL ganha `?cat=...`, grid filtra, "← voltar" aparece.
3. Selecionar a faixa "R$ 200 – 500" — URL ganha `pmin=200&pmax=500`, radio marcado, contagem da faixa = total exibido na toolbar.
4. **Prova de dados:** com um filtro de voltagem ativo, conferir que a contagem no selo bate com o total do grid ao clicar nele; conferir "Apenas em promoção" idem.
5. Erros SSR: `nextjs_call 3003 get_errors` (MCP next-devtools) — vazio.
6. Console do browser: sem erros novos.

- [ ] **Step 3: Prova perceptual**

Screenshot do painel novo lado a lado com o mockup escolhido (card B do brainstorming) e com uma tela irmã do sistema (ex.: `/cart`) — conferir: hairlines `border-border` visíveis, NENHUM vermelho no painel, labels condensed uppercase, cantos retos, badge near-black. Mobile: viewport ~400px, abrir o drawer, conferir alvos ≥44px e o rodapé "Ver N produtos".

- [ ] **Step 4: Commit de eventuais correções**

```bash
bun check-types --force && bun check
git add -A "apps/web/src/app/(shop)/catalog" packages/ui/src/components
git commit -m "fix: ajustes do smoke dos filtros"   # somente se houve correção
```

---

## Self-review (feito na escrita do plano)

- **Cobertura do spec:** drill-down (T2+T5), acordeões/selos/switch/faixas (T4+T6), facet counts com semântica de grupo (T3), sem vermelho/side-stripe (T5/T6), alvos 44px (T5/T6), rodapé do drawer já existia (nada a fazer), testes unit vs integração separados (T1/T2 unit; T3 INTEGRATION), smoke (T7).
- **Sem placeholders:** todo step de código tem o código.
- **Consistência de tipos:** `FacetCounts`/`getFacetCounts` (T3) = consumo em T6; `DrilldownLevel` (T2) = consumo em T5; `PRICE_RANGES`/`matchPriceRange` (T1) = consumo em T3/T6; props do `FilterPanel` (T6) casam com os dois call-sites de `catalog-content.tsx`.
