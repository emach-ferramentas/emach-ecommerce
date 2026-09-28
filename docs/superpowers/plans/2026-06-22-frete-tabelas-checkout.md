# Frete por tabelas no checkout Implementation Plan

> **Status em 2026-09-28:** substituído. O plano foi executado (#164), mas o PR #178 trocou o motor de tabelas pela Frenet. `getActiveCarriersWithTables` e o `quoteShipping` de zonas não existem mais em `packages/db/src/queries/`; `apps/web/src/lib/shipping/quote.ts` hoje cota via `apps/web/src/lib/frenet/`. Ver `docs/superpowers/plans/2026-07-02-frenet-cotacao.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a cotação SuperFrete pelo motor de frete por tabelas (`@emach/db/queries/shipping-quote`) no checkout e na calculadora de frete.

**Architecture:** Um adapter server-only (`lib/shipping/quote.ts`) com a **mesma assinatura de retorno** do atual (`{ negotiate, options: ShippingOption[] }`) — drop-in. A lógica testável é extraída em funções puras (`map.ts`, `build-items.ts`). Os consumidores trocam o import e o identificador `serviceId:number`→`carrierId:string`. SuperFrete é removido.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle, Vitest (node), Bun.

## Global Constraints

- Schema (`packages/db`) é **owned-by-dashboard** — NÃO editar.
- Proibido: `console.*` (usar `log` do evlog), `: any`, `as any`, `@ts-ignore`, `key={index}`, `useMemo`/`useCallback` manuais, `<img>` puro, barrel em `apps/web/src`.
- Server action: `"use server"`, guarda/validação Zod, catch com `log.error({ action, ... })` + `{ ok: false }`.
- `numeric` do Drizzle chega como **string** → `Number(...)` para usar.
- Comentários em PT; identificadores em EN. Conventional Commits em PT, subject ≤ 50 chars.
- `bun check-types` antes de cada commit. UI não é "feita" sem **smoke visual** na rota.
- Decisões do spec: substituir SuperFrete total; `out_of_catalog`/sem cobertura → `negotiate: true`; `declaredValue` = subtotal do carrinho; `overweightShippingAmount` e `shipping_insurance_policy` ficam **sem uso** no fluxo de tabelas.

## File Structure

- **Create** `apps/web/src/lib/shipping/types.ts` — `ShippingOption` (`carrierId: string`).
- **Create** `apps/web/src/lib/shipping/map.ts` (+ `map.test.ts`) — `mapQuoteResult` puro: `QuoteResult` → `{ negotiate, options }`.
- **Create** `apps/web/src/lib/shipping/build-items.ts` (+ `build-items.test.ts`) — `buildQuoteItems` puro: tool rows + carrinho → `QuoteItem[]`.
- **Create** `apps/web/src/lib/shipping/quote.ts` — adapter async (DB reads + puros + motor).
- **Modify** `_actions/quote-shipping.ts`, `_lib/place-order.ts`, `_components/shipping-options.tsx`, `_components/checkout-content.tsx`, `components/freight-calculator.tsx` — trocar import + `serviceId`→`carrierId`.
- **Modify** `_lib/place-order.shipping.test.ts` — trocar path do mock.
- **Delete** `apps/web/src/lib/superfrete/`; remover env `SUPERFRETE_*` (`packages/env` + Vercel); avaliar `lib/origin-branch.ts`.

---

### Task 1: Camada pura (`types`, `map`, `build-items`)

**Files:**
- Create: `apps/web/src/lib/shipping/types.ts`
- Create: `apps/web/src/lib/shipping/map.ts` · Test: `apps/web/src/lib/shipping/map.test.ts`
- Create: `apps/web/src/lib/shipping/build-items.ts` · Test: `apps/web/src/lib/shipping/build-items.test.ts`

**Interfaces:**
- Consumes: `QuoteResult`, `QuoteItem` de `@emach/db/queries/shipping-quote`.
- Produces: `ShippingOption`; `mapQuoteResult(result): { negotiate: boolean; options: ShippingOption[] }`; `buildQuoteItems(toolRows, cartItems): QuoteItem[]`.

- [ ] **Step 1: `types.ts`**

```ts
export interface ShippingOption {
	carrierId: string;
	company: string;
	deliveryDays: number;
	name: string;
	priceCents: number;
}
```

- [ ] **Step 2: Teste de `mapQuoteResult` (falha)**

Create `apps/web/src/lib/shipping/map.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapQuoteResult } from "./map";

describe("mapQuoteResult", () => {
	it("mapeia options para ShippingOption ordenado por preço", () => {
		const out = mapQuoteResult({
			options: [
				{ carrierId: "c2", carrierName: "Beta", amount: 50.5, deliveryDays: 3 },
				{ carrierId: "c1", carrierName: "Alfa", amount: 30, deliveryDays: null },
			],
			unquotable: [],
		});
		expect(out.negotiate).toBe(false);
		expect(out.options).toEqual([
			{ carrierId: "c1", name: "Alfa", company: "Alfa", priceCents: 3000, deliveryDays: 0 },
			{ carrierId: "c2", name: "Beta", company: "Beta", priceCents: 5050, deliveryDays: 3 },
		]);
	});

	it("negotiate=true quando não há options", () => {
		const out = mapQuoteResult({
			options: [],
			unquotable: [{ carrierId: "c1", carrierName: "Alfa", reason: "out_of_catalog" }],
		});
		expect(out).toEqual({ negotiate: true, options: [] });
	});
});
```

- [ ] **Step 3: Rodar (falha)** — `bun run --filter=web test src/lib/shipping/map.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 4: `map.ts`**

```ts
import type { QuoteResult } from "@emach/db/queries/shipping-quote";
import type { ShippingOption } from "./types";

// Mapeia o resultado do motor de tabelas para o contrato da UID (ShippingOption).
// Sem options cotáveis (todos unquotable / out_of_catalog) → "Frete a combinar".
export function mapQuoteResult(result: QuoteResult): {
	negotiate: boolean;
	options: ShippingOption[];
} {
	const options = result.options
		.map((o) => ({
			carrierId: o.carrierId,
			name: o.carrierName,
			company: o.carrierName,
			priceCents: Math.round(o.amount * 100),
			deliveryDays: o.deliveryDays ?? 0,
		}))
		.sort((a, b) => a.priceCents - b.priceCents);
	return { negotiate: options.length === 0, options };
}
```

- [ ] **Step 5: Rodar (passa)** — `bun run --filter=web test src/lib/shipping/map.test.ts` → PASS (2).

- [ ] **Step 6: Teste de `buildQuoteItems` (falha)**

Create `apps/web/src/lib/shipping/build-items.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildQuoteItems } from "./build-items";

const row = {
	id: "t1",
	weightKg: "2.500",
	lengthCm: "30.00",
	widthCm: "20.00",
	heightCm: "10.00",
	packagingWeightKg: "0.300",
	stackable: true,
	shipsInOwnBox: false,
};

describe("buildQuoteItems", () => {
	it("converte numeric (string) para number e propaga qty", () => {
		expect(buildQuoteItems([row], [{ toolId: "t1", quantity: 2 }])).toEqual([
			{
				heightCm: 10,
				lengthCm: 30,
				widthCm: 20,
				weightKg: 2.5,
				packagingWeightKg: 0.3,
				stackable: true,
				shipsInOwnBox: false,
				qty: 2,
			},
		]);
	});

	it("lança quando a ferramenta não existe", () => {
		expect(() => buildQuoteItems([], [{ toolId: "x", quantity: 1 }])).toThrow(
			"Ferramenta x não encontrada"
		);
	});
});
```

- [ ] **Step 7: Rodar (falha)** — `bun run --filter=web test src/lib/shipping/build-items.test.ts` → FAIL.

- [ ] **Step 8: `build-items.ts`**

```ts
import type { QuoteItem } from "@emach/db/queries/shipping-quote";

export interface ToolDimRow {
	heightCm: string;
	id: string;
	lengthCm: string;
	packagingWeightKg: string;
	shipsInOwnBox: boolean;
	stackable: boolean;
	weightKg: string;
	widthCm: string;
}

// Monta os QuoteItem do motor a partir das linhas de `tool` (numeric→number)
// e do carrinho. Lança se algum toolId do carrinho não existe.
export function buildQuoteItems(
	toolRows: ToolDimRow[],
	cartItems: { toolId: string; quantity: number }[]
): QuoteItem[] {
	const byId = new Map(toolRows.map((t) => [t.id, t]));
	return cartItems.map((item) => {
		const t = byId.get(item.toolId);
		if (!t) {
			throw new Error(`Ferramenta ${item.toolId} não encontrada`);
		}
		return {
			heightCm: Number(t.heightCm),
			lengthCm: Number(t.lengthCm),
			widthCm: Number(t.widthCm),
			weightKg: Number(t.weightKg),
			packagingWeightKg: Number(t.packagingWeightKg),
			stackable: t.stackable,
			shipsInOwnBox: t.shipsInOwnBox,
			qty: item.quantity,
		};
	});
}
```

- [ ] **Step 9: Rodar (passa) + check-types** — `bun run --filter=web test src/lib/shipping/` → PASS; `bun check-types` → sem erros.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/shipping/
git commit -m "feat: camada pura do frete por tabelas"
```

---

### Task 2: Adapter `quote.ts` + action

**Files:**
- Create: `apps/web/src/lib/shipping/quote.ts`
- Modify: `apps/web/src/app/checkout/_actions/quote-shipping.ts`

**Interfaces:**
- Consumes: `buildQuoteItems`, `mapQuoteResult`, `ShippingOption` (Task 1); `getActiveCarriersWithTables`/`getActiveBoxes` (`@emach/db/queries/shipping`); `quoteShipping` do motor (`@emach/db/queries/shipping-quote`).
- Produces: `quoteShipping(input): Promise<{ negotiate: boolean; options: ShippingOption[] }>` em `@/lib/shipping/quote`.

- [ ] **Step 1: `quote.ts` (adapter)**

```ts
import { db } from "@emach/db";
import { getActiveBoxes, getActiveCarriersWithTables } from "@emach/db/queries/shipping";
import { quoteShipping as quoteByTables } from "@emach/db/queries/shipping-quote";
import { tool } from "@emach/db/schema/tools";
import { inArray } from "drizzle-orm";

import { buildQuoteItems } from "./build-items";
import { mapQuoteResult } from "./map";
import type { ShippingOption } from "./types";

export interface QuoteShippingInput {
	declaredValueCents?: number;
	destinationCep: string;
	items: { toolId: string; quantity: number }[];
}

// Cotação por tabelas próprias (substitui SuperFrete). declaredValue = subtotal
// do carrinho (centavos→reais); GRIS/ad valorem vêm do carrier. Sem cobertura
// (sem zona/faixa/caixa) → negotiate=true.
export async function quoteShipping(
	input: QuoteShippingInput
): Promise<{ negotiate: boolean; options: ShippingOption[] }> {
	const toolIds = Array.from(new Set(input.items.map((i) => i.toolId)));
	const [carriers, boxes, toolRows] = await Promise.all([
		getActiveCarriersWithTables(db),
		getActiveBoxes(db),
		db
			.select({
				id: tool.id,
				weightKg: tool.weightKg,
				lengthCm: tool.lengthCm,
				widthCm: tool.widthCm,
				heightCm: tool.heightCm,
				packagingWeightKg: tool.packagingWeightKg,
				stackable: tool.stackable,
				shipsInOwnBox: tool.shipsInOwnBox,
			})
			.from(tool)
			.where(inArray(tool.id, toolIds)),
	]);

	const items = buildQuoteItems(toolRows, input.items);
	const result = quoteByTables({
		items,
		destinationCep: input.destinationCep,
		declaredValue: (input.declaredValueCents ?? 0) / 100,
		carriers,
		boxes,
	});
	return mapQuoteResult(result);
}
```

- [ ] **Step 2: Trocar o import na action**

Em `apps/web/src/app/checkout/_actions/quote-shipping.ts`: trocar
`import { quoteShipping } from "@/lib/superfrete/quote";` por
`import { quoteShipping } from "@/lib/shipping/quote";`
e `import type { ShippingOption } from "@/lib/superfrete/types";` por
`import type { ShippingOption } from "@/lib/shipping/types";`.
O corpo da action (validação Zod, rate limit, retorno `{ ok, options, negotiate }`) permanece idêntico.

- [ ] **Step 3: check-types** — `bun check-types` → sem erros (o retorno do novo `quoteShipping` casa com o uso atual `{ options, negotiate }`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/shipping/quote.ts apps/web/src/app/checkout/_actions/quote-shipping.ts
git commit -m "feat: adapter de frete por tabelas no checkout"
```

---

### Task 3: `place-order.ts` revalida via tabelas

**Files:**
- Modify: `apps/web/src/app/checkout/_lib/place-order.ts` (import na linha 23)
- Modify: `apps/web/src/app/checkout/_lib/place-order.shipping.test.ts` (mock path)

**Interfaces:**
- Consumes: `quoteShipping` de `@/lib/shipping/quote` (Task 2).

- [ ] **Step 1: Trocar o import**

Em `place-order.ts:23`: `import { quoteShipping } from "@/lib/superfrete/quote";` → `import { quoteShipping } from "@/lib/shipping/quote";`. A lógica de `assertShippingQuoted` (re-cota, tolerância de preço, `shippingUnverified`, `negotiate`) **não muda** — o contrato de retorno é o mesmo.

- [ ] **Step 2: Atualizar o mock do teste**

Em `place-order.shipping.test.ts`, trocar todas as referências `"@/lib/superfrete/quote"` por `"@/lib/shipping/quote"` (linhas com `vi.mock(...)` e `import { quoteShipping }`).

- [ ] **Step 3: Rodar + check-types**

Run: `bun run --filter=web test src/app/checkout/_lib/place-order.shipping.test.ts`
Expected: PASS. Depois `bun check-types` → sem erros.

(Se `place-order.shipping.test.ts` usa `withRollback`/DB, confirmar que está na lista `INTEGRATION` de `vitest.config.ts`; se for unit com mock puro, sem ação.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/checkout/_lib/place-order.ts apps/web/src/app/checkout/_lib/place-order.shipping.test.ts
git commit -m "feat: place-order revalida frete por tabelas"
```

---

### Task 4: Consumidores de UI (`serviceId`→`carrierId`)

**Files:**
- Modify: `apps/web/src/app/checkout/_components/shipping-options.tsx`
- Modify: `apps/web/src/app/checkout/_components/checkout-content.tsx`
- Modify: `apps/web/src/components/freight-calculator.tsx`

**Interfaces:**
- Consumes: `ShippingOption` (`carrierId: string`) de `@/lib/shipping/types`.

Mudança mecânica guiada por tipos: trocar o import de `@/lib/superfrete/types` por `@/lib/shipping/types`; o `check-types` apontará cada uso de `serviceId` (number) que precisa virar `carrierId` (string) — em `key={...}` de `.map`, no estado de opção selecionada, e em comparações. **Read cada arquivo antes de editar.**

- [ ] **Step 1:** Em cada um dos 3 arquivos, trocar o import de tipo para `@/lib/shipping/types`.

- [ ] **Step 2:** Rodar `bun check-types` e corrigir cada erro de `serviceId` → `carrierId` que o tsc apontar (key, seleção, props). Repetir até zero erros.

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 3: Smoke visual (obrigatório)**

`bun dev:web` → ir ao checkout com itens no carrinho:
1. CEP **coberto** pela zona seed → opções de frete aparecem, selecionáveis, preço correto.
2. CEP **fora** de cobertura → "Frete a combinar" (`negotiate`).
3. Calculadora na página de produto (`freight-calculator`) → cota 1 item igual.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/checkout/_components/shipping-options.tsx apps/web/src/app/checkout/_components/checkout-content.tsx apps/web/src/components/freight-calculator.tsx
git commit -m "feat: UI de frete usa carrierId (tabelas)"
```

---

### Task 5: Remover SuperFrete + env vars

**Files:**
- Delete: `apps/web/src/lib/superfrete/` (client.ts, client.test.ts, quote.ts, quote.test.ts, types.ts)
- Modify: `packages/env/src/*` (remover `SUPERFRETE_*` do schema Zod)
- Modify: `apps/web/.env` (remover `SUPERFRETE_*`) — e **Vercel** (ação do usuário; ver nota)
- Evaluate: `apps/web/src/lib/origin-branch.ts`

**Interfaces:** nenhuma (cleanup; é a última task).

- [ ] **Step 1: Confirmar que nada mais importa superfrete**

Run: `rg -n "superfrete|SuperFrete|SUPERFRETE" apps/web/src packages/env/src`
Expected: só os próprios arquivos a remover + o schema env. Se algum consumidor sobrou, voltar à task correspondente.

- [ ] **Step 2: Remover a pasta superfrete**

```bash
git rm -r apps/web/src/lib/superfrete/
```

- [ ] **Step 3: Remover `SUPERFRETE_*` do schema env**

Read `packages/env/src/server.ts` (ou onde os `SUPERFRETE_*` são declarados via `rg -n SUPERFRETE packages/env`), remover as 3 chaves (`SUPERFRETE_TOKEN`, `SUPERFRETE_BASE_URL`, `SUPERFRETE_USER_AGENT`) do objeto Zod. Remover as linhas correspondentes de `apps/web/.env`.

- [ ] **Step 4: Avaliar origin-branch**

Run: `rg -n "origin-branch|getOriginBranchCep|DEFAULT_BRANCH_ID" apps/web/src`
Se o único consumidor era o superfrete (já removido), `git rm apps/web/src/lib/origin-branch.ts` e remover `DEFAULT_BRANCH_ID` do schema env. Se houver outro consumidor, **deixar como está** e anotar no PR.

- [ ] **Step 5: check-types + check:env**

Run: `bun check-types` → sem erros.
Run: `bun check:env` → pode falhar apontando `SUPERFRETE_*` ainda na Vercel. **Nota de rollout:** remover essas env vars na Vercel (`vercel env rm SUPERFRETE_TOKEN`, etc.) — ação do usuário; até lá o `check:env` do CI acusa divergência. Documentar no PR.

- [ ] **Step 6: Suite completa + Commit**

Run: `bun run --filter=web test:ci` → PASS.

```bash
git add -A
git commit -m "chore: remove SuperFrete do storefront"
```

---

## Self-Review

**1. Spec coverage:**
- Adapter drop-in `{ negotiate, options }` → Task 2. ✓
- `ShippingOption` `serviceId`→`carrierId` → Task 1 (tipo) + Task 4 (UI). ✓
- Montagem `QuoteItem` (numeric→number) → Task 1 (build-items, testado). ✓
- `negotiate` quando sem cobertura/`out_of_catalog` → Task 1 (map, testado). ✓
- `declaredValue` = subtotal → Task 2 (`declaredValueCents/100`). ✓
- Revalidação place-order inalterada / fail-open resolvido → Task 3. ✓
- Cleanup superfrete + env vars + origin-branch → Task 5. ✓
- Testes: motor (sync, não duplicar) + puros (Task 1) + place-order (Task 3) + smoke (Task 4). ✓

**2. Placeholder scan:** sem TBD/TODO; código real em cada step. Task 4 é mecânica guiada por `check-types` (mudança de identificador em código existente — instrução de Read+trocar, não placeholder).

**3. Type consistency:** `mapQuoteResult`/`buildQuoteItems`/`ShippingOption`/`quoteShipping` idênticos entre Task 1→2→3→4. `QuoteResult`/`QuoteItem` vêm do motor sincronizado. ✓

## Rollout (não-código)

- Remover `SUPERFRETE_*` (e talvez `DEFAULT_BRANCH_ID`) da **Vercel** após o merge — senão `bun check:env` acusa divergência.
- Cadastrar transportadoras/tarifas/caixas **reais** no dashboard (`/dashboard/shipping`); sem isso, produção cota só pela zona seed ou cai em "a combinar".
