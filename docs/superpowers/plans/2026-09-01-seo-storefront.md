# SEO do storefront — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Canonical em toda rota indexável, dados estruturados de site e filiais, URL própria por categoria (`/catalog/[slug]`) com redirect das antigas, e páginas `/privacidade` e `/entrega` com copy humanizada.

**Architecture:** Três fases, uma por PR, na ordem 1 → 2 → 3. Toda lógica de SEO vira função pura em `apps/web/src/lib/seo/` (testável sem DB); componentes Server só buscam dados e delegam. A rota de categoria reaproveita `fetchCatalogData` passando o slug do path em vez da query; `buildHref` passa a devolver o path completo, então nenhum link novo gera `?cat=`. O redirect `?cat=` → `/catalog/[slug]` mora no `proxy.ts`.

**Tech Stack:** Next 16 (App Router, `cacheComponents`, `typedRoutes`), React 19, Drizzle/Postgres (Supabase compartilhado, só leitura), Vitest 2, Biome via `bun check`.

**Spec:** `docs/superpowers/specs/2026-09-01-seo-storefront-design.md`

## Global Constraints

- **Banco único dev=prod compartilhado. Nenhuma escrita em banco.** Todo código deste plano só lê. Nenhum `seed`/`INSERT`/`UPDATE`.
- **Não editar `packages/db/src/schema/*` nem `packages/db/src/queries/*`** (owned-by-dashboard, sincronizado por CI — ADR-0009). Wrappers `"use cache"` vivem em `apps/web`.
- **Nunca `cd apps/web`**: CWD é a raiz do monorepo; comandos com `--filter=web` ou paths absolutos.
- Banidos: `console.*` (usar `log` de `@/lib/evlog`), `: any`, `as any`, `@ts-ignore`, `key={index}`, `<img>` puro, `forwardRef`, `useMemo`/`useCallback` manuais, barrel files em `apps/web/src`, `.forEach` em hot path.
- `dangerouslySetInnerHTML` só em JSON-LD, com `// biome-ignore lint/security/noDangerouslySetInnerHtml: ...` e `<` escapado como `<`.
- **`typedRoutes: true`**: `href` de `<Link>` é validado pelo tsc. Rota dinâmica aceita template literal (`` `/catalog/${slug}` ``).
- **Nenhum texto novo menciona troca, devolução ou garantia.** Nenhuma promessa de prazo fixo de entrega.
- **Copy em pt-BR com acentuação correta.** Preço sempre `R$ 899,00`. Superfície clara = `bg-gray-10`; nunca `bg-white` em página ou card.
- Comandos de verificação (rodar da raiz):
  - tipos: `bun run --filter=web check-types`
  - lint/format: `bun check` (Ultracite/Biome; `bun check --fix` pra formatar)
  - testes unit: `bun run --filter=web test:ci`
  - teste isolado: `bun run --filter=web test <caminho relativo a apps/web>`
- Commits em Conventional Commits, subject ≤ 50 caracteres, português, sem atribuição de IA.
- Testes de integração (DB real) são flaky sob concorrência: falha em `catalog-data.test.ts` que some ao re-rodar isolado não é regressão.

---

## Mapa de arquivos

**Fase 1 (PR `feat/seo-quick-wins`)**
- Create `apps/web/src/lib/seo/canonical.ts` + `.test.ts` — `canonicalFor(path, baseUrl?)`.
- Create `apps/web/src/components/seo/json-ld-script.tsx` — `<JsonLdScript data />`, único lugar com `dangerouslySetInnerHTML`.
- Create `apps/web/src/lib/seo/site-json-ld.ts` + `.test.ts` — builders puros `Organization`/`WebSite`/`HardwareStore`.
- Create `apps/web/src/components/seo/site-json-ld.tsx` — busca (`use cache`) + render; montado em `app/(shop)/layout.tsx`.
- Create `apps/web/src/app/(shop)/product/[slug]/_lib/product-json-ld.ts` + `.test.ts` — builder puro do `Product`.
- Modify `apps/web/src/app/(shop)/product/[slug]/_components/product-json-ld.tsx` — vira wrapper fino.
- Modify `app/(shop)/page.tsx`, `app/(shop)/catalog/page.tsx`, `app/(shop)/product/[slug]/page.tsx`, `app/(shop)/sobre/page.tsx` — `alternates`.

**Fase 2 (PR `feat/seo-category-routes`)**
- Create `apps/web/src/app/(shop)/catalog/_lib/parse-search-params.ts` + `.test.ts`.
- Modify `apps/web/src/app/(shop)/catalog/_lib/catalog-filters.ts` + `.test.ts` — `buildHref` devolve path completo.
- Modify `apps/web/src/app/(shop)/catalog/_components/catalog-content.tsx` — navegação sem `usePathname`.
- Create `apps/web/src/app/(shop)/catalog/_components/catalog-results.tsx` — `CatalogResults` extraído de `page.tsx`.
- Create `apps/web/src/app/(shop)/catalog/_lib/category-shell.ts` — `getCategoryShell(slug)` (`use cache`).
- Create `apps/web/src/app/(shop)/catalog/[cat]/page.tsx`.
- Modify `apps/web/src/app/(shop)/catalog/page.tsx` — usa `CatalogResults`, ignora `cat`.
- Create `apps/web/src/lib/seo/catalog-redirect.ts` + `.test.ts` — `legacyCategoryRedirect(url)`.
- Modify `apps/web/src/proxy.ts` — redirect 308.
- Modify `components/category-tile.tsx`, `product/[slug]/_components/breadcrumb.tsx`, `related-products.tsx`, `_lib/product-json-ld.ts` (BreadcrumbList), `app/sitemap.ts`.

**Fase 3 (PR `feat/seo-institutional-pages`)**
- Create `apps/web/src/components/institutional-page.tsx` — layout compartilhado.
- Create `apps/web/src/app/(shop)/privacidade/{page.tsx,_content.ts}`.
- Create `apps/web/src/app/(shop)/entrega/{page.tsx,_content.ts}`.
- Create `apps/web/src/lib/seo/institutional-content.test.ts` — regra "sem troca/garantia".
- Modify `components/site-footer.tsx`, `app/sitemap.ts`, `components/hero-carousel.tsx`, metadata descriptions.

---

# Fase 1 — quick wins (PR 1)

### Task 1: Helper de canonical + aplicação nas rotas

**Files:**
- Create: `apps/web/src/lib/seo/canonical.ts`
- Test: `apps/web/src/lib/seo/canonical.test.ts`
- Modify: `apps/web/src/app/(shop)/page.tsx`, `apps/web/src/app/(shop)/catalog/page.tsx:62-66`, `apps/web/src/app/(shop)/product/[slug]/page.tsx:33-63`, `apps/web/src/app/(shop)/sobre/page.tsx:16-20`

**Interfaces:**
- Produces: `canonicalFor(path: string, baseUrl?: string): { canonical: string }` — `path` começa com `/`; query e barra final são descartadas; `baseUrl` default = `env.NEXT_PUBLIC_SITE_URL`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/src/lib/seo/canonical.test.ts
import { describe, expect, it } from "vitest";
import { canonicalFor } from "./canonical";

const BASE = "https://www.emachferramentas.com.br";

describe("canonicalFor", () => {
	it("home vira a raiz com barra", () => {
		expect(canonicalFor("/", BASE)).toEqual({ canonical: `${BASE}/` });
	});
	it("descarta query string", () => {
		expect(canonicalFor("/catalog?cat=furadeiras&page=2", BASE)).toEqual({
			canonical: `${BASE}/catalog`,
		});
	});
	it("descarta barra final", () => {
		expect(canonicalFor("/product/abc/", BASE)).toEqual({
			canonical: `${BASE}/product/abc`,
		});
	});
	it("tolera baseUrl com barra final", () => {
		expect(canonicalFor("/sobre", `${BASE}/`)).toEqual({
			canonical: `${BASE}/sobre`,
		});
	});
	it("usa NEXT_PUBLIC_SITE_URL quando baseUrl é omitido", () => {
		expect(canonicalFor("/sobre").canonical.endsWith("/sobre")).toBe(true);
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test src/lib/seo/canonical.test.ts`
Expected: FAIL — `Cannot find module './canonical'`

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/lib/seo/canonical.ts
import { env } from "@emach/env/web";

/**
 * `alternates.canonical` absoluto para uma rota. Query string e barra final
 * são descartadas: o canonical é sempre a URL "limpa" da rota, mesmo quando
 * a página aceita filtros por query (caso do /catalog).
 */
export function canonicalFor(
	path: string,
	baseUrl: string = env.NEXT_PUBLIC_SITE_URL
): { canonical: string } {
	const base = baseUrl.replace(/\/+$/, "");
	const withoutQuery = path.split("?")[0] ?? "/";
	const trimmed = withoutQuery.replace(/\/+$/, "");
	return { canonical: `${base}${trimmed === "" ? "/" : trimmed}` };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run --filter=web test src/lib/seo/canonical.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Aplicar nas rotas**

Home — `apps/web/src/app/(shop)/page.tsx` não exporta metadata hoje. Adicionar após os imports:

```ts
import type { Metadata } from "next";
import { canonicalFor } from "@/lib/seo/canonical";

export const metadata: Metadata = {
	alternates: canonicalFor("/"),
};
```

Catálogo — `apps/web/src/app/(shop)/catalog/page.tsx`, no objeto `metadata` existente:

```ts
export const metadata: Metadata = {
	title: "Catálogo",
	description:
		"Todas as ferramentas da EMACH: elétricas, manuais, medição e EPIs. Filtre por categoria, voltagem e preço.",
	// Canonical estático: a rota aceita 8 filtros por query e todos são a
	// mesma página. Não ler searchParams aqui (bloquearia o prerender do shell).
	alternates: canonicalFor("/catalog"),
};
```

Produto — `apps/web/src/app/(shop)/product/[slug]/page.tsx`, dentro de `generateMetadata`, após `const ogImage`:

```ts
	const path = `/product/${detail.tool.slug ?? detail.tool.id}`;
	return {
		title,
		description,
		alternates: canonicalFor(path),
		openGraph: {
			title,
			description,
			type: "website",
			url: path,
			siteName: "EMACH",
			...(ogImage ? { images: [ogImage] } : {}),
		},
		twitter: { /* inalterado */ },
	};
```

Sobre — `apps/web/src/app/(shop)/sobre/page.tsx`, no `metadata`: `alternates: canonicalFor("/sobre"),`.

Em cada arquivo, adicionar `import { canonicalFor } from "@/lib/seo/canonical";`.

- [ ] **Step 6: Tipos + lint**

Run: `bun run --filter=web check-types && bun check`
Expected: sem erros. Se o Biome reclamar de ordem de import, `bun check --fix`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/seo/canonical.ts apps/web/src/lib/seo/canonical.test.ts "apps/web/src/app/(shop)/page.tsx" "apps/web/src/app/(shop)/catalog/page.tsx" "apps/web/src/app/(shop)/product/[slug]/page.tsx" "apps/web/src/app/(shop)/sobre/page.tsx"
git commit -m "feat(seo): canonical nas rotas indexáveis"
```

---

### Task 2: Builders puros do JSON-LD de site (Organization, WebSite, HardwareStore)

**Files:**
- Create: `apps/web/src/lib/seo/site-json-ld.ts`
- Test: `apps/web/src/lib/seo/site-json-ld.test.ts`

**Interfaces:**
- Consumes: `BranchRow` de `@/lib/branches` (campos: `id, name, phone, businessHours, cep, street, streetNumber, neighborhood, city, state`), `BranchBusinessHours`/`BranchBusinessHoursPeriod` de `@emach/db/schema/inventory` (`{ weekdays, saturday, holidays }`, cada um `{ isOpen, opensAt, closesAt, breakStart, breakEnd }`, horas como `"08:00"`).
- Produces:
  - `openingHoursFor(hours: BranchBusinessHours | null): OpeningHoursSpecification[]`
  - `buildSiteGraph(input: { baseUrl: string; branches: BranchRow[]; sameAs: string[] }): SiteGraph` — objeto com `"@context"` e `"@graph": [Organization, WebSite, ...HardwareStore[]]`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/src/lib/seo/site-json-ld.test.ts
import type { BranchBusinessHours } from "@emach/db/schema/inventory";
import { describe, expect, it } from "vitest";
import type { BranchRow } from "@/lib/branches";
import { buildSiteGraph, openingHoursFor } from "./site-json-ld";

const BASE = "https://www.emachferramentas.com.br";

const hours: BranchBusinessHours = {
	weekdays: {
		isOpen: true,
		opensAt: "08:00",
		closesAt: "18:00",
		breakStart: "12:00",
		breakEnd: "13:00",
	},
	saturday: {
		isOpen: true,
		opensAt: "08:00",
		closesAt: "12:00",
		breakStart: null,
		breakEnd: null,
	},
	holidays: {
		isOpen: false,
		opensAt: null,
		closesAt: null,
		breakStart: null,
		breakEnd: null,
	},
};

const branch: BranchRow = {
	id: "b1",
	name: "Matriz",
	phone: "(16) 3333-4444",
	businessHours: hours,
	cep: "14270-000",
	street: "Rua das Ferramentas",
	streetNumber: "100",
	neighborhood: "Centro",
	city: "Santa Rosa de Viterbo",
	state: "SP",
};

describe("openingHoursFor", () => {
	it("quebra o intervalo de almoço em dois períodos", () => {
		const out = openingHoursFor(hours);
		expect(out).toEqual([
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
				opens: "08:00",
				closes: "12:00",
			},
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
				opens: "13:00",
				closes: "18:00",
			},
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: ["Saturday"],
				opens: "08:00",
				closes: "12:00",
			},
		]);
	});
	it("sem horário cadastrado devolve lista vazia", () => {
		expect(openingHoursFor(null)).toEqual([]);
	});
});

describe("buildSiteGraph", () => {
	it("monta Organization, WebSite e uma HardwareStore por filial", () => {
		const graph = buildSiteGraph({
			baseUrl: BASE,
			branches: [branch],
			sameAs: ["https://instagram.com/emach"],
		});
		expect(graph["@context"]).toBe("https://schema.org");
		const [org, site, store] = graph["@graph"];
		expect(org).toMatchObject({
			"@type": "Organization",
			"@id": `${BASE}/#organization`,
			name: "EMACH Ferramentas",
			url: `${BASE}/`,
			logo: `${BASE}/images/logos/icone.svg`,
			sameAs: ["https://instagram.com/emach"],
		});
		expect(site).toMatchObject({
			"@type": "WebSite",
			"@id": `${BASE}/#website`,
			inLanguage: "pt-BR",
			potentialAction: {
				"@type": "SearchAction",
				target: {
					"@type": "EntryPoint",
					urlTemplate: `${BASE}/catalog?q={search_term_string}`,
				},
				"query-input": "required name=search_term_string",
			},
		});
		expect(store).toMatchObject({
			"@type": "HardwareStore",
			"@id": `${BASE}/#branch-b1`,
			name: "EMACH Matriz",
			telephone: "+551633334444",
			parentOrganization: { "@id": `${BASE}/#organization` },
			address: {
				"@type": "PostalAddress",
				streetAddress: "Rua das Ferramentas, 100",
				addressLocality: "Santa Rosa de Viterbo",
				addressRegion: "SP",
				postalCode: "14270000",
				addressCountry: "BR",
			},
		});
		expect(store).toHaveProperty("openingHoursSpecification");
	});

	it("omite sameAs vazio, telefone ausente e horário ausente", () => {
		const graph = buildSiteGraph({
			baseUrl: BASE,
			branches: [{ ...branch, phone: null, businessHours: null }],
			sameAs: [],
		});
		const [org, , store] = graph["@graph"];
		expect(org).not.toHaveProperty("sameAs");
		expect(store).not.toHaveProperty("telephone");
		expect(store).not.toHaveProperty("openingHoursSpecification");
	});

	it("aceita baseUrl com barra final sem duplicar barra", () => {
		const graph = buildSiteGraph({ baseUrl: `${BASE}/`, branches: [], sameAs: [] });
		expect(graph["@graph"][0]).toMatchObject({ url: `${BASE}/` });
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test src/lib/seo/site-json-ld.test.ts`
Expected: FAIL — `Cannot find module './site-json-ld'`

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/lib/seo/site-json-ld.ts
import type { BranchBusinessHours } from "@emach/db/schema/inventory";
import type { BranchRow } from "@/lib/branches";

export const ORGANIZATION_NAME = "EMACH Ferramentas";

export interface OpeningHoursSpecification {
	"@type": "OpeningHoursSpecification";
	closes: string;
	dayOfWeek: string[];
	opens: string;
}

interface Organization {
	"@id": string;
	"@type": "Organization";
	logo: string;
	name: string;
	sameAs?: string[];
	url: string;
}

interface WebSite {
	"@id": string;
	"@type": "WebSite";
	inLanguage: "pt-BR";
	name: string;
	potentialAction: {
		"@type": "SearchAction";
		"query-input": string;
		target: { "@type": "EntryPoint"; urlTemplate: string };
	};
	publisher: { "@id": string };
	url: string;
}

interface HardwareStore {
	"@id": string;
	"@type": "HardwareStore";
	address: {
		"@type": "PostalAddress";
		addressCountry: "BR";
		addressLocality?: string;
		addressRegion?: string;
		postalCode?: string;
		streetAddress?: string;
	};
	name: string;
	openingHoursSpecification?: OpeningHoursSpecification[];
	parentOrganization: { "@id": string };
	telephone?: string;
	url: string;
}

export interface SiteGraph {
	"@context": "https://schema.org";
	"@graph": [Organization, WebSite, ...HardwareStore[]];
}

export interface SiteGraphInput {
	baseUrl: string;
	branches: BranchRow[];
	sameAs: string[];
}

// `holidays` não mapeia para dayOfWeek do schema.org — fica de fora.
const DAY_GROUPS: Array<{ days: string[]; key: "weekdays" | "saturday" }> = [
	{
		key: "weekdays",
		days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
	},
	{ key: "saturday", days: ["Saturday"] },
];

function spec(
	days: string[],
	opens: string,
	closes: string
): OpeningHoursSpecification {
	return { "@type": "OpeningHoursSpecification", dayOfWeek: days, opens, closes };
}

export function openingHoursFor(
	hours: BranchBusinessHours | null
): OpeningHoursSpecification[] {
	if (!hours) {
		return [];
	}
	const out: OpeningHoursSpecification[] = [];
	for (const group of DAY_GROUPS) {
		const period = hours[group.key];
		if (!(period?.isOpen && period.opensAt && period.closesAt)) {
			continue;
		}
		if (period.breakStart && period.breakEnd) {
			out.push(
				spec(group.days, period.opensAt, period.breakStart),
				spec(group.days, period.breakEnd, period.closesAt)
			);
		} else {
			out.push(spec(group.days, period.opensAt, period.closesAt));
		}
	}
	return out;
}

function digitsOnly(value: string | null): string {
	return value ? value.replace(/\D/g, "") : "";
}

/** Telefone BR em E.164 (+55DDDNÚMERO). Devolve undefined se não parecer BR. */
function e164(phone: string | null): string | undefined {
	const digits = digitsOnly(phone);
	if (digits.length === 10 || digits.length === 11) {
		return `+55${digits}`;
	}
	if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
		return `+${digits}`;
	}
	return;
}

function buildOrganization(base: string, sameAs: string[]): Organization {
	return {
		"@type": "Organization",
		"@id": `${base}/#organization`,
		name: ORGANIZATION_NAME,
		url: `${base}/`,
		logo: `${base}/images/logos/icone.svg`,
		...(sameAs.length > 0 ? { sameAs } : {}),
	};
}

function buildWebSite(base: string): WebSite {
	return {
		"@type": "WebSite",
		"@id": `${base}/#website`,
		name: ORGANIZATION_NAME,
		url: `${base}/`,
		inLanguage: "pt-BR",
		publisher: { "@id": `${base}/#organization` },
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${base}/catalog?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};
}

function buildHardwareStore(base: string, branch: BranchRow): HardwareStore {
	const streetAddress = [branch.street, branch.streetNumber]
		.filter(Boolean)
		.join(", ");
	const postalCode = digitsOnly(branch.cep);
	const telephone = e164(branch.phone);
	const hours = openingHoursFor(branch.businessHours);
	return {
		"@type": "HardwareStore",
		"@id": `${base}/#branch-${branch.id}`,
		name: `EMACH ${branch.name}`,
		url: `${base}/sobre#filiais`,
		parentOrganization: { "@id": `${base}/#organization` },
		address: {
			"@type": "PostalAddress",
			addressCountry: "BR",
			...(streetAddress ? { streetAddress } : {}),
			...(branch.city ? { addressLocality: branch.city } : {}),
			...(branch.state ? { addressRegion: branch.state } : {}),
			...(postalCode.length === 8 ? { postalCode } : {}),
		},
		...(telephone ? { telephone } : {}),
		...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
	};
}

export function buildSiteGraph(input: SiteGraphInput): SiteGraph {
	const base = input.baseUrl.replace(/\/+$/, "");
	return {
		"@context": "https://schema.org",
		"@graph": [
			buildOrganization(base, input.sameAs),
			buildWebSite(base),
			...input.branches.map((b) => buildHardwareStore(base, b)),
		],
	};
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run --filter=web test src/lib/seo/site-json-ld.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Lint + tipos, commit**

Run: `bun check && bun run --filter=web check-types`

```bash
git add apps/web/src/lib/seo/site-json-ld.ts apps/web/src/lib/seo/site-json-ld.test.ts
git commit -m "feat(seo): builders de Organization/WebSite/Store"
```

---

### Task 3: `JsonLdScript` + `SiteJsonLd` montado no layout do shop

**Files:**
- Create: `apps/web/src/components/seo/json-ld-script.tsx`
- Create: `apps/web/src/components/seo/site-json-ld.tsx`
- Modify: `apps/web/src/app/(shop)/layout.tsx`

**Interfaces:**
- Consumes: `buildSiteGraph` (Task 2), `getActiveBranches()` de `@/lib/branches`, `getStoreSocialLinks(db): Promise<{ network, url }[]>` de `@emach/db/queries/store-settings`.
- Produces: `<JsonLdScript data={object} />` (reutilizado na Task 4).

- [ ] **Step 1: Criar `JsonLdScript`**

```tsx
// apps/web/src/components/seo/json-ld-script.tsx

/**
 * Único ponto do app que injeta JSON-LD. `<` vira < para que dado do
 * catálogo (nome/descrição de produto) nunca feche o <script>.
 */
export function JsonLdScript({ data }: { data: object }) {
	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD exige <script> inline; "<" escapado bloqueia injeção via dados do catálogo
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, "\\u003c"),
			}}
			type="application/ld+json"
		/>
	);
}
```

- [ ] **Step 2: Criar `SiteJsonLd`**

```tsx
// apps/web/src/components/seo/site-json-ld.tsx
import { db } from "@emach/db";
import { getStoreSocialLinks } from "@emach/db/queries/store-settings";
import { env } from "@emach/env/web";
import { cacheLife } from "next/cache";

import { getActiveBranches } from "@/lib/branches";
import { buildSiteGraph } from "@/lib/seo/site-json-ld";

import { JsonLdScript } from "./json-ld-script";

// Mesmo TTL do footer (também lê storeSettings). Filiais e redes mudam raro.
async function loadSiteGraph() {
	"use cache";
	cacheLife({ revalidate: 3600 });
	const [socialLinks, branches] = await Promise.all([
		getStoreSocialLinks(db),
		getActiveBranches(),
	]);
	return buildSiteGraph({
		baseUrl: env.NEXT_PUBLIC_SITE_URL,
		branches,
		sameAs: socialLinks.map((s) => s.url),
	});
}

/** Organization + WebSite + uma HardwareStore por filial, em todas as páginas do shop. */
export async function SiteJsonLd() {
	const data = await loadSiteGraph();
	return <JsonLdScript data={data} />;
}
```

- [ ] **Step 3: Montar no layout**

```tsx
// apps/web/src/app/(shop)/layout.tsx
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import { SiteFooter } from "@/components/site-footer";

export default function ShopLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div className="flex min-h-screen flex-col">
			<SiteJsonLd />
			<div className="flex-1">{children}</div>
			<SiteFooter />
		</div>
	);
}
```

- [ ] **Step 4: Tipos + lint**

Run: `bun run --filter=web check-types && bun check`
Expected: sem erros.

- [ ] **Step 5: Smoke no dev server**

Se não houver servidor de pé: `bun dev:web` em background (porta 3001). Depois:

```bash
curl -s http://localhost:3001/ | grep -o '<script type="application/ld+json">[^<]*' | head -c 1500
```
Expected: JSON com `"@graph"` contendo `Organization`, `WebSite` e ao menos um `HardwareStore` (se houver filial ativa no banco). Sem erro no console do Next (`nextjs_call 3001 get_errors` via MCP `next-devtools`, se disponível).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/seo "apps/web/src/app/(shop)/layout.tsx"
git commit -m "feat(seo): JSON-LD de site e filiais no layout"
```

---

### Task 4: `Product` JSON-LD como builder puro, enriquecido

**Files:**
- Create: `apps/web/src/app/(shop)/product/[slug]/_lib/product-json-ld.ts`
- Test: `apps/web/src/app/(shop)/product/[slug]/_lib/product-json-ld.test.ts`
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-json-ld.tsx` (reescrever)

**Interfaces:**
- Consumes: `effectiveAutoDiscountCents(baseCents: number, discountType: string, discountValue: string): number` de `@/lib/promotions`; `numericToCents(amount: string): number` de `@/lib/format`; `JsonLdScript` (Task 3).
- Produces:
  - `ProductJsonLdInput` — subconjunto estrutural de `ToolDetail` (o componente passa `detail` direto).
  - `buildProductJsonLd(input: ProductJsonLdInput, opts: { baseUrl: string; now: Date }): object`
  - `buildBreadcrumbJsonLd(input: { baseUrl: string; category: { slug; name } | null; productName: string; slug: string }): object` — a Task 9 muda o item da categoria para `/catalog/${slug}`.
  - `priceValidUntil(promotion, now): string` — `YYYY-MM-DD`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/src/app/(shop)/product/[slug]/_lib/product-json-ld.test.ts
import { describe, expect, it } from "vitest";
import {
	buildBreadcrumbJsonLd,
	buildProductJsonLd,
	priceValidUntil,
	type ProductJsonLdInput,
} from "./product-json-ld";

const BASE = "https://www.emachferramentas.com.br";
const NOW = new Date("2026-09-01T12:00:00Z");

const input: ProductJsonLdInput = {
	activePromotion: null,
	images: [{ url: "https://cdn/img1.jpg" }, { url: "https://cdn/img2.jpg" }],
	reviewStats: { avg: 4.456, count: 3 },
	stockByVariant: { v1: true, v2: false },
	tool: {
		id: "t1",
		slug: "furadeira-x",
		name: "Furadeira X",
		description: "Furadeira de impacto <b>profissional</b>",
		manufacturerName: "Bosch",
	},
	variants: [
		{ id: "v1", sku: "FX-127", priceAmount: "899.00" },
		{ id: "v2", sku: "FX-220", priceAmount: "899.00" },
	],
};

describe("priceValidUntil", () => {
	it("usa o fim da promoção quando existe", () => {
		expect(
			priceValidUntil({ endsAt: new Date("2026-10-15T03:00:00Z") }, NOW)
		).toBe("2026-10-15");
	});
	it("sem promoção (ou sem fim) vale um ano a partir de agora", () => {
		expect(priceValidUntil(null, NOW)).toBe("2027-09-01");
		expect(priceValidUntil({ endsAt: null }, NOW)).toBe("2027-09-01");
	});
});

describe("buildProductJsonLd", () => {
	it("monta uma Offer por variante com condição, validade e disponibilidade", () => {
		const data = buildProductJsonLd(input, { baseUrl: BASE, now: NOW });
		expect(data).toMatchObject({
			"@context": "https://schema.org",
			"@type": "Product",
			name: "Furadeira X",
			sku: "FX-127",
			brand: { "@type": "Brand", name: "Bosch" },
			image: ["https://cdn/img1.jpg", "https://cdn/img2.jpg"],
			aggregateRating: {
				"@type": "AggregateRating",
				ratingValue: 4.46,
				reviewCount: 3,
			},
		});
		expect(data.offers).toEqual([
			{
				"@type": "Offer",
				"@id": `${BASE}/product/furadeira-x#offer-FX-127`,
				url: `${BASE}/product/furadeira-x`,
				sku: "FX-127",
				price: "899.00",
				priceCurrency: "BRL",
				availability: "https://schema.org/InStock",
				itemCondition: "https://schema.org/NewCondition",
				priceValidUntil: "2027-09-01",
			},
			{
				"@type": "Offer",
				"@id": `${BASE}/product/furadeira-x#offer-FX-220`,
				url: `${BASE}/product/furadeira-x`,
				sku: "FX-220",
				price: "899.00",
				priceCurrency: "BRL",
				availability: "https://schema.org/OutOfStock",
				itemCondition: "https://schema.org/NewCondition",
				priceValidUntil: "2027-09-01",
			},
		]);
		expect(data).not.toHaveProperty("hasMerchantReturnPolicy");
	});

	it("aplica a promoção ao preço e ao priceValidUntil", () => {
		const data = buildProductJsonLd(
			{
				...input,
				variants: input.variants.slice(0, 1),
				activePromotion: {
					discountType: "percent",
					discountValue: "10.00",
					endsAt: new Date("2026-09-30T03:00:00Z"),
				},
			},
			{ baseUrl: BASE, now: NOW }
		);
		// uma variante só → offers é objeto, não array
		expect(data.offers).toMatchObject({
			price: "809.10",
			priceValidUntil: "2026-09-30",
		});
	});

	it("omite rating sem avaliações e usa id quando não há slug", () => {
		const data = buildProductJsonLd(
			{
				...input,
				reviewStats: { avg: null, count: 0 },
				tool: { ...input.tool, slug: null },
			},
			{ baseUrl: BASE, now: NOW }
		);
		expect(data).not.toHaveProperty("aggregateRating");
		expect(data.offers[0]?.url).toBe(`${BASE}/product/t1`);
	});
});

describe("buildBreadcrumbJsonLd", () => {
	it("inclui a categoria quando existe", () => {
		const data = buildBreadcrumbJsonLd({
			baseUrl: BASE,
			category: { slug: "furadeiras", name: "Furadeiras" },
			productName: "Furadeira X",
			slug: "furadeira-x",
		});
		expect(data.itemListElement.map((i) => i.name)).toEqual([
			"Início",
			"Catálogo",
			"Furadeiras",
			"Furadeira X",
		]);
		expect(data.itemListElement[2]?.item).toBe(
			`${BASE}/catalog?cat=furadeiras`
		);
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test "src/app/(shop)/product/[slug]/_lib/product-json-ld.test.ts"`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o builder**

```ts
// apps/web/src/app/(shop)/product/[slug]/_lib/product-json-ld.ts
import { numericToCents } from "@/lib/format";
import { effectiveAutoDiscountCents } from "@/lib/promotions";

/** Subconjunto estrutural de ToolDetail usado pelo JSON-LD (fixture-friendly). */
export interface ProductJsonLdInput {
	activePromotion: {
		discountType: string;
		discountValue: string;
		endsAt: Date | null;
	} | null;
	images: Array<{ url: string }>;
	reviewStats: { avg: number | null; count: number };
	stockByVariant: Record<string, boolean>;
	tool: {
		description: string | null;
		id: string;
		manufacturerName: string | null;
		name: string;
		slug: string | null;
	};
	variants: Array<{ id: string; priceAmount: string; sku: string }>;
}

export interface Offer {
	"@id": string;
	"@type": "Offer";
	availability: "https://schema.org/InStock" | "https://schema.org/OutOfStock";
	itemCondition: "https://schema.org/NewCondition";
	price: string;
	priceCurrency: "BRL";
	priceValidUntil: string;
	sku: string;
	url: string;
}

export interface ProductJsonLd {
	"@context": "https://schema.org";
	"@type": "Product";
	aggregateRating?: {
		"@type": "AggregateRating";
		ratingValue: number;
		reviewCount: number;
	};
	brand?: { "@type": "Brand"; name: string };
	description?: string;
	image?: string[];
	name: string;
	offers: Offer | Offer[];
	sku?: string;
}

export interface BreadcrumbJsonLd {
	"@context": "https://schema.org";
	"@type": "BreadcrumbList";
	itemListElement: Array<{
		"@type": "ListItem";
		item: string;
		name: string;
		position: number;
	}>;
}

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** Fim da promoção ativa; sem promoção (ou sem fim) vale um ano. */
export function priceValidUntil(
	promotion: { endsAt: Date | null } | null,
	now: Date
): string {
	if (promotion?.endsAt) {
		return isoDate(promotion.endsAt);
	}
	const next = new Date(now);
	next.setUTCFullYear(next.getUTCFullYear() + 1);
	return isoDate(next);
}

function finalPriceAmount(
	priceAmount: string,
	promotion: ProductJsonLdInput["activePromotion"]
): string {
	if (!promotion) {
		return priceAmount;
	}
	const baseCents = numericToCents(priceAmount);
	const discountedCents = effectiveAutoDiscountCents(
		baseCents,
		promotion.discountType,
		promotion.discountValue
	);
	if (discountedCents >= baseCents) {
		return priceAmount;
	}
	return (discountedCents / 100).toFixed(2);
}

export function buildProductJsonLd(
	input: ProductJsonLdInput,
	opts: { baseUrl: string; now: Date }
): ProductJsonLd {
	const base = opts.baseUrl.replace(/\/+$/, "");
	const { tool, variants, images, stockByVariant, reviewStats } = input;
	const url = `${base}/product/${tool.slug ?? tool.id}`;
	const validUntil = priceValidUntil(input.activePromotion, opts.now);

	const offers: Offer[] = variants.map((v) => ({
		"@type": "Offer",
		"@id": `${url}#offer-${v.sku}`,
		url,
		sku: v.sku,
		price: finalPriceAmount(v.priceAmount, input.activePromotion),
		priceCurrency: "BRL",
		availability: stockByVariant[v.id]
			? "https://schema.org/InStock"
			: "https://schema.org/OutOfStock",
		itemCondition: "https://schema.org/NewCondition",
		priceValidUntil: validUntil,
	}));

	return {
		"@context": "https://schema.org",
		"@type": "Product",
		name: tool.name,
		...(tool.description ? { description: tool.description } : {}),
		...(images.length > 0 ? { image: images.map((i) => i.url) } : {}),
		...(variants[0] ? { sku: variants[0].sku } : {}),
		...(tool.manufacturerName
			? { brand: { "@type": "Brand", name: tool.manufacturerName } }
			: {}),
		offers: offers.length === 1 && offers[0] ? offers[0] : offers,
		...(reviewStats.count > 0 && reviewStats.avg !== null
			? {
					aggregateRating: {
						"@type": "AggregateRating",
						ratingValue: Number(reviewStats.avg.toFixed(2)),
						reviewCount: reviewStats.count,
					},
				}
			: {}),
	};
}

export function buildBreadcrumbJsonLd(input: {
	baseUrl: string;
	category: { name: string; slug: string } | null;
	productName: string;
	slug: string;
}): BreadcrumbJsonLd {
	const base = input.baseUrl.replace(/\/+$/, "");
	const items = [
		{ name: "Início", item: `${base}/` },
		{ name: "Catálogo", item: `${base}/catalog` },
		...(input.category
			? [
					{
						name: input.category.name,
						item: `${base}/catalog?cat=${input.category.slug}`,
					},
				]
			: []),
		{ name: input.productName, item: `${base}/product/${input.slug}` },
	];
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((entry, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: entry.name,
			item: entry.item,
		})),
	};
}
```

Nota: no teste de "offers é objeto" acima, `data.offers` tem tipo `Offer | Offer[]`; `toMatchObject` aceita. No teste "usa id quando não há slug", `data.offers[0]` só compila se `offers` for array — reescrever essa asserção como:

```ts
		const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
		expect(offers[0]?.url).toBe(`${BASE}/product/t1`);
```

e no primeiro teste `expect(data.offers).toEqual([...])` continua válido.

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run --filter=web test "src/app/(shop)/product/[slug]/_lib/product-json-ld.test.ts"`
Expected: PASS (6 testes). Se `809.10` falhar, conferir `effectiveAutoDiscountCents` para `percent`/`10.00` sobre 89900 centavos (esperado 80910) e ajustar a fixture, não o builder.

- [ ] **Step 5: Reescrever o componente como wrapper**

```tsx
// apps/web/src/app/(shop)/product/[slug]/_components/product-json-ld.tsx
import type { ToolDetail } from "@emach/db/queries/tools";
import { env } from "@emach/env/web";

import { JsonLdScript } from "@/components/seo/json-ld-script";

import {
	buildBreadcrumbJsonLd,
	buildProductJsonLd,
} from "../_lib/product-json-ld";

const BASE_URL = env.NEXT_PUBLIC_SITE_URL;

export function ProductJsonLd({ detail }: { detail: ToolDetail }) {
	// `new Date()` aqui roda dentro do shell cacheado da PDP (getProductShell,
	// 10min) — priceValidUntil "congela" por janela, o que é aceitável.
	const data = buildProductJsonLd(detail, {
		baseUrl: BASE_URL,
		now: new Date(),
	});
	return <JsonLdScript data={data} />;
}

export function BreadcrumbJsonLd({
	category,
	productName,
	slug,
}: {
	category: { slug: string; name: string } | null;
	productName: string;
	slug: string;
}) {
	const data = buildBreadcrumbJsonLd({
		baseUrl: BASE_URL,
		category,
		productName,
		slug,
	});
	return <JsonLdScript data={data} />;
}
```

`ToolDetail` satisfaz `ProductJsonLdInput` estruturalmente (`Promotion.endsAt: Date | null`, `discountType/discountValue: string`, `ToolVariant.sku/priceAmount: string`). Se o tsc reclamar de algum campo, ajustar a interface de entrada, nunca fazer cast.

- [ ] **Step 6: Tipos, lint, suíte unit**

Run: `bun run --filter=web check-types && bun check && bun run --filter=web test:ci`
Expected: tudo verde.

- [ ] **Step 7: Smoke**

```bash
curl -s "http://localhost:3001/product/<slug real>" | grep -o '"@type":"Offer"[^}]*' | head -2
```
Expected: cada Offer com `itemCondition` e `priceValidUntil`.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/_lib" "apps/web/src/app/(shop)/product/[slug]/_components/product-json-ld.tsx"
git commit -m "feat(seo): Product JSON-LD com condição e validade"
```

---

### Task 5: Fechar o PR 1

- [ ] **Step 1: Verificação completa**

Run: `bun run --filter=web check-types && bun check && bun run --filter=web test:ci`
Expected: verde. Colar a saída no relatório.

- [ ] **Step 2: Smoke das 4 rotas**

Com o dev server de pé, para `/`, `/catalog?cat=<slug>&page=2`, `/product/<slug>`, `/sobre`:

```bash
curl -s "http://localhost:3001/catalog?cat=furadeiras&page=2" | grep -o '<link rel="canonical"[^>]*>'
```
Expected: `<link rel="canonical" href="http://localhost:3001/catalog"/>` (sem query). Home termina em `/`, produto em `/product/<slug>`.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/seo-storefront
gh pr create --title "feat(seo): canonical e dados estruturados" --body "$(cat <<'EOF'
## O que muda

- `alternates.canonical` em home, catálogo (estático, ignora filtros), produto e sobre.
- JSON-LD de site no layout do shop: `Organization` (com `sameAs` das redes visíveis), `WebSite` com `SearchAction`, e uma `HardwareStore` por filial ativa (endereço, telefone E.164, horário com intervalo de almoço).
- `Product` JSON-LD extraído para builder puro, com `itemCondition`, `priceValidUntil` (fim da promoção ou +1 ano) e `@id` por oferta. Sem `hasMerchantReturnPolicy` (não há política publicada) e sem `shippingDetails` (frete é cotado por CEP).

Spec: `docs/superpowers/specs/2026-09-01-seo-storefront-design.md` (Track 1).

## Testes

- `lib/seo/canonical.test.ts`, `lib/seo/site-json-ld.test.ts`, `product/[slug]/_lib/product-json-ld.test.ts` (unit).
- Smoke: canonical sem query em `/catalog?cat=...&page=2`; `@graph` presente na home.
EOF
)"
```

Reler o corpo do PR com `/unslop` antes de criar. Link do PR no relatório.

---

# Fase 2 — `/catalog/[slug]` (PR 2)

> Branch: continuar em `feat/seo-storefront` **após** o PR 1 mergeado, ou abrir `feat/seo-category-routes` a partir da `main` atualizada. Se o PR 1 ainda estiver aberto, criar a branch a partir dele (`git checkout -b feat/seo-category-routes feat/seo-storefront`) e marcar o PR 2 como dependente.

### Task 6: Extrair o parse de `searchParams` do catálogo

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_lib/parse-search-params.ts`
- Test: `apps/web/src/app/(shop)/catalog/_lib/parse-search-params.test.ts`
- Modify: `apps/web/src/app/(shop)/catalog/page.tsx` (remove `VALID_SORTS`, `VALID_VOLTAGES`, `parseSort`, `parseVoltages`, `parsePositiveInt`, `CatalogPageProps.searchParams`)

**Interfaces:**
- Consumes: `SortKey`, `VoltageKey` de `./catalog-filters`.
- Produces:
  ```ts
  export type CatalogSearchParams = { cat?: string; q?: string; page?: string; sort?: string; voltage?: string; pmin?: string; pmax?: string; promo?: string };
  export interface ParsedCatalogParams { onlyPromo: boolean; page: number; priceMax?: number; priceMin?: number; q: string; search?: string; sort: SortKey; voltages: VoltageKey[] }
  export function parseCatalogSearchParams(params: CatalogSearchParams): ParsedCatalogParams
  ```

- [ ] **Step 1: Teste que falha**

```ts
// apps/web/src/app/(shop)/catalog/_lib/parse-search-params.test.ts
import { describe, expect, it } from "vitest";
import { parseCatalogSearchParams } from "./parse-search-params";

describe("parseCatalogSearchParams", () => {
	it("defaults com params vazios", () => {
		expect(parseCatalogSearchParams({})).toEqual({
			onlyPromo: false,
			page: 1,
			priceMax: undefined,
			priceMin: undefined,
			q: "",
			search: undefined,
			sort: "relevance",
			voltages: [],
		});
	});
	it("descarta sort e voltagem inválidos, mantém válidos", () => {
		const out = parseCatalogSearchParams({
			sort: "price-asc",
			voltage: "127V,999V,Bivolt",
		});
		expect(out.sort).toBe("price-asc");
		expect(out.voltages).toEqual(["127V", "Bivolt"]);
		expect(parseCatalogSearchParams({ sort: "xyz" }).sort).toBe("relevance");
	});
	it("page mínima é 1; preços negativos ou NaN viram undefined", () => {
		const out = parseCatalogSearchParams({ page: "0", pmin: "-5", pmax: "abc" });
		expect(out.page).toBe(1);
		expect(out.priceMin).toBeUndefined();
		expect(out.priceMax).toBeUndefined();
		expect(parseCatalogSearchParams({ page: "3", pmin: "100" })).toMatchObject({
			page: 3,
			priceMin: 100,
		});
	});
	it("q vazio ou só espaços não vira search", () => {
		expect(parseCatalogSearchParams({ q: "   " })).toMatchObject({
			q: "   ",
			search: undefined,
		});
		expect(parseCatalogSearchParams({ q: " serra " })).toMatchObject({
			q: " serra ",
			search: "serra",
		});
	});
	it("promo=1 liga onlyPromo", () => {
		expect(parseCatalogSearchParams({ promo: "1" }).onlyPromo).toBe(true);
		expect(parseCatalogSearchParams({ promo: "true" }).onlyPromo).toBe(false);
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test "src/app/(shop)/catalog/_lib/parse-search-params.test.ts"`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar (mover o código de `page.tsx`)**

```ts
// apps/web/src/app/(shop)/catalog/_lib/parse-search-params.ts
import type { SortKey, VoltageKey } from "./catalog-filters";

const VALID_SORTS: readonly SortKey[] = [
	"relevance",
	"price-asc",
	"price-desc",
	"name-asc",
	"newest",
];

const VALID_VOLTAGES: readonly VoltageKey[] = ["127V", "220V", "Bivolt", "380V"];

export interface CatalogSearchParams {
	cat?: string;
	page?: string;
	pmax?: string;
	pmin?: string;
	promo?: string;
	q?: string;
	sort?: string;
	voltage?: string;
}

export interface ParsedCatalogParams {
	onlyPromo: boolean;
	page: number;
	priceMax?: number;
	priceMin?: number;
	/** Texto cru do input (pra repovoar o campo). */
	q: string;
	/** Texto normalizado usado na query; undefined quando vazio. */
	search?: string;
	sort: SortKey;
	voltages: VoltageKey[];
}

function parseSort(value: string | undefined): SortKey {
	return value && (VALID_SORTS as readonly string[]).includes(value)
		? (value as SortKey)
		: "relevance";
}

function parseVoltages(value: string | undefined): VoltageKey[] {
	if (!value) {
		return [];
	}
	return value
		.split(",")
		.filter((v): v is VoltageKey =>
			(VALID_VOLTAGES as readonly string[]).includes(v)
		);
}

function parsePositiveInt(value: string | undefined): number | undefined {
	if (!value) {
		return;
	}
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseCatalogSearchParams(
	params: CatalogSearchParams
): ParsedCatalogParams {
	const q = params.q ?? "";
	const trimmed = q.trim();
	return {
		onlyPromo: params.promo === "1",
		page: Math.max(1, parsePositiveInt(params.page) ?? 1),
		priceMax: parsePositiveInt(params.pmax),
		priceMin: parsePositiveInt(params.pmin),
		q,
		search: trimmed ? trimmed : undefined,
		sort: parseSort(params.sort),
		voltages: parseVoltages(params.voltage),
	};
}
```

(`value as SortKey` após o `includes` é o mesmo narrowing que o código atual já faz; não é `as any`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run --filter=web test "src/app/(shop)/catalog/_lib/parse-search-params.test.ts"`
Expected: PASS (5 testes)

- [ ] **Step 5: Usar em `page.tsx`**

Em `apps/web/src/app/(shop)/catalog/page.tsx`: apagar `VALID_SORTS`, `VALID_VOLTAGES`, `SortKey`, `VoltageKey`, `parseSort`, `parseVoltages`, `parsePositiveInt`. `CatalogPageProps` vira:

```ts
import type { CatalogSearchParams } from "./_lib/parse-search-params";
import { parseCatalogSearchParams } from "./_lib/parse-search-params";

interface CatalogPageProps {
	searchParams: Promise<CatalogSearchParams>;
}
```

`CatalogResults`:

```tsx
async function CatalogResults({ searchParams }: CatalogPageProps) {
	const params = await searchParams;
	const parsed = parseCatalogSearchParams(params);

	const { categoryTree, currentCategory, facetCounts, tools, total, voltagesByTool } =
		await getCatalogData({
			cat: params.cat,
			search: parsed.search,
			voltages: parsed.voltages,
			priceMin: parsed.priceMin,
			priceMax: parsed.priceMax,
			onlyPromo: parsed.onlyPromo,
			sort: parsed.sort,
			page: parsed.page,
		});

	return (
		<CatalogContent
			categoryTree={categoryTree}
			currentCategoryDescription={currentCategory?.description ?? null}
			currentCategoryName={currentCategory?.name ?? null}
			currentCategorySlug={currentCategory?.slug ?? null}
			facetCounts={facetCounts}
			onlyPromo={parsed.onlyPromo}
			page={parsed.page}
			pageSize={CATALOG_PAGE_SIZE}
			priceMax={parsed.priceMax ?? null}
			priceMin={parsed.priceMin ?? null}
			query={parsed.q}
			sort={parsed.sort}
			tools={tools}
			total={total}
			voltages={parsed.voltages}
			voltagesByTool={voltagesByTool}
		/>
	);
}
```

- [ ] **Step 6: Tipos, lint, commit**

Run: `bun run --filter=web check-types && bun check`

```bash
git add "apps/web/src/app/(shop)/catalog/_lib/parse-search-params.ts" "apps/web/src/app/(shop)/catalog/_lib/parse-search-params.test.ts" "apps/web/src/app/(shop)/catalog/page.tsx"
git commit -m "refactor(catalog): extrai parse de searchParams"
```

---

### Task 7: `buildHref` devolve o path completo (`/catalog/[slug]`)

**Files:**
- Modify: `apps/web/src/app/(shop)/catalog/_lib/catalog-filters.ts:36-76`
- Modify: `apps/web/src/app/(shop)/catalog/_lib/catalog-filters.test.ts:18-33`
- Modify: `apps/web/src/app/(shop)/catalog/_components/catalog-content.tsx:68-112`

**Interfaces:**
- Produces: `buildHref(current: FilterState, updates: FilterUpdate): string` — agora retorna `"/catalog"`, `"/catalog/<slug>"`, ou esses com `?...`. `cat` **nunca** vai na query.

- [ ] **Step 1: Atualizar os testes (falham contra o código atual)**

Em `catalog-filters.test.ts`, substituir o bloco `describe("buildHref")`:

```ts
describe("buildHref", () => {
	it("sem filtros devolve a raiz do catálogo", () => {
		expect(buildHref(base, {})).toBe("/catalog");
	});
	it("categoria vai no path, nunca na query", () => {
		expect(
			buildHref(base, { cat: "furadeiras", sort: "relevance", page: 1 })
		).toBe("/catalog/furadeiras");
	});
	it("mantém a categoria atual ao mudar outro filtro", () => {
		expect(
			buildHref(
				{ ...base, currentCategorySlug: "serras", currentCategoryName: "Serras" },
				{ sort: "price-asc" }
			)
		).toBe("/catalog/serras?sort=price-asc");
	});
	it("cat: null volta pra raiz preservando os demais filtros", () => {
		expect(
			buildHref(
				{ ...base, currentCategorySlug: "serras", currentCategoryName: "Serras" },
				{ cat: null, promo: true }
			)
		).toBe("/catalog?promo=1");
	});
	it("serializa voltagens separadas por vírgula", () => {
		expect(buildHref(base, { voltage: ["127V", "220V"] })).toBe(
			"/catalog?voltage=127V%2C220V"
		);
	});
	it("escapa slug com caractere especial", () => {
		expect(buildHref(base, { cat: "epi/luvas" })).toBe("/catalog/epi%2Fluvas");
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test "src/app/(shop)/catalog/_lib/catalog-filters.test.ts"`
Expected: FAIL nos 6 casos de `buildHref` (retorno começa com `?` ou `""`).

- [ ] **Step 3: Implementar**

Em `catalog-filters.ts`, dentro de `buildHref`, remover o bloco `if (cat) { params.set("cat", cat); }` e trocar o final:

```ts
	const path = cat ? `/catalog/${encodeURIComponent(cat)}` : "/catalog";
	const qs = params.toString();
	return qs ? `${path}?${qs}` : path;
```

Atualizar o comentário/JSDoc da função:

```ts
/**
 * Href completo do catálogo para um estado de filtros. A categoria vive no
 * PATH (`/catalog/<slug>`, rota indexável com metadata própria); os demais
 * filtros vão na query. `page: null` remove a paginação.
 */
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run --filter=web test "src/app/(shop)/catalog/_lib/catalog-filters.test.ts"`
Expected: PASS.

- [ ] **Step 5: Atualizar `catalog-content.tsx`**

Remover `usePathname` do import de `next/navigation` e a linha `const pathname = usePathname();`. Trocar as três funções:

```ts
	function navigate(updates: FilterUpdate) {
		const href = buildHref(current, { ...updates, page: null }) as Route;
		startTransition(() => {
			router.replace(href, { scroll: false });
		});
	}

	function clearAll() {
		startTransition(() => {
			router.replace("/catalog", { scroll: false });
		});
	}

	function navigatePage(nextPage: number) {
		const href = buildHref(current, { page: nextPage }) as Route;
		startTransition(() => {
			router.replace(href, { scroll: true });
		});
	}
```

- [ ] **Step 6: Tipos, lint, commit**

Run: `bun run --filter=web check-types && bun check`

```bash
git add "apps/web/src/app/(shop)/catalog/_lib/catalog-filters.ts" "apps/web/src/app/(shop)/catalog/_lib/catalog-filters.test.ts" "apps/web/src/app/(shop)/catalog/_components/catalog-content.tsx"
git commit -m "feat(catalog): links de categoria no path"
```

---

### Task 8: Rota `/catalog/[cat]` com metadata própria

**Files:**
- Create: `apps/web/src/app/(shop)/catalog/_lib/category-shell.ts`
- Create: `apps/web/src/app/(shop)/catalog/_components/catalog-results.tsx`
- Create: `apps/web/src/app/(shop)/catalog/[cat]/page.tsx`
- Modify: `apps/web/src/app/(shop)/catalog/page.tsx`

**Interfaces:**
- Consumes: `getCategoryBySlug(db, slug): Promise<CategoryDetail | null>` e `getAllCategorySlugs(db): Promise<string[]>` de `@emach/db/queries/categories`; `parseCatalogSearchParams` (Task 6); `canonicalFor` (Task 1).
- Produces:
  - `getCategoryShell(slug: string): Promise<CategoryDetail | null>` (`use cache`, 600s).
  - `<CatalogResults cat={string | undefined} searchParams={Promise<CatalogSearchParams>} />` (async Server Component).

- [ ] **Step 1: `category-shell.ts`**

```ts
// apps/web/src/app/(shop)/catalog/_lib/category-shell.ts
import { db } from "@emach/db";
import { getCategoryBySlug } from "@emach/db/queries/categories";
import { cacheLife } from "next/cache";

// Mesmo padrão de getProductShell: generateMetadata e a página chamam a MESMA
// função e o `use cache` deduplica (1 query por janela). Wrapper vive no app
// porque packages/db/queries é owned-by-dashboard (ADR-0009).
export async function getCategoryShell(slug: string) {
	"use cache";
	cacheLife({ revalidate: 600 });
	return await getCategoryBySlug(db, slug);
}

/** Description de metadata quando a categoria não tem a própria. */
export function defaultCategoryDescription(name: string): string {
	return `${name} para obra, oficina e indústria. Linha profissional, com estoque nas filiais e envio para todo o Brasil.`;
}
```

- [ ] **Step 2: Extrair `CatalogResults`**

```tsx
// apps/web/src/app/(shop)/catalog/_components/catalog-results.tsx
import { CATALOG_PAGE_SIZE, getCatalogData } from "../_lib/catalog-data";
import {
	type CatalogSearchParams,
	parseCatalogSearchParams,
} from "../_lib/parse-search-params";
import { CatalogContent } from "./catalog-content";

interface CatalogResultsProps {
	/** Slug vindo do PATH (/catalog/[cat]). A rota raiz passa undefined. */
	cat?: string;
	searchParams: Promise<CatalogSearchParams>;
}

// Buraco dinâmico do catálogo: lê searchParams (filtros/busca/paginação) — por
// isso vive sob Suspense. Os dados vêm de getCatalogData ('use cache' por
// combinação de filtros): hit não toca o Postgres.
export async function CatalogResults({ cat, searchParams }: CatalogResultsProps) {
	const params = await searchParams;
	const parsed = parseCatalogSearchParams(params);

	const { categoryTree, currentCategory, facetCounts, tools, total, voltagesByTool } =
		await getCatalogData({
			cat,
			search: parsed.search,
			voltages: parsed.voltages,
			priceMin: parsed.priceMin,
			priceMax: parsed.priceMax,
			onlyPromo: parsed.onlyPromo,
			sort: parsed.sort,
			page: parsed.page,
		});

	return (
		<CatalogContent
			categoryTree={categoryTree}
			currentCategoryDescription={currentCategory?.description ?? null}
			currentCategoryName={currentCategory?.name ?? null}
			currentCategorySlug={currentCategory?.slug ?? null}
			facetCounts={facetCounts}
			onlyPromo={parsed.onlyPromo}
			page={parsed.page}
			pageSize={CATALOG_PAGE_SIZE}
			priceMax={parsed.priceMax ?? null}
			priceMin={parsed.priceMin ?? null}
			query={parsed.q}
			sort={parsed.sort}
			tools={tools}
			total={total}
			voltages={parsed.voltages}
			voltagesByTool={voltagesByTool}
		/>
	);
}
```

- [ ] **Step 3: `catalog/page.tsx` vira só shell**

```tsx
// apps/web/src/app/(shop)/catalog/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { canonicalFor } from "@/lib/seo/canonical";
import { CatalogResults } from "./_components/catalog-results";
import { CatalogSkeleton } from "./_components/catalog-skeleton";
import type { CatalogSearchParams } from "./_lib/parse-search-params";

interface CatalogPageProps {
	searchParams: Promise<CatalogSearchParams>;
}

// Metadata estática: sob cacheComponents, ler searchParams em generateMetadata
// bloquearia o prerender do shell. Categoria tem rota própria (/catalog/[cat])
// com metadata dinâmica; aqui ficam só busca e filtros por query.
export const metadata: Metadata = {
	title: "Catálogo",
	description:
		"Todas as ferramentas da EMACH: elétricas, manuais, medição e EPIs. Filtre por categoria, voltagem e preço.",
	alternates: canonicalFor("/catalog"),
};

export default function CatalogPage({ searchParams }: CatalogPageProps) {
	return (
		<>
			<SiteHeader />
			<Suspense fallback={<CatalogSkeleton />}>
				{/* `?cat=` legado é redirecionado no proxy (308); aqui é ignorado
				    de propósito pra nunca servir conteúdo duplicado. */}
				<CatalogResults searchParams={searchParams} />
			</Suspense>
		</>
	);
}
```

- [ ] **Step 4: Criar `catalog/[cat]/page.tsx`**

```tsx
// apps/web/src/app/(shop)/catalog/[cat]/page.tsx
import { db } from "@emach/db";
import { getAllCategorySlugs } from "@emach/db/queries/categories";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SiteHeader } from "@/components/site-header";
import { canonicalFor } from "@/lib/seo/canonical";

import { CatalogResults } from "../_components/catalog-results";
import { CatalogSkeleton } from "../_components/catalog-skeleton";
import {
	defaultCategoryDescription,
	getCategoryShell,
} from "../_lib/category-shell";
import type { CatalogSearchParams } from "../_lib/parse-search-params";

interface CategoryPageProps {
	params: Promise<{ cat: string }>;
	searchParams: Promise<CatalogSearchParams>;
}

// Prebuilda o shell de cada categoria ativa; slug novo resolve on-demand e
// cacheia por janela (getCategoryShell). Satisfaz o cacheComponents (≥1 param).
export async function generateStaticParams() {
	const slugs = await getAllCategorySlugs(db);
	return slugs.map((cat) => ({ cat }));
}

export async function generateMetadata({
	params,
}: CategoryPageProps): Promise<Metadata> {
	const { cat } = await params;
	const category = await getCategoryShell(cat);
	if (!category) {
		return { title: "Categoria não encontrada" };
	}
	const title = category.name;
	const description =
		category.description ?? defaultCategoryDescription(category.name);
	const path = `/catalog/${cat}`;
	return {
		title,
		description,
		alternates: canonicalFor(path),
		openGraph: { title, description, type: "website", url: path, siteName: "EMACH" },
		twitter: { card: "summary_large_image", title, description },
	};
}

export default async function CategoryPage({
	params,
	searchParams,
}: CategoryPageProps) {
	const { cat } = await params;
	const category = await getCategoryShell(cat);
	if (!category) {
		notFound();
	}
	return (
		<>
			<SiteHeader />
			<Suspense fallback={<CatalogSkeleton />}>
				<CatalogResults cat={cat} searchParams={searchParams} />
			</Suspense>
		</>
	);
}
```

`page.tsx` só pode exportar os símbolos que o Next reconhece: `defaultCategoryDescription` vive em `../_lib/category-shell.ts` (exportada de lá) e é importada aqui, não exportada do `page.tsx`.

- [ ] **Step 5: Tipos + lint**

Run: `bun run --filter=web check-types && bun check`
Expected: sem erros. `CatalogContent` já renderiza `<h1>{currentCategoryName ?? "Catálogo completo"}</h1>`, então o H1 por categoria vem de graça.

- [ ] **Step 6: Smoke**

Dev server de pé:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/catalog/<slug real>"        # 200
curl -s "http://localhost:3001/catalog/<slug real>" | grep -o '<title>[^<]*</title>\|<link rel="canonical"[^>]*>'
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/catalog/nao-existe-xyz"    # 404
```
Expected: título `<Nome da categoria> · EMACH`, canonical `/catalog/<slug>`, 404 para slug inexistente. Clicar numa subcategoria no drill-down do sidebar navega para `/catalog/<sub>` sem `?cat=`.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(shop)/catalog"
git commit -m "feat(catalog): rota /catalog/[cat] com metadata"
```

---

### Task 9: Migrar os call-sites de `?cat=` e o sitemap

**Files:**
- Modify: `apps/web/src/components/category-tile.tsx:37`
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/breadcrumb.tsx:33,48`
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/related-products.tsx:72`
- Modify: `apps/web/src/app/(shop)/product/[slug]/_lib/product-json-ld.ts` (BreadcrumbList) + `.test.ts`
- Modify: `apps/web/src/app/sitemap.ts:27-31`

- [ ] **Step 1: Atualizar o teste do BreadcrumbList (falha antes)**

Em `product-json-ld.test.ts`, no `describe("buildBreadcrumbJsonLd")`:

```ts
		expect(data.itemListElement[2]?.item).toBe(`${BASE}/catalog/furadeiras`);
```

Run: `bun run --filter=web test "src/app/(shop)/product/[slug]/_lib/product-json-ld.test.ts"` → FAIL nesse caso.

- [ ] **Step 2: Trocar os 5 lugares**

- `product-json-ld.ts`: `item: \`${base}/catalog/${input.category.slug}\``
- `category-tile.tsx`: `href={\`/catalog/${category.slug}\`}`
- `breadcrumb.tsx` (dois lugares): `href={\`/catalog/${category.slug}\`}` e `href={category ? \`/catalog/${category.slug}\` : "/catalog"}`
- `related-products.tsx`: `href: rootCategory ? \`/catalog/${rootCategory.slug}\` : "/catalog",`
- `sitemap.ts`:
  ```ts
  const categoryRoutes: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
  	url: `${BASE_URL}/catalog/${slug}`,
  	lastModified: now,
  	priority: 0.8,
  }));
  ```

- [ ] **Step 3: Confirmar que não sobrou nenhum**

Run: `grep -rn 'cat=' apps/web/src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | grep -v 'catalog-redirect'`
Expected: nenhuma linha (o `catalog-redirect.ts` da Task 10 pode ainda não existir; ok).

- [ ] **Step 4: Testes, tipos, lint**

Run: `bun run --filter=web test:ci && bun run --filter=web check-types && bun check`
Expected: verde. `typedRoutes` aceita `` `/catalog/${slug}` `` para a rota `[cat]`; se o tsc reclamar em `related-products.tsx` (`SectionHeader.link.href` pode ser `Route`), usar `as Route` como o footer já faz.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/category-tile.tsx "apps/web/src/app/(shop)/product/[slug]" apps/web/src/app/sitemap.ts
git commit -m "feat(seo): links e sitemap em /catalog/[slug]"
```

---

### Task 10: Redirect 308 de `/catalog?cat=X` no `proxy.ts`

**Files:**
- Create: `apps/web/src/lib/seo/catalog-redirect.ts`
- Test: `apps/web/src/lib/seo/catalog-redirect.test.ts`
- Modify: `apps/web/src/proxy.ts:10-12`

**Interfaces:**
- Produces: `legacyCategoryRedirect(url: URL): URL | null` — `null` quando não há o que redirecionar.

- [ ] **Step 1: Teste que falha**

```ts
// apps/web/src/lib/seo/catalog-redirect.test.ts
import { describe, expect, it } from "vitest";
import { legacyCategoryRedirect } from "./catalog-redirect";

const ORIGIN = "https://www.emachferramentas.com.br";

describe("legacyCategoryRedirect", () => {
	it("move cat da query para o path e preserva os demais params", () => {
		const out = legacyCategoryRedirect(
			new URL(`${ORIGIN}/catalog?cat=furadeiras&sort=price-asc&page=2`)
		);
		expect(out?.toString()).toBe(
			`${ORIGIN}/catalog/furadeiras?sort=price-asc&page=2`
		);
	});
	it("sem cat, ou cat vazio, não redireciona", () => {
		expect(legacyCategoryRedirect(new URL(`${ORIGIN}/catalog`))).toBeNull();
		expect(legacyCategoryRedirect(new URL(`${ORIGIN}/catalog?cat=`))).toBeNull();
		expect(legacyCategoryRedirect(new URL(`${ORIGIN}/catalog?cat=%20`))).toBeNull();
	});
	it("só age em /catalog exato", () => {
		expect(
			legacyCategoryRedirect(new URL(`${ORIGIN}/catalog/serras?cat=x`))
		).toBeNull();
		expect(legacyCategoryRedirect(new URL(`${ORIGIN}/?cat=x`))).toBeNull();
	});
	it("escapa slug malicioso", () => {
		const out = legacyCategoryRedirect(
			new URL(`${ORIGIN}/catalog?cat=..%2F..%2Fadmin`)
		);
		expect(out?.pathname).toBe("/catalog/..%2F..%2Fadmin");
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test src/lib/seo/catalog-redirect.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/lib/seo/catalog-redirect.ts

/**
 * `/catalog?cat=<slug>` era a URL de categoria até o PR de rotas próprias.
 * Devolve a URL nova (`/catalog/<slug>` + demais params) ou null.
 */
export function legacyCategoryRedirect(url: URL): URL | null {
	if (url.pathname !== "/catalog") {
		return null;
	}
	const cat = url.searchParams.get("cat")?.trim();
	if (!cat) {
		return null;
	}
	const next = new URL(url);
	next.pathname = `/catalog/${encodeURIComponent(cat)}`;
	next.searchParams.delete("cat");
	return next;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run --filter=web test src/lib/seo/catalog-redirect.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Ligar no `proxy.ts`**

Após `const { pathname } = req.nextUrl;`:

```ts
	// URL legada de categoria (`/catalog?cat=x`) → rota própria. 308 preserva
	// método e é tratado como permanente pelo Google.
	const legacy = legacyCategoryRedirect(req.nextUrl);
	if (legacy) {
		return NextResponse.redirect(legacy, 308);
	}
```

Import: `import { legacyCategoryRedirect } from "@/lib/seo/catalog-redirect";`

- [ ] **Step 6: Tipos, lint, smoke**

Run: `bun run --filter=web check-types && bun check`

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3001/catalog?cat=furadeiras&page=2"
```
Expected: `308 http://localhost:3001/catalog/furadeiras?page=2`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/seo/catalog-redirect.ts apps/web/src/lib/seo/catalog-redirect.test.ts apps/web/src/proxy.ts
git commit -m "feat(seo): 308 de /catalog?cat= para /catalog/[slug]"
```

---

### Task 11: Fechar o PR 2

- [ ] **Step 1: Verificação completa + integração do catálogo**

Run: `bun run --filter=web check-types && bun check && bun run --filter=web test:ci`
Run: `bun run --filter=web test "src/app/(shop)/catalog/_lib/catalog-data.test.ts"` (integração; precisa de `.env`)
Expected: verde. Se `catalog-data` falhar, re-rodar isolado antes de investigar (flaky conhecido).

- [ ] **Step 2: Smoke final**

- `/catalog/<slug>` → 200, título e canonical da categoria, H1 com o nome.
- `/catalog?cat=<slug>` → 308 para `/catalog/<slug>`.
- `/sitemap.xml` → contém `/catalog/<slug>` e nenhum `?cat=` (se o cache de 24h servir o antigo, reiniciar o dev server).
- Home: clicar num tile de categoria leva a `/catalog/<slug>`.
- PDP: breadcrumb da categoria leva a `/catalog/<slug>`.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(seo): rota própria por categoria" --body "$(cat <<'EOF'
## O que muda

- Nova rota `/catalog/[cat]` (slug único de `category`, vale pra subcategoria) com `generateStaticParams`, `generateMetadata` (title, description, canonical, OG) e H1 com o nome da categoria.
- `buildHref` devolve o path completo: categoria no path, filtros na query. Nenhum link novo gera `?cat=`.
- `/catalog?cat=X` → 308 `/catalog/X` no `proxy.ts`, preservando os demais params.
- Tiles da home, breadcrumb e "ver categoria" da PDP, `BreadcrumbList` e `sitemap.ts` apontam para a rota nova.
- `/catalog` ignora `cat` de propósito (o redirect cobre; sem conteúdo duplicado).

Spec: `docs/superpowers/specs/2026-09-01-seo-storefront-design.md` (Track 2).

## Testes

- `parse-search-params.test.ts`, `catalog-filters.test.ts` (atualizado), `catalog-redirect.test.ts`, `product-json-ld.test.ts` (breadcrumb).
- Smoke: 200/404 na rota nova, 308 na legada, sitemap sem `?cat=`.
EOF
)"
```

Reler o corpo com `/unslop`. Link no relatório.

---

# Fase 3 — páginas institucionais e copy (PR 3)

> Branch a partir da `main` com o PR 2 mergeado (ou empilhada sobre ele).

### Task 12: Layout compartilhado `InstitutionalPage`

**Files:**
- Create: `apps/web/src/components/institutional-page.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface InstitutionalSection { bullets?: string[]; id: string; paragraphs: string[]; title: string }
  export function InstitutionalPage(props: { children?: React.ReactNode; label: string; lede: string; sections: InstitutionalSection[]; title: string; updatedAt: string })
  ```
  `children` renderiza após as seções estáticas (a `/entrega` usa pra lista de filiais).

- [ ] **Step 1: Implementar**

```tsx
// apps/web/src/components/institutional-page.tsx
import { PageContainer } from "@/components/page-container";

export interface InstitutionalSection {
	bullets?: string[];
	id: string;
	paragraphs: string[];
	title: string;
}

interface InstitutionalPageProps {
	children?: React.ReactNode;
	/** Rótulo curto acima do título (Barlow Condensed, uppercase). */
	label: string;
	lede: string;
	sections: InstitutionalSection[];
	title: string;
	/** ISO `YYYY-MM-DD`; exibido como "Atualizado em dd/mm/aaaa". */
	updatedAt: string;
}

function formatDateBR(iso: string): string {
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}

/**
 * Página de texto institucional: hero escuro compacto (mesmo do catálogo) +
 * corpo claro em duas colunas (sumário fixo à esquerda, seções à direita).
 * Superfície clara = bg-gray-10; separação por hairline `border-border`.
 */
export function InstitutionalPage({
	children,
	label,
	lede,
	sections,
	title,
	updatedAt,
}: InstitutionalPageProps) {
	return (
		<main className="bg-gray-10" id="main-content">
			<section className="bg-near-black py-12 text-white">
				<PageContainer>
					<div className="mb-3 font-display font-semibold text-[12px] text-white/55 uppercase tracking-widest">
						{label}
					</div>
					<h1 className="max-w-180 text-balance font-display font-medium text-[clamp(36px,5vw,60px)] leading-[1.02] tracking-[-0.01em]">
						{title}
					</h1>
					<p className="mt-4 max-w-150 text-[16px] text-white/70 leading-relaxed">
						{lede}
					</p>
					<p className="mt-6 font-display text-[12px] text-white/45 uppercase tracking-[0.14em]">
						Atualizado em {formatDateBR(updatedAt)}
					</p>
				</PageContainer>
			</section>

			<PageContainer className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-16">
				<nav aria-label="Sumário" className="hidden lg:block">
					<div className="pb-4 font-bold font-display text-[12px] uppercase tracking-[0.14em]">
						Nesta página
					</div>
					<ol className="sticky top-24 flex flex-col gap-2 border-border border-l pl-4">
						{sections.map((s) => (
							<li key={s.id}>
								<a
									className="text-[14px] text-gray-60 transition-colors hover:text-near-black"
									href={`#${s.id}`}
								>
									{s.title}
								</a>
							</li>
						))}
					</ol>
				</nav>

				<div className="max-w-[72ch]">
					{sections.map((s) => (
						<section
							className="scroll-mt-24 border-border border-b py-8 first:pt-0"
							id={s.id}
							key={s.id}
						>
							<h2 className="font-display font-medium text-[26px] text-near-black leading-tight tracking-[-0.01em]">
								{s.title}
							</h2>
							{s.paragraphs.map((p) => (
								<p
									className="mt-4 text-[16px] text-gray-60 leading-[1.65]"
									key={p}
								>
									{p}
								</p>
							))}
							{s.bullets && s.bullets.length > 0 && (
								<ul className="mt-4 list-disc space-y-2 pl-5 text-[16px] text-gray-60 leading-[1.6]">
									{s.bullets.map((b) => (
										<li key={b}>{b}</li>
									))}
								</ul>
							)}
						</section>
					))}
					{children}
				</div>
			</PageContainer>
		</main>
	);
}
```

`key={p}`/`key={b}` usam o próprio texto (único dentro da seção; o teste da Task 14 garante). Se `text-gray-60` não existir nos tokens (`packages/ui/src/styles/globals.css`), usar `text-near-black/80`.

- [ ] **Step 2: Tipos + lint, commit**

Run: `bun run --filter=web check-types && bun check`

```bash
git add apps/web/src/components/institutional-page.tsx
git commit -m "feat(ui): layout de página institucional"
```

---

### Task 13: `/privacidade`

**Files:**
- Create: `apps/web/src/app/(shop)/privacidade/_content.ts`
- Create: `apps/web/src/app/(shop)/privacidade/page.tsx`

**Interfaces:**
- Consumes: `InstitutionalPage`, `InstitutionalSection` (Task 12); `canonicalFor` (Task 1).
- Produces: `PRIVACY_UPDATED_AT: string`, `privacySections: InstitutionalSection[]`, `PRIVACY_LEDE: string`.

Fatos verificados no código que o texto afirma (não inventar além disto):
- `client`: nome, e-mail, telefone, CPF/CNPJ (`document`, só dígitos), foto do Google (`image`); `clientAddress`: endereços de entrega.
- `clientSession`: cookie `ecommerce.session_token`, com IP e user-agent.
- Login com Google (`socialProviders.google` em `packages/auth/src/ecommerce.ts`).
- `consentLog`: registra `tos`, `privacy` e `marketing_email` no fechamento do pedido, com versão, IP e user-agent (`checkout/_lib/place-order.ts`).
- Carrinho e id de visitante pseudônimo em `localStorage` (`lib/cart-store.ts`, `lib/visitor-id.ts`); eventos de carrinho (`cart_event`) usam esse id.
- Frenet recebe CEP de destino e dimensões/peso dos volumes (`lib/frenet/types.ts`); não recebe nome nem documento.
- Resend envia os e-mails transacionais (`packages/email/src/send.ts`), remetente `nao-responder@emachferramentas.com.br`.
- Vercel Analytics e Speed Insights (root layout): sem cookie, sem identificação individual.
- `clientAuditLog`/`clientExportLog` existem no schema; **não há** autoatendimento de exportação/exclusão no site — direitos são exercidos por solicitação.
- Canal: filiais (telefones em `/sobre`). Não há e-mail de privacidade cadastrado no código.

- [ ] **Step 1: Conteúdo**

```ts
// apps/web/src/app/(shop)/privacidade/_content.ts
import type { InstitutionalSection } from "@/components/institutional-page";

export const PRIVACY_UPDATED_AT = "2026-09-01";

export const PRIVACY_LEDE =
	"O que a EMACH guarda sobre você, por quê, e como pedir para ver, corrigir ou apagar.";

export const privacySections: InstitutionalSection[] = [
	{
		id: "quem-somos",
		title: "Quem trata os seus dados",
		paragraphs: [
			"A EMACH Ferramentas (CNPJ 04.128.615/0001-59) é a controladora dos dados pessoais coletados neste site. Esta página vale para a loja virtual; nas filiais físicas o atendimento é presencial e segue as mesmas regras.",
			"Tratamos dados conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Se algo aqui não estiver claro, pergunte em qualquer filial: os telefones estão na página Sobre.",
		],
	},
	{
		id: "o-que-coletamos",
		title: "O que coletamos",
		paragraphs: [
			"Só o necessário para vender, entregar e atender. Nada de formulário com dez campos que ninguém usa.",
		],
		bullets: [
			"Cadastro: nome, e-mail, telefone e CPF ou CNPJ. O documento é guardado só com os dígitos e serve para emitir a nota fiscal.",
			"Endereços de entrega que você cadastra na sua conta.",
			"Login com Google: recebemos nome, e-mail e foto do perfil. Não recebemos sua senha do Google.",
			"Sessão: um cookie de login (ecommerce.session_token), com endereço IP e navegador registrados para segurança.",
			"Pedidos: itens, valores, forma de entrega e o histórico de status.",
			"Consentimentos: ao fechar um pedido, registramos que você aceitou os termos e esta política, e se optou por receber e-mails de ofertas, com data, versão do texto, IP e navegador.",
			"Carrinho: fica no seu navegador (localStorage), junto com um identificador aleatório de visitante que não tem seu nome. Usamos isso para entender abandono de carrinho de forma agregada.",
		],
	},
	{
		id: "para-que-usamos",
		title: "Para que usamos",
		paragraphs: [
			"Cada dado tem um motivo. Se o motivo acabar, o dado também deve acabar.",
		],
		bullets: [
			"Cumprir o contrato de compra: separar, faturar e entregar o pedido, e responder quando você perguntar sobre ele.",
			"Obrigação legal: nota fiscal e guarda de documentos fiscais pelo prazo que a lei exige.",
			"Segurança: detectar acesso indevido à sua conta e fraude em pedidos.",
			"Ofertas por e-mail: só se você marcou a opção no checkout. Dá para sair a qualquer momento pelo link no rodapé do e-mail.",
		],
	},
	{
		id: "com-quem-compartilhamos",
		title: "Com quem compartilhamos",
		paragraphs: [
			"Não vendemos dados. Compartilhamos o mínimo com quem precisa para o serviço funcionar:",
		],
		bullets: [
			"Frenet (cotação de frete): recebe o CEP de destino e o peso e as medidas dos volumes. Não recebe seu nome nem documento.",
			"Transportadoras: recebem nome, endereço e telefone para entregar o pedido.",
			"Resend (envio de e-mail): recebe seu e-mail para mandar confirmação de cadastro, redefinição de senha e avisos do pedido, sempre a partir de nao-responder@emachferramentas.com.br.",
			"Google: só se você escolher entrar com a conta Google.",
			"Vercel (hospedagem e medição de desempenho): estatísticas de acesso agregadas, sem cookie e sem identificar você.",
			"Autoridades, quando a lei obrigar.",
		],
	},
	{
		id: "cookies",
		title: "Cookies e armazenamento no navegador",
		paragraphs: [
			"Usamos um cookie de sessão para manter você logado. Não usamos cookies de publicidade nem de rastreamento entre sites.",
			"O carrinho e o identificador de visitante ficam no armazenamento local do seu navegador. Limpar os dados do site apaga os dois.",
		],
	},
	{
		id: "por-quanto-tempo",
		title: "Por quanto tempo guardamos",
		bullets: [
			"Conta e endereços: enquanto a conta existir.",
			"Pedidos e notas fiscais: pelo prazo legal de guarda de documentos fiscais, mesmo depois de encerrar a conta.",
			"Registros de consentimento e de segurança (IP, navegador): pelo tempo necessário para comprovar o consentimento e investigar incidentes.",
			"E-mails de ofertas: até você cancelar.",
		],
		paragraphs: [],
	},
	{
		id: "seus-direitos",
		title: "Seus direitos",
		paragraphs: [
			"A LGPD garante, e a gente atende, os pedidos abaixo. Faça o pedido em qualquer filial, com um documento que comprove que a conta é sua. Respondemos em até 15 dias.",
		],
		bullets: [
			"Confirmar se tratamos seus dados e acessar o que temos.",
			"Corrigir dado incompleto ou desatualizado. Nome, telefone e endereços você mesmo edita na sua conta.",
			"Pedir a exclusão da conta. Dados de pedidos e notas ficam guardados só pelo prazo fiscal.",
			"Receber seus dados em formato legível por máquina (portabilidade).",
			"Retirar o consentimento para e-mails de ofertas.",
			"Saber com quem compartilhamos seus dados.",
		],
	},
	{
		id: "seguranca",
		title: "Como protegemos",
		paragraphs: [
			"Senhas são guardadas com hash, nunca em texto. O site roda só em HTTPS. O acesso ao banco de dados é restrito à equipe que precisa dele para atender você, e cada alteração em dados de cliente fica registrada em um log de auditoria.",
		],
	},
	{
		id: "mudancas",
		title: "Mudanças nesta política",
		paragraphs: [
			"Quando mudar algo relevante, atualizamos a data no topo desta página e, se a mudança afetar como usamos seus dados, avisamos por e-mail antes de valer.",
		],
	},
];
```

Corrigir o tipo: `paragraphs` é obrigatório na interface; a seção "por-quanto-tempo" já passa `paragraphs: []`.

- [ ] **Step 2: Página**

```tsx
// apps/web/src/app/(shop)/privacidade/page.tsx
import type { Metadata } from "next";

import { InstitutionalPage } from "@/components/institutional-page";
import { SiteHeader } from "@/components/site-header";
import { canonicalFor } from "@/lib/seo/canonical";

import {
	PRIVACY_LEDE,
	PRIVACY_UPDATED_AT,
	privacySections,
} from "./_content";

export const metadata: Metadata = {
	title: "Privacidade e proteção de dados",
	description:
		"Quais dados a EMACH coleta na loja virtual, por quê, com quem compartilha e como você pede para ver, corrigir ou apagar.",
	alternates: canonicalFor("/privacidade"),
};

export default function PrivacyPage() {
	return (
		<>
			<SiteHeader />
			<InstitutionalPage
				label="Privacidade"
				lede={PRIVACY_LEDE}
				sections={privacySections}
				title="Privacidade e proteção de dados"
				updatedAt={PRIVACY_UPDATED_AT}
			/>
		</>
	);
}
```

- [ ] **Step 3: Tipos, lint, smoke**

Run: `bun run --filter=web check-types && bun check`

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/privacidade
```
Expected: 200. Abrir no browser e tirar screenshot desktop e mobile (caminho no relatório).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(shop)/privacidade"
git commit -m "feat(seo): página de privacidade (LGPD)"
```

---

### Task 14: `/entrega` + teste de conteúdo ("sem troca/garantia")

**Files:**
- Create: `apps/web/src/app/(shop)/entrega/_content.ts`
- Create: `apps/web/src/app/(shop)/entrega/page.tsx`
- Test: `apps/web/src/lib/seo/institutional-content.test.ts`

**Interfaces:**
- Consumes: `InstitutionalPage` (Task 12); `getActiveBranches`, `formatBranchAddress`, `formatPhone`, `getBusinessHoursRows` de `@/lib/branches`; `canonicalFor`.
- Produces: `DELIVERY_UPDATED_AT`, `DELIVERY_LEDE`, `deliverySections`.

Fatos verificados: frete cotado na Frenet por CEP (carrinho e checkout); itens são consolidados em caixas reais antes da cotação (`packItems` + `shippingBox`); item sem caixa cadastrada → "Frete a combinar" (`negotiate`); se a Frenet estiver fora, o pedido é criado e a equipe revisa o frete (`shippingUnverified`); acompanhamento em `/dashboard/pedidos`; retirada nas filiais (dados de `getActiveBranches`).

- [ ] **Step 1: Teste de conteúdo (falha antes: módulos não existem)**

```ts
// apps/web/src/lib/seo/institutional-content.test.ts
import { describe, expect, it } from "vitest";
import type { InstitutionalSection } from "@/components/institutional-page";
import { DELIVERY_LEDE, deliverySections } from "@/app/(shop)/entrega/_content";
import { PRIVACY_LEDE, privacySections } from "@/app/(shop)/privacidade/_content";

// Decisão do dono do produto (spec, Track 3): nenhum texto institucional
// fala de troca, devolução ou garantia, nem promete prazo fixo de entrega.
const FORBIDDEN = /\b(troca|trocas|devolu\w*|garantia\w*)\b/i;
const FIXED_DEADLINE = /\b(em|até)\s+\d+\s+dias?\s+(úteis\s+)?(para|pra)\s+entreg/i;

function allText(sections: InstitutionalSection[], lede: string): string[] {
	const out = [lede];
	for (const s of sections) {
		out.push(s.title, ...s.paragraphs, ...(s.bullets ?? []));
	}
	return out;
}

describe.each([
	["privacidade", privacySections, PRIVACY_LEDE],
	["entrega", deliverySections, DELIVERY_LEDE],
] as const)("%s", (_name, sections, lede) => {
	it("não menciona troca, devolução ou garantia", () => {
		for (const text of allText(sections, lede)) {
			expect(text).not.toMatch(FORBIDDEN);
		}
	});
	it("não promete prazo fixo de entrega", () => {
		for (const text of allText(sections, lede)) {
			expect(text).not.toMatch(FIXED_DEADLINE);
		}
	});
	it("ids de seção são únicos e parágrafos/bullets não são vazios nem repetidos", () => {
		const ids = sections.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const s of sections) {
			const items = [...s.paragraphs, ...(s.bullets ?? [])];
			expect(items.every((t) => t.trim().length > 0)).toBe(true);
			expect(new Set(items).size).toBe(items.length);
		}
	});
});
```

Run: `bun run --filter=web test src/lib/seo/institutional-content.test.ts` → FAIL (`entrega/_content` não existe).

- [ ] **Step 2: Conteúdo de entrega**

```ts
// apps/web/src/app/(shop)/entrega/_content.ts
import type { InstitutionalSection } from "@/components/institutional-page";

export const DELIVERY_UPDATED_AT = "2026-09-01";

export const DELIVERY_LEDE =
	"Como o frete é calculado, o que acontece com item grande demais para a caixa, e onde retirar sem pagar envio.";

export const deliverySections: InstitutionalSection[] = [
	{
		id: "como-calculamos",
		title: "Como o frete é calculado",
		paragraphs: [
			"O valor e o prazo vêm de uma cotação em tempo real com as transportadoras, feita pela Frenet a partir do seu CEP. Você vê as opções no carrinho e de novo no checkout, com preço e prazo de cada transportadora, e escolhe a que preferir.",
			"Antes de cotar, agrupamos os itens do pedido em caixas reais, com o peso e as medidas de cada ferramenta. É por isso que duas furadeiras às vezes custam quase o mesmo frete que uma: cabem na mesma caixa.",
			"O prazo mostrado é o da transportadora e começa a contar depois que o pedido sai da filial. A gente não inventa prazo próprio: o que aparece na cotação é o que vale.",
		],
	},
	{
		id: "frete-a-combinar",
		title: "Frete a combinar",
		paragraphs: [
			"Alguns itens (bancadas, compressores, máquinas de grande porte) não cabem em nenhuma caixa padrão. Nesses casos o carrinho mostra \"Frete a combinar\" em vez de um valor, o pedido é criado sem frete, e a equipe entra em contato pelo telefone ou e-mail do cadastro para fechar o envio com você.",
			"O mesmo acontece se a cotação ficar fora do ar no momento da compra: o pedido não trava. Ele é criado normalmente e a equipe confere o frete antes de faturar.",
		],
	},
	{
		id: "retirada",
		title: "Retirada na filial",
		paragraphs: [
			"Quem está perto de uma filial pode retirar sem pagar envio. Na retirada você vê a ferramenta, testa e tira dúvida com quem entende. Os endereços e horários estão logo abaixo.",
		],
	},
	{
		id: "acompanhamento",
		title: "Acompanhar o pedido",
		paragraphs: [
			"Cada mudança de status aparece na sua conta, em Meus pedidos, e chega por e-mail. Quando o pedido sai da filial, o código de rastreio da transportadora fica no detalhe do pedido.",
		],
	},
	{
		id: "duvidas",
		title: "Ficou alguma dúvida",
		paragraphs: [
			"Fale com qualquer filial. Os telefones e horários estão na página Sobre e na lista abaixo.",
		],
	},
];
```

- [ ] **Step 3: Página com a lista de filiais**

```tsx
// apps/web/src/app/(shop)/entrega/page.tsx
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Suspense } from "react";

import { InstitutionalPage } from "@/components/institutional-page";
import { SiteHeader } from "@/components/site-header";
import {
	type BusinessHoursRow,
	formatBranchAddress,
	formatPhone,
	getActiveBranches,
	getBusinessHoursRows,
} from "@/lib/branches";
import { canonicalFor } from "@/lib/seo/canonical";

import {
	DELIVERY_LEDE,
	DELIVERY_UPDATED_AT,
	deliverySections,
} from "./_content";

export const metadata: Metadata = {
	title: "Entrega e retirada",
	description:
		"Frete cotado em tempo real por CEP, item grande com frete a combinar, e retirada sem custo nas filiais da EMACH.",
	alternates: canonicalFor("/entrega"),
};

interface PickupBranch {
	address: string;
	hoursRows: BusinessHoursRow[] | null;
	id: string;
	name: string;
	phone: string | null;
}

async function getPickupBranches(): Promise<PickupBranch[]> {
	"use cache";
	cacheLife({ revalidate: 600 });
	const rows = await getActiveBranches();
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		address: formatBranchAddress(row),
		phone: formatPhone(row.phone),
		hoursRows: getBusinessHoursRows(row.businessHours),
	}));
}

async function PickupBranchList() {
	const branches = await getPickupBranches();
	if (branches.length === 0) {
		return null;
	}
	return (
		<section className="scroll-mt-24 py-8" id="filiais">
			<h2 className="font-display font-medium text-[26px] text-near-black leading-tight tracking-[-0.01em]">
				Onde retirar
			</h2>
			<ul className="mt-6 grid gap-4 sm:grid-cols-2">
				{branches.map((b) => (
					<li className="border border-border p-5" key={b.id}>
						<div className="font-bold font-display text-[11px] text-gray-60 uppercase tracking-[0.16em]">
							Filial
						</div>
						<strong className="mt-1 block text-[18px] text-near-black">
							{b.name}
						</strong>
						<p className="mt-2 text-[14px] text-gray-60 leading-relaxed">
							{b.address}
						</p>
						{b.phone && (
							<p className="mt-1 text-[14px] text-gray-60">{b.phone}</p>
						)}
						{b.hoursRows && (
							<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
								{b.hoursRows.map((row) => (
									<div className="contents" key={row.label}>
										<dt className="text-gray-60">{row.label}</dt>
										<dd className="text-near-black">{row.value}</dd>
									</div>
								))}
							</dl>
						)}
					</li>
				))}
			</ul>
		</section>
	);
}

export default function DeliveryPage() {
	return (
		<>
			<SiteHeader />
			<InstitutionalPage
				label="Entrega"
				lede={DELIVERY_LEDE}
				sections={deliverySections}
				title="Entrega e retirada"
				updatedAt={DELIVERY_UPDATED_AT}
			>
				<Suspense fallback={null}>
					<PickupBranchList />
				</Suspense>
			</InstitutionalPage>
		</>
	);
}
```

- [ ] **Step 4: Rodar o teste de conteúdo e ver passar**

Run: `bun run --filter=web test src/lib/seo/institutional-content.test.ts`
Expected: PASS (6 testes). Se o alias `@/app/(shop)/...` não resolver no vitest, importar por caminho relativo (`../../app/(shop)/entrega/_content`).

- [ ] **Step 5: Tipos, lint, smoke**

Run: `bun run --filter=web check-types && bun check`

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/entrega
```
Expected: 200 com a lista de filiais (se houver ativa no banco). Screenshot desktop + mobile.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(shop)/entrega" apps/web/src/lib/seo/institutional-content.test.ts
git commit -m "feat(seo): página de entrega e retirada"
```

---

### Task 15: Footer, sitemap e H1 da home

**Files:**
- Modify: `apps/web/src/components/site-footer.tsx:18-24`
- Modify: `apps/web/src/app/sitemap.ts:17-21`
- Modify: `apps/web/src/components/hero-carousel.tsx:129`

- [ ] **Step 1: Footer**

Em `navLinks`, remover a entrada duplicada `{ href: "/catalog", label: "Categorias" }` (aponta pro mesmo lugar que "Catálogo") e adicionar as duas páginas ao fim:

```ts
const navLinks: { href: Route; label: string }[] = [
	{ href: "/catalog", label: "Catálogo" },
	{ href: "/catalog?promo=1" as Route, label: "Ofertas" },
	{ href: "/catalog?sort=newest" as Route, label: "Novidades" },
	{ href: "/sobre", label: "Sobre" },
	{ href: "/entrega", label: "Entrega" },
	{ href: "/privacidade", label: "Privacidade" },
];
```

- [ ] **Step 2: Sitemap**

```ts
	const staticRoutes: MetadataRoute.Sitemap = [
		{ url: `${BASE_URL}/`, lastModified: now, priority: 1 },
		{ url: `${BASE_URL}/catalog`, lastModified: now, priority: 0.9 },
		{ url: `${BASE_URL}/sobre`, lastModified: now, priority: 0.5 },
		{ url: `${BASE_URL}/entrega`, lastModified: now, priority: 0.4 },
		{ url: `${BASE_URL}/privacidade`, lastModified: now, priority: 0.3 },
	];
```

- [ ] **Step 3: H1 `sr-only` da home**

`hero-carousel.tsx:129`:

```tsx
					<h1 className="sr-only">
						Ferramentas profissionais, EPIs e equipamentos de medição para obra e oficina
					</h1>
```

Nota para o relatório: esse H1 só renderiza quando **nenhum** banner ativo tem título visível (`h1Index === -1`); com banner titulado, o H1 é o título do banner (controlado no dashboard). Mudança barata, efeito condicional.

- [ ] **Step 4: Tipos, lint, commit**

Run: `bun run --filter=web check-types && bun check`

```bash
git add apps/web/src/components/site-footer.tsx apps/web/src/app/sitemap.ts apps/web/src/components/hero-carousel.tsx
git commit -m "feat(seo): footer, sitemap e H1 da home"
```

---

### Task 16: Copy humanizada (executada pelo controlador, com as skills)

> Esta task **não** vai para subagente: o controlador roda `/humanize-pt-br` e `/unslop` sobre os textos abaixo e aplica as edições. Depois, `verificador-factual` confere `_content.ts` das duas páginas contra o código (lista de fatos das Tasks 13 e 14).

**Files:**
- Modify: `apps/web/src/app/(shop)/privacidade/_content.ts`, `apps/web/src/app/(shop)/entrega/_content.ts`
- Modify: `metadata.description` em `app/layout.tsx:29-31`, `(shop)/catalog/page.tsx`, `(shop)/sobre/page.tsx`, `(shop)/cart/page.tsx:8`, `login/layout.tsx:6`, `(shop)/privacidade/page.tsx`, `(shop)/entrega/page.tsx`, `catalog/[cat]/page.tsx` (`defaultCategoryDescription`), `app/manifest.ts:7`

- [ ] **Step 1: Coletar as strings**

```bash
grep -rn "description:" apps/web/src/app --include='*.tsx' --include='*.ts' | grep -v '\.test\.' | grep -v "tool.description\|detail\.\|category.description\|: string"
```

- [ ] **Step 2: Passar `/humanize-pt-br` e `/unslop`**

Entrada: os dois `_content.ts` inteiros + a lista de descriptions. Critérios: voz do `/sobre` atual ("Escolhidas pra trabalho pesado", "Loja de verdade: você retira, testa e tira dúvida pessoalmente"); frases curtas; nada de "soluções", "excelência", "comprometidos"; descriptions entre 120 e 160 caracteres, com a keyword principal no início.

- [ ] **Step 3: Aplicar e re-rodar o teste de conteúdo**

Run: `bun run --filter=web test src/lib/seo/institutional-content.test.ts`
Expected: PASS (a regra "sem troca/garantia" continua valendo depois da reescrita).

- [ ] **Step 4: `verificador-factual`**

Dispatch (somente leitura) com os dois `_content.ts` e a lista de fatos das Tasks 13 e 14. Qualquer afirmação sem lastro no código é corrigida ou removida.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app apps/web/src/components
git commit -m "feat(seo): copy humanizada e descriptions"
```

---

### Task 17: Fechar o PR 3

- [ ] **Step 1: Verificação completa**

Run: `bun run --filter=web check-types && bun check && bun run --filter=web test:ci`
Expected: verde; saída no relatório.

- [ ] **Step 2: Smoke visual**

`/privacidade` e `/entrega` em desktop (1440) e mobile (390): hero escuro, sumário só no desktop, hairlines `border-border`, lista de filiais na `/entrega`. Footer com os dois links. Screenshots com caminho no relatório.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(seo): páginas institucionais e copy" --body "$(cat <<'EOF'
## O que muda

- `/privacidade`: política LGPD escrita a partir do que o sistema faz de verdade (dados do cadastro, cookie de sessão, `consentLog` no checkout, o que Frenet/Resend/Google/Vercel recebem, direitos por solicitação nas filiais).
- `/entrega`: como o frete é cotado (Frenet por CEP, caixas reais), "frete a combinar", fail-open quando a cotação cai, retirada nas filiais com endereço e horário reais.
- Layout compartilhado `InstitutionalPage` (hero escuro + corpo claro com sumário).
- Footer e sitemap com as duas páginas; H1 `sr-only` da home com as keywords do catálogo.
- Descriptions de metadata e copy das páginas revisadas (voz humana, sem jargão).
- Sem menção a troca, devolução ou garantia, e sem prazo fixo de entrega — travado por `institutional-content.test.ts`.

Spec: `docs/superpowers/specs/2026-09-01-seo-storefront-design.md` (Track 3).

## Testes

- `lib/seo/institutional-content.test.ts` (unit).
- Smoke visual desktop/mobile das duas páginas.
EOF
)"
```

Reler o corpo com `/unslop`. Link no relatório.

---

## Self-review (feito ao escrever)

- **Cobertura do spec:** canonical (T1), Organization/WebSite/HardwareStore (T2–T3), Product enriquecido sem `hasMerchantReturnPolicy`/`gtin`/`shippingDetails` (T4), rota `/catalog/[slug]` + metadata + H1 + `generateStaticParams` + `notFound` (T8), migração dos 5 call-sites (T9), redirect 308 (T10), sitemap (T9, T15), `/privacidade` e `/entrega` (T13, T14), footer (T15), copy humanizada + verificador-factual (T16), H1 da home (T15). Facet/drill-down migra junto via `buildHref` (T7).
- **Placeholders:** nenhum "TBD"/"similar à task N"; todo passo de código tem o código.
- **Consistência de nomes:** `canonicalFor`, `buildSiteGraph`, `openingHoursFor`, `JsonLdScript`, `buildProductJsonLd`, `buildBreadcrumbJsonLd`, `priceValidUntil`, `parseCatalogSearchParams`, `CatalogSearchParams`, `getCategoryShell`, `CatalogResults`, `legacyCategoryRedirect`, `InstitutionalPage`/`InstitutionalSection`, `privacySections`/`deliverySections` usados com o mesmo nome em todas as tasks.
