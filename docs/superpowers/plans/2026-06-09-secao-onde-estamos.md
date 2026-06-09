# Seção "Onde estamos" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a seção mock "Feito para durar" (6 stats inventados) na home por "Onde estamos": mapa do Brasil georreferenciado com um pin por filial na coordenada real, lista navegável com scroll, hover-sync mapa↔lista↔estado e click → Google Maps.

**Architecture:** Server Component faz o trabalho pesado (query de filiais, lookup de coordenada já projetada, paths dos estados como constante). Um Client Component fino (~2KB, sem libs) adiciona hover/focus-sync + scroll-into-view; o click é link nativo. d3-geo e os dados geográficos vivem só num script offline que gera assets estáticos — nada disso vai pro bundle do client.

**Tech Stack:** Next 16 (App Router, RSC), React 19 (ref como prop, React Compiler — sem `useMemo`/`useCallback`), Tailwind v4, drizzle-orm, vitest. Script offline: d3-geo + mapshaper (devDependency / npx, não-runtime).

---

## Pré-requisitos e contexto de codebase

- Home: `apps/web/src/app/(shop)/page.tsx`. A seção a remover está em `:173-217`; a constante `STATS` em `:22-29`; `cn` é importado em `:7` e usado **apenas** no map de STATS.
- Filiais: tabela `branch` (`@emach/db/schema/inventory`). `status='active'`. Campos relevantes: `name, city, state, cep, street, streetNumber, neighborhood, phone, businessHours`.
- Já existe `getBranches()` + formatters (`formatCep`, `formatPhone`, `formatBusinessHours`, `formatBranchAddress`) em `apps/web/src/app/(shop)/sobre/page.tsx:67-204`. Vamos **extrair** isso pra um módulo compartilhado (DRY) e a `/sobre` passa a importar.
- `BranchBusinessHours` é o tipo em `@emach/db/schema/inventory`.
- Componentes a reusar: `SectionLabel` (`tone="accent"|"light"`), `EmachButton` (`variant="outline-light"`, `size="lg"`), `PageContainer`. Fonte display = classe `font-display` (Barlow Condensed). Token `--emach-red` (#DA291C), `bg-gray-10`.
- Logging: `import { log } from "@/lib/evlog"` — nunca `console`.
- Padrão de teste: vitest, arquivo `*.test.ts` ao lado do módulo. Rodar: `cd apps/web && bun test <arquivo>` (ou `bunx vitest run <arquivo>`).
- Após mudar SSR/queries: smoke com `bun dev:web` e visitar `/` (CLAUDE.md — `check-types` não pega SQL/SSR).

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `scripts/gen-brazil-map.mjs` | **Offline/dev-only.** Gera os 2 assets abaixo a partir de GeoJSON IBGE + base de municípios, via d3-geo + mapshaper. Não roda em runtime. |
| `apps/web/src/lib/branch-map/municipios.json` | Gerado. `{ "<cidade-normalizada>|<UF>": [x, y] }` já projetado no viewBox + chaves `"_uf|<UF>"` (centroide do estado, fallback). Server-only. |
| `apps/web/src/lib/branch-map/brazil-states.ts` | Gerado. `BRAZIL_STATES: {uf, path}[]` (27 paths SVG simplificados) e `BRAZIL_VIEWBOX`. |
| `apps/web/src/lib/branch-map/geocode.ts` | `cityToXY(city, uf)` — lookup puro em `municipios.json`, fallback centroide UF. |
| `apps/web/src/lib/branch-map/types.ts` | `BranchPin`, `StateShape`. |
| `apps/web/src/lib/branches.ts` | `getActiveBranches()` (query raw) + formatters extraídos da `/sobre` + `branchMapsUrl()`. Fonte única. |
| `apps/web/src/components/branch-map.tsx` | **Client.** SVG (estados + pins) + lista scrollável + hover/scroll-sync. |
| `apps/web/src/components/branch-map-section.tsx` | **Server.** Orquestra dados → renderiza copy + `<BranchMap/>`. |
| `apps/web/src/app/(shop)/page.tsx` | Integra a seção; remove `STATS` e markup antigo. |
| `apps/web/src/app/(shop)/sobre/page.tsx` | Refatorar pra importar de `lib/branches.ts` (DRY). |
| `packages/ui/src/styles/globals.css` | Remover `.emach-bg-stats` se ficar órfã. |

---

## Task 1: Script offline + assets do mapa

**Files:**
- Create: `scripts/gen-brazil-map.mjs`
- Create (gerado): `apps/web/src/lib/branch-map/municipios.json`
- Create (gerado): `apps/web/src/lib/branch-map/brazil-states.ts`

Este task NÃO é TDD (gera assets determinísticos). Verificação = assets válidos + sanity check.

- [ ] **Step 1: Instalar d3-geo como devDependency e baixar dados-fonte**

```bash
cd /home/othavio/Projects/emach/emach-ecommerce-3/emach-ecommerce
bun add -d d3-geo --cwd apps/web
mkdir -p scripts/.mapdata
curl -sL "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson" -o scripts/.mapdata/br.geojson
curl -sL "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv" -o scripts/.mapdata/municipios.csv
echo "scripts/.mapdata/" >> .gitignore
```

Expected: `br.geojson` (~3.3MB) e `municipios.csv` (5571 linhas) baixados.

- [ ] **Step 2: Escrever `scripts/gen-brazil-map.mjs`**

```js
import fs from "node:fs";
import { execSync } from "node:child_process";
import { geoMercator, geoPath, geoCentroid } from "d3-geo";

const ROOT = new URL("..", import.meta.url).pathname;
const DATA = `${ROOT}scripts/.mapdata`;
const OUT = `${ROOT}apps/web/src/lib/branch-map`;
const W = 560, H = 580;

// UF sigla -> codigo_uf (IBGE) para casar municipios.csv
const UF_CODE = { RO:11,AC:12,AM:13,RR:14,PA:15,AP:16,TO:17,MA:21,PI:22,CE:23,RN:24,PB:25,PE:26,AL:27,SE:28,BA:29,MG:31,ES:32,RJ:33,SP:35,PR:41,SC:42,RS:43,MS:50,MT:51,GO:52,DF:53 };
const CODE_UF = Object.fromEntries(Object.entries(UF_CODE).map(([k, v]) => [String(v), k]));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// 1) simplifica o geojson via mapshaper (reduz vértices -> paths leves)
const SIMPL = `${DATA}/br-simpl.geojson`;
execSync(`npx -y mapshaper "${DATA}/br.geojson" -simplify 8% keep-shapes -o "${SIMPL}" force`, { stdio: "inherit" });
const geo = JSON.parse(fs.readFileSync(SIMPL, "utf8"));

// 2) projeção única (estados + pontos usam a MESMA)
const proj = geoMercator().fitSize([W, H], geo);
const pathGen = geoPath(proj);
const r1 = (d) => (d || "").replace(/-?\d+\.?\d*/g, (n) => (+n).toFixed(1));

// 3) paths dos estados
const states = geo.features.map((f) => {
  const uf = (f.properties.sigla || f.properties.SIGLA || "").toUpperCase();
  return { uf, path: r1(pathGen(f)) };
}).filter((s) => s.uf);

fs.writeFileSync(`${OUT}/brazil-states.ts`,
  `// GERADO por scripts/gen-brazil-map.mjs — não editar à mão.\n` +
  `export const BRAZIL_VIEWBOX = "0 0 ${W} ${H}";\n` +
  `export const BRAZIL_STATES: { uf: string; path: string }[] = ${JSON.stringify(states)};\n`);

// 4) municípios -> [x,y] já projetados
const out = {};
for (const row of fs.readFileSync(`${DATA}/municipios.csv`, "utf8").trim().split("\n").slice(1)) {
  const [, nome, lat, lng, , codUf] = row.split(",");
  const uf = CODE_UF[codUf];
  if (!uf) continue;
  const [x, y] = proj([parseFloat(lng), parseFloat(lat)]);
  out[`${norm(nome)}|${uf}`] = [+x.toFixed(1), +y.toFixed(1)];
}
// 5) fallback: centroide de cada estado
for (const f of geo.features) {
  const uf = (f.properties.sigla || f.properties.SIGLA || "").toUpperCase();
  if (!uf) continue;
  const [x, y] = proj(geoCentroid(f));
  out[`_uf|${uf}`] = [+x.toFixed(1), +y.toFixed(1)];
}
fs.writeFileSync(`${OUT}/municipios.json`, JSON.stringify(out));
console.log(`OK — ${states.length} estados, ${Object.keys(out).length} chaves`);
```

- [ ] **Step 3: Rodar o gerador**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce-3/emach-ecommerce && mkdir -p apps/web/src/lib/branch-map && node scripts/gen-brazil-map.mjs`
Expected: `OK — 27 estados, ~5597 chaves` e os 2 arquivos criados.

- [ ] **Step 4: Sanity check dos assets**

Run:
```bash
node -e 'const m=require("./apps/web/src/lib/branch-map/municipios.json");const [x,y]=m["sao paulo|SP"];console.log("SP:",x,y,"viewbox 560x580 =>", x>280&&x<560&&y>290&&y<580 ? "OK (sudeste)":"FORA");console.log("Manaus:",m["manaus|AM"],"| fallback BA:",m["_uf|BA"]);'
```
Expected: SP em x∈(280,560) y∈(290,580) → "OK (sudeste)"; Manaus presente; `_uf|BA` presente.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-brazil-map.mjs apps/web/src/lib/branch-map/municipios.json apps/web/src/lib/branch-map/brazil-states.ts apps/web/package.json .gitignore
git commit -m "feat: gerador offline e assets do mapa de filiais"
```

---

## Task 2: `geocode.ts` + types (TDD)

**Files:**
- Create: `apps/web/src/lib/branch-map/types.ts`
- Create: `apps/web/src/lib/branch-map/geocode.ts`
- Test: `apps/web/src/lib/branch-map/geocode.test.ts`

- [ ] **Step 1: Escrever os types**

```ts
// apps/web/src/lib/branch-map/types.ts
export type BranchPin = {
	id: string;
	name: string;
	city: string;
	uf: string;
	address: string;
	phone: string | null;
	hours: string | null;
	x: number;
	y: number;
	mapsUrl: string;
};

export type StateShape = { uf: string; path: string; highlighted: boolean };
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
// apps/web/src/lib/branch-map/geocode.test.ts
import { describe, expect, it } from "vitest";
import { cityToXY } from "./geocode";

describe("cityToXY", () => {
	it("acha cidade conhecida e retorna [x,y] no viewBox", () => {
		const xy = cityToXY("São Paulo", "SP");
		expect(xy).not.toBeNull();
		const [x, y] = xy!;
		expect(x).toBeGreaterThan(0);
		expect(x).toBeLessThan(560);
		expect(y).toBeGreaterThan(0);
		expect(y).toBeLessThan(580);
	});

	it("normaliza acento e caixa", () => {
		expect(cityToXY("sao paulo", "sp")).toEqual(cityToXY("São Paulo", "SP"));
	});

	it("cai no centroide da UF quando a cidade não existe na base", () => {
		const fallback = cityToXY("Cidade Inexistente", "BA");
		expect(fallback).not.toBeNull();
		expect(fallback).toEqual(cityToXY("__qualquer__", "BA"));
	});

	it("retorna null para UF inválida sem fallback", () => {
		expect(cityToXY("Qualquer", "ZZ")).toBeNull();
	});
});
```

- [ ] **Step 3: Rodar o teste (deve falhar)**

Run: `cd apps/web && bunx vitest run src/lib/branch-map/geocode.test.ts`
Expected: FAIL — `cityToXY` não existe.

- [ ] **Step 4: Implementar `geocode.ts`**

```ts
// apps/web/src/lib/branch-map/geocode.ts
import municipios from "./municipios.json";

const TABLE = municipios as Record<string, [number, number]>;
const norm = (s: string) =>
	s
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.trim();

/** Coordenada [x,y] no viewBox do mapa para uma cidade. Fallback: centroide da UF. */
export function cityToXY(city: string, uf: string): [number, number] | null {
	const sigla = uf.toUpperCase();
	return TABLE[`${norm(city)}|${sigla}`] ?? TABLE[`_uf|${sigla}`] ?? null;
}
```

- [ ] **Step 5: Rodar o teste (deve passar)**

Run: `cd apps/web && bunx vitest run src/lib/branch-map/geocode.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/branch-map/types.ts apps/web/src/lib/branch-map/geocode.ts apps/web/src/lib/branch-map/geocode.test.ts
git commit -m "feat: geocode de filial por cidade/UF com fallback"
```

---

## Task 3: `lib/branches.ts` — query + formatters compartilhados (TDD parcial)

**Files:**
- Create: `apps/web/src/lib/branches.ts`
- Test: `apps/web/src/lib/branches.test.ts`

- [ ] **Step 1: Escrever o teste das funções puras**

```ts
// apps/web/src/lib/branches.test.ts
import { describe, expect, it } from "vitest";
import { branchMapsUrl, formatPhone } from "./branches";

describe("formatPhone", () => {
	it("formata celular de 11 dígitos", () => {
		expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
	});
	it("formata fixo de 10 dígitos", () => {
		expect(formatPhone("4136100000")).toBe("(41) 3610-0000");
	});
	it("retorna null sem telefone", () => {
		expect(formatPhone(null)).toBeNull();
	});
});

describe("branchMapsUrl", () => {
	it("monta url de busca do Google Maps com o endereço encodado", () => {
		const url = branchMapsUrl({
			street: "Av. Paulista",
			streetNumber: "1578",
			neighborhood: "Bela Vista",
			city: "São Paulo",
			state: "SP",
		});
		expect(url).toContain("https://www.google.com/maps/search/?api=1&query=");
		expect(url).toContain(encodeURIComponent("Av. Paulista"));
		expect(url).toContain(encodeURIComponent("São Paulo/SP"));
	});
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `cd apps/web && bunx vitest run src/lib/branches.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `lib/branches.ts`** (move os formatters da `/sobre` e adiciona query + url)

```ts
// apps/web/src/lib/branches.ts
import { db } from "@emach/db";
import type { BranchBusinessHours } from "@emach/db/schema/inventory";
import { branch as branchTable } from "@emach/db/schema/inventory";
import { asc, eq } from "drizzle-orm";

export type BranchRow = {
	id: string;
	name: string;
	phone: string | null;
	businessHours: BranchBusinessHours | null;
	cep: string | null;
	street: string | null;
	streetNumber: string | null;
	neighborhood: string | null;
	city: string | null;
	state: string | null;
};

export async function getActiveBranches(): Promise<BranchRow[]> {
	return db
		.select({
			id: branchTable.id,
			name: branchTable.name,
			phone: branchTable.phone,
			businessHours: branchTable.businessHours,
			cep: branchTable.cep,
			street: branchTable.street,
			streetNumber: branchTable.streetNumber,
			neighborhood: branchTable.neighborhood,
			city: branchTable.city,
			state: branchTable.state,
		})
		.from(branchTable)
		.where(eq(branchTable.status, "active"))
		.orderBy(asc(branchTable.createdAt), asc(branchTable.id));
}

export function formatCep(cep: string | null) {
	if (!cep) return null;
	const digits = cep.replace(/\D/g, "");
	if (digits.length !== 8) return cep;
	return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatPhone(phone: string | null) {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, "");
	if (digits.length === 11)
		return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
	if (digits.length === 10)
		return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
	return phone;
}

export function formatBusinessHours(hours: BranchBusinessHours | null) {
	if (!hours) return null;
	const formatPeriod = (
		label: string,
		period: BranchBusinessHours[keyof BranchBusinessHours]
	) => {
		if (!period?.isOpen) return `${label}: fechado`;
		if (!(period.opensAt && period.closesAt)) return `${label}: aberto`;
		return `${label}: ${period.opensAt}-${period.closesAt}`;
	};
	return [
		formatPeriod("Seg-sex", hours.weekdays),
		formatPeriod("Sáb", hours.saturday),
		formatPeriod("Feriados", hours.holidays),
	].join(" | ");
}

export function formatBranchAddress(row: {
	cep: string | null;
	city: string | null;
	neighborhood: string | null;
	state: string | null;
	street: string | null;
	streetNumber: string | null;
}) {
	const streetLine = [row.street, row.streetNumber].filter(Boolean).join(", ");
	const cityLine = [row.city, row.state].filter(Boolean).join("/");
	const cep = formatCep(row.cep);
	return [streetLine, row.neighborhood, cityLine, cep ? `CEP ${cep}` : null]
		.filter(Boolean)
		.join(" - ");
}

export function branchMapsUrl(row: {
	street: string | null;
	streetNumber: string | null;
	neighborhood: string | null;
	city: string | null;
	state: string | null;
}): string {
	const locality = [row.city, row.state].filter(Boolean).join("/");
	const query = [row.street, row.streetNumber, row.neighborhood, locality]
		.filter(Boolean)
		.join(", ");
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `cd apps/web && bunx vitest run src/lib/branches.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/branches.ts apps/web/src/lib/branches.test.ts
git commit -m "feat: módulo compartilhado de filiais (query + formatters)"
```

---

## Task 4: `branch-map.tsx` — Client Component interativo

**Files:**
- Create: `apps/web/src/components/branch-map.tsx`

Verificação por `check-types` + smoke visual (não TDD — é UI).

- [ ] **Step 1: Escrever o componente**

```tsx
// apps/web/src/components/branch-map.tsx
"use client";

import { useState } from "react";
import { cn } from "@emach/ui/lib/utils";
import type { BranchPin, StateShape } from "@/lib/branch-map/types";

type Props = {
	pins: BranchPin[];
	states: StateShape[];
	viewBox: string;
};

const REDUCE_MOTION =
	typeof window !== "undefined" &&
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function BranchMap({ pins, states, viewBox }: Props) {
	const [hovered, setHovered] = useState<string | null>(null);
	const hoveredUf = pins.find((p) => p.id === hovered)?.uf ?? null;

	function activate(id: string | null, scroll: boolean) {
		setHovered(id);
		if (id && scroll) {
			document
				.getElementById(`branch-row-${id}`)
				?.scrollIntoView({
					block: "nearest",
					behavior: REDUCE_MOTION ? "auto" : "smooth",
				});
		}
	}

	return (
		<div className="flex flex-1 flex-col gap-0 border-white/10 border-l max-md:border-l-0 max-md:border-t md:flex-row">
			{/* MAPA */}
			<div className="flex flex-[0_0_50%] items-center justify-center p-6">
				<svg
					aria-label="Mapa do Brasil com as filiais EMACH"
					className="h-auto max-h-[420px] w-full overflow-visible"
					viewBox={viewBox}
				>
					{states.map((s) => (
						<path
							className={cn(
								"stroke-black transition-[fill] duration-200 ease-out",
								hoveredUf === s.uf
									? "fill-[var(--emach-red)]/55"
									: s.highlighted
										? "fill-white/[0.13]"
										: "fill-white/[0.05]"
							)}
							d={s.path}
							key={s.uf}
							strokeWidth={0.8}
						/>
					))}
					{pins.map((p) => (
						<a
							aria-label={`EMACH ${p.name} — ${p.address}`}
							href={p.mapsUrl}
							key={p.id}
							onBlur={() => activate(null, false)}
							onFocus={() => activate(p.id, true)}
							onMouseEnter={() => activate(p.id, true)}
							onMouseLeave={() => activate(null, false)}
							rel="noopener"
							target="_blank"
						>
							<circle
								className={cn(
									"fill-[var(--emach-red)] transition-opacity duration-200",
									hovered === p.id ? "opacity-40" : "opacity-20"
								)}
								cx={p.x}
								cy={p.y}
								r={14}
							/>
							<circle
								className="fill-[var(--emach-red)] stroke-black transition-[r] duration-200"
								cx={p.x}
								cy={p.y}
								r={hovered === p.id ? 9 : 6}
								strokeWidth={1.2}
							/>
						</a>
					))}
				</svg>
			</div>

			{/* LISTA */}
			<div className="flex flex-1 flex-col p-6">
				<p className="mb-2 font-display text-[11px] text-white/40 uppercase tracking-[0.16em]">
					{pins.length} {pins.length === 1 ? "loja física" : "lojas físicas"}
				</p>
				<div className="max-h-[360px] flex-1 overflow-y-auto pr-1 [scroll-behavior:smooth] motion-reduce:[scroll-behavior:auto]">
					{pins.map((p) => (
						<a
							className={cn(
								"block border border-transparent border-white/10 border-b px-3 py-3.5 no-underline transition-colors duration-200",
								hovered === p.id &&
									"border-[var(--emach-red)]/45 bg-[var(--emach-red)]/10"
							)}
							href={p.mapsUrl}
							id={`branch-row-${p.id}`}
							key={p.id}
							onMouseEnter={() => activate(p.id, false)}
							onMouseLeave={() => activate(null, false)}
							rel="noopener"
							target="_blank"
						>
							<div className="flex items-baseline gap-2">
								<span className="font-display font-semibold text-[20px] text-white">
									{p.name}
								</span>
								<span className="font-display font-semibold text-[12px] text-emach-red uppercase tracking-[0.1em]">
									{p.uf}
								</span>
							</div>
							<div className="mt-1 text-[12px] text-white/55">{p.address}</div>
							<div className="mt-1.5 flex gap-3.5 text-[11.5px] text-white/40">
								{p.phone && <span className="text-white/70">{p.phone}</span>}
								{p.hours && <span>{p.hours}</span>}
								<span className="text-white">Como chegar →</span>
							</div>
						</a>
					))}
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd apps/web && bun check-types`
Expected: sem erros relacionados a `branch-map.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/branch-map.tsx
git commit -m "feat: client component do mapa de filiais (hover-sync + scroll)"
```

---

## Task 5: `branch-map-section.tsx` — Server Component

**Files:**
- Create: `apps/web/src/components/branch-map-section.tsx`

- [ ] **Step 1: Escrever o componente**

```tsx
// apps/web/src/components/branch-map-section.tsx
import { EmachButton } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { SectionLabel } from "@/components/section-label";
import { BranchMap } from "@/components/branch-map";
import { BRAZIL_STATES, BRAZIL_VIEWBOX } from "@/lib/branch-map/brazil-states";
import { cityToXY } from "@/lib/branch-map/geocode";
import type { BranchPin, StateShape } from "@/lib/branch-map/types";
import {
	branchMapsUrl,
	formatBranchAddress,
	formatBusinessHours,
	formatPhone,
	getActiveBranches,
} from "@/lib/branches";
import { log } from "@/lib/evlog";

export async function BranchMapSection() {
	const branches = await getActiveBranches();

	const pins: BranchPin[] = [];
	for (const b of branches) {
		const xy = b.city && b.state ? cityToXY(b.city, b.state) : null;
		if (!xy) {
			log.warn({ action: "branch_map_geocode_miss", branchId: b.id, city: b.city, uf: b.state });
			continue;
		}
		pins.push({
			id: b.id,
			name: b.name,
			city: b.city ?? "",
			uf: (b.state ?? "").toUpperCase(),
			address: formatBranchAddress(b),
			phone: formatPhone(b.phone),
			hours: formatBusinessHours(b.businessHours),
			x: xy[0],
			y: xy[1],
			mapsUrl: branchMapsUrl(b),
		});
	}

	if (pins.length === 0) return null;

	const ufsWithBranch = new Set(pins.map((p) => p.uf));
	const states: StateShape[] = BRAZIL_STATES.map((s) => ({
		...s,
		highlighted: ufsWithBranch.has(s.uf),
	}));

	return (
		<section className="bg-black text-white">
			<PageContainer className="grid min-h-110 grid-cols-1 px-0 md:grid-cols-[36%_1fr]">
				<div className="flex flex-col justify-center gap-4 px-10 py-16 md:px-16">
					<SectionLabel tone="accent">Onde estamos</SectionLabel>
					<h2 className="font-display font-semibold text-[42px] leading-[1.0] tracking-[-0.01em]">
						Perto de quem
						<br />
						coloca a mão
						<br />
						na massa.
					</h2>
					<p className="max-w-[42ch] text-[15px] text-white/70 leading-relaxed">
						{pins.length === 1 ? "Loja física" : `${pins.length} lojas físicas`} no
						Sul e Sudeste. Você passa, vê a ferramenta na bancada, tira dúvida com
						quem usa e leva com nota fiscal.
					</p>
					<div className="mt-1">
						<EmachButton href="/sobre" size="lg" variant="outline-light">
							Ver filiais →
						</EmachButton>
					</div>
				</div>

				<BranchMap pins={pins} states={states} viewBox={BRAZIL_VIEWBOX} />
			</PageContainer>
		</section>
	);
}
```

- [ ] **Step 2: Verificar que `EmachButton` aceita `href`**

Run: `cd apps/web && grep -n "href" src/components/emach-button.tsx`
Expected: se `EmachButton` aceitar `href` (renderiza `<a>`/`<Link>`), use como acima. **Se NÃO aceitar**, envolva com `next/link`:
```tsx
import Link from "next/link";
// ...
<Link href="/sobre"><EmachButton size="lg" variant="outline-light">Ver filiais →</EmachButton></Link>
```

- [ ] **Step 3: Verificar tipos**

Run: `cd apps/web && bun check-types`
Expected: sem erros em `branch-map-section.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/branch-map-section.tsx
git commit -m "feat: server component da seção onde estamos"
```

---

## Task 6: Integrar na home + remover seção antiga

**Files:**
- Modify: `apps/web/src/app/(shop)/page.tsx`

- [ ] **Step 1: Remover a constante `STATS`** (`page.tsx:22-29`) inteira.

- [ ] **Step 2: Remover o markup da seção antiga** — o `<section className="bg-black text-white">…</section>` em `page.tsx:173-217` (o bloco "Feito para durar" com o grid de STATS).

- [ ] **Step 3: Importar e renderizar a nova seção** no lugar removido:

```tsx
import { BranchMapSection } from "@/components/branch-map-section";
// ...
// onde estava a <section> antiga, dentro de <main>, após o bloco recentTools:
<BranchMapSection />
```

- [ ] **Step 4: Remover imports órfãos**

Run: `cd apps/web && grep -n "cn\b\|SectionLabel" src/app/\(shop\)/page.tsx`
Se `cn` e/ou `SectionLabel` não forem mais usados em `page.tsx`, remova seus imports (`cn` em `:7`; `SectionLabel` em `:16`).

- [ ] **Step 5: check-types + smoke visual**

Run: `cd apps/web && bun check-types`
Expected: sem erros.

Smoke: a sessão `/dev-here 3009` está ativa. Visite `http://localhost:3009/`, role até o fim:
- mapa do Brasil renderiza com pins nas filiais (SP/PR/SC);
- hover num pin destaca o item da lista + estado, e rola a lista;
- hover num item destaca o pin/estado;
- click no pin abre Google Maps em nova aba;
- sem a barra vermelha vertical; sem os stats antigos.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(shop\)/page.tsx
git commit -m "feat: usa seção onde estamos na home, remove stats mock"
```

---

## Task 7: DRY — `/sobre` reusa `lib/branches.ts` + limpeza de CSS

**Files:**
- Modify: `apps/web/src/app/(shop)/sobre/page.tsx`
- Modify: `packages/ui/src/styles/globals.css`

- [ ] **Step 1: Refatorar `/sobre`** — remover as definições locais de `formatCep`,
  `formatPhone`, `formatBusinessHours`, `formatBranchAddress` (`sobre/page.tsx:67-139`) e a
  query inline de `getBranches`; importar de `@/lib/branches`:

```ts
import {
	branchMapsUrl,
	formatBranchAddress,
	formatBusinessHours,
	formatPhone,
	getActiveBranches,
} from "@/lib/branches";
```

Substituir o corpo de `getBranches()` para mapear `getActiveBranches()` nos `BranchCardData`
(manter `kicker`, `accent`, `mapEmbedUrl` que são locais da `/sobre`; trocar a montagem de
`mapsUrl` por `branchMapsUrl(row)`).

- [ ] **Step 2: check-types + smoke da `/sobre`**

Run: `cd apps/web && bun check-types`
Smoke: visitar `http://localhost:3009/sobre` — filiais aparecem iguais a antes (endereço, telefone, horário, mapa embed).

- [ ] **Step 3: Remover `.emach-bg-stats` se órfã**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce-3/emach-ecommerce && grep -rn "emach-bg-stats" apps packages`
Expected: se só aparecer a definição em `globals.css` (sem uso em `.tsx`), remover o bloco `.emach-bg-stats { … }`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(shop\)/sobre/page.tsx packages/ui/src/styles/globals.css
git commit -m "refactor: /sobre reusa lib de filiais, remove css órfão"
```

---

## Self-review (preenchido)

- **Spec coverage:** localização real → Task 1+2 (coords pré-projetadas + geocode); escala/scroll → Task 4 (lista `overflow-y` + scroll-into-view); hover-sync → Task 4; click→Maps → Task 3 (`branchMapsUrl`) + Task 4 (`<a>`); performance/SSR → Task 1 (assets offline) + Task 5 (server) + Task 4 (client fino); dados honestos → Task 4/5 (phone/hours condicional); copy/CTA → Task 5; a11y/motion → Task 4; limpeza → Task 6/7.
- **Placeholders:** nenhum — todo passo tem código/comando real.
- **Type consistency:** `BranchPin`/`StateShape` (Task 2) usados em Task 4/5; `cityToXY` retorna `[number,number]|null` e o caller (Task 5) trata null; `getActiveBranches`/`branchMapsUrl`/formatters (Task 3) consumidos em Task 5/7; `BRAZIL_STATES`/`BRAZIL_VIEWBOX` (Task 1) importados em Task 5.

## Riscos / pontos de atenção

- **`EmachButton` com `href`:** confirmado em Task 5 Step 3 (fallback `next/link`).
- **Propriedade `sigla` no GeoJSON:** o gerador lê `properties.sigla` (confirmado: o dataset tem `{id,name,sigla,...}`). Se trocar de fonte de GeoJSON, ajustar.
- **`mapshaper` via npx:** precisa de rede na 1ª execução do gerador (dev-only).
- **Tamanho de `municipios.json`** (~200KB): server-only (importado em `geocode.ts`, usado só no Server Component) — não vai pro bundle client.
```
