# Follow-ups do cupom no checkout — Implementation Plan

> **Status em 2026-09-28:** implementado. Unidade A, B e C estão no código: `apps/web/src/lib/auto-promo.ts`, `validateCoupon(tx, code, lines, autoPromoToolIds?)` em `lib/coupons/validate-coupon.ts`, `reconcilePrices` em `lib/cart-store.ts` e `apps/web/src/app/checkout/_actions/revalidate-cart.ts`. A Task 10 (issue de handoff no `emach-dashboard`) não foi verificada por este repo. O código dos passos divergiu em detalhes (ver as notas abaixo); os checkboxes ficam como estavam.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver os follow-ups ecommerce-owned da issue #57 (itens 2, 3, 5, 6) — consolidar utils, deduplicar a regra de auto-promo com set injetável, e revalidar preços do carrinho no checkout — e abrir um issue de handoff no dashboard para os itens cross-repo (1, 4).

**Architecture:** Três unidades em ordem de dependência. **A** consolida conversores/format em `lib/format.ts` (refactor puro). **B** centraliza a regra de elegibilidade de auto-promo em `lib/promotions.ts` _(nota 2026-09-28: ficou em `lib/auto-promo.ts`, como a tabela e a Task 3 abaixo já dizem)_ e injeta o set já computado no `validateCoupon` (elimina queries redundantes). **C** adiciona um server action que revalida preços ao montar o checkout, reconciliando display + snapshot do `localStorage` silenciosamente, com clamp no total.

**Tech Stack:** Next.js 16 (Turbopack), React 19, Drizzle ORM, Zod, Vitest (ambiente `node`, testes de integração com DB real via `withRollback`), TanStack Form.

**Spec:** `docs/superpowers/specs/2026-06-07-followups-cupom-checkout-design.md`

**Convenções deste repo (não violar):**
- Teste por arquivo: `cd apps/web && ./node_modules/.bin/vitest run <caminho-relativo>` (o `.env` é carregado pelo mise; os testes batem no Supabase compartilhado).
- `check-types`: `cd apps/web && ./node_modules/.bin/tsc --noEmit`.
- Lint: na raiz, `bun run check` (ultracite/biome).
- Read cada arquivo antes de Edit. Sem `console.*` (usar `log` do evlog). Sem `: any`/`as any`.
- `packages/db/src/queries/catalog.ts` é **owned-by-dashboard** — não editar (synced via CI).

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/web/src/lib/format.ts` | usar | conversor único `numericToCents`, format `fmtNumericBRL` |
| `apps/web/src/app/checkout/_lib/place-order.ts` | modify | remover `centsFromString` e a fn local de auto-promo; injetar set no cupom |
| `apps/web/src/app/checkout/_actions/create-order.ts` | modify | import de `numericToCents` |
| `apps/web/src/lib/coupons/validate-coupon.ts` | modify | aceitar set injetável; usar helper canônico no fallback; `fmtNumericBRL` |
| `apps/web/src/app/checkout/_actions/apply-coupon.ts` | modify | `numericToCents`; exportar schema/tipo do cart-item |
| `apps/web/src/app/checkout/_components/coupon-field.tsx` | modify | tipar `cartItems` via tipo compartilhado |
| `apps/web/src/lib/auto-promo.ts` | **create** | `fetchAutoPromosByToolId`, `autoPromoToolIdsFromMap`, tipo `AutoPromo` — **server-only** (importa `db`/drizzle/schema) |
| `apps/web/src/lib/auto-promo.test.ts` | create | testa helper de auto-promo |
| `apps/web/src/lib/promotions.ts` | **inalterado** | `effectiveAutoDiscountCents` (puro). É importado por `product-info.tsx` (**Client Component**) → NÃO pode importar `db`/drizzle. Por isso a query de auto-promo vai em `auto-promo.ts`, não aqui. |
| `apps/web/src/lib/cart-store.ts` | modify | + `reconcilePrices` |
| `apps/web/src/lib/cart-store.test.ts` | create | testa `reconcilePrices` |
| `apps/web/src/lib/cart-context.tsx` | modify | expor `reconcile` |
| `apps/web/src/app/checkout/_actions/revalidate-cart.ts` | create | server action + `computeFinalPrices` |
| `apps/web/src/app/checkout/_actions/revalidate-cart.test.ts` | create | testa `computeFinalPrices` |
| `apps/web/src/app/checkout/_components/checkout-content.tsx` | modify | revalida no mount, reconcilia, clamp no total |

---

## Task 1 (Unidade A.1): Conversor único de centavos

Refactor puro — sem comportamento novo. A verificação é a suíte existente continuar verde.

**Files:**
- Modify: `apps/web/src/app/checkout/_lib/place-order.ts:85-87` (remove `centsFromString`), `:326`, `:338`, `:457`, `:464` (usos)
- Modify: `apps/web/src/app/checkout/_actions/create-order.ts:13,48`
- Modify: `apps/web/src/lib/coupons/validate-coupon.ts:125`
- Modify: `apps/web/src/app/checkout/_actions/apply-coupon.ts:60`

- [ ] **Step 1: `place-order.ts` — remover `centsFromString`, importar `numericToCents`**

No topo, na linha de import de format (não existe ainda — adicionar):
```ts
import { numericToCents } from "@/lib/format";
```
Remover o bloco:
```ts
export function centsFromString(amount: string): number {
	return Math.round(Number(amount) * 100);
}
```
Substituir as 4 chamadas `centsFromString(` por `numericToCents(` (linhas ~326, 338, 457, 464).

- [ ] **Step 2: `create-order.ts` — trocar import**

A linha 13 importa `centsFromString` de `place-order`. Trocar para importar `numericToCents` de `@/lib/format` e usar na linha 48:
```ts
import { numericToCents } from "@/lib/format";
// ...
shippingCents: numericToCents(input.shippingAmount),
```
(Conferir se `centsFromString` ainda é importado de `place-order` em outro ponto do arquivo; se não, remover do import.)

- [ ] **Step 3: `validate-coupon.ts` e `apply-coupon.ts` — usar `numericToCents`**

Em `validate-coupon.ts:125`, trocar `Math.round(Number(promo.minOrderAmount) * 100)` por `numericToCents(promo.minOrderAmount)`. Adicionar `import { numericToCents } from "@/lib/format";`.
Em `apply-coupon.ts:60`, trocar `Math.round(Number(variant.priceAmount) * 100)` por `numericToCents(variant.priceAmount)`. Adicionar o import.

- [ ] **Step 4: check-types**

Run: `cd apps/web && ./node_modules/.bin/tsc --noEmit`
Expected: sem erros (em especial, nenhum `centsFromString is not exported`).

- [ ] **Step 5: rodar os testes afetados**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/app/checkout/_lib/place-order.test.ts src/lib/coupons/validate-coupon.test.ts`
Expected: PASS (comportamento idêntico).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/checkout/_lib/place-order.ts apps/web/src/app/checkout/_actions/create-order.ts apps/web/src/lib/coupons/validate-coupon.ts apps/web/src/app/checkout/_actions/apply-coupon.ts
git commit -m "refactor: consolida conversor de centavos em numericToCents (#57)"
```

---

## Task 2 (Unidade A.2): Format BRL único + tipo compartilhado do cart-item

**Files:**
- Modify: `apps/web/src/lib/coupons/validate-coupon.ts:124-133`
- Modify: `apps/web/src/app/checkout/_actions/apply-coupon.ts:12-23`
- Modify: `apps/web/src/app/checkout/_components/coupon-field.tsx:8-19`

- [ ] **Step 1: `validate-coupon.ts` — usar `fmtNumericBRL` no erro de mínimo**

Trocar o bloco que formata `minBRL` inline:
```ts
if (promo.minOrderAmount !== null) {
	const minCents = numericToCents(promo.minOrderAmount);
	if (eligibleSubtotalCents < minCents) {
		return { ok: false, error: `Pedido mínimo de ${fmtNumericBRL(promo.minOrderAmount)}` };
	}
}
```
Adicionar `fmtNumericBRL` ao import de `@/lib/format`.

- [ ] **Step 2: `apply-coupon.ts` — exportar schema/tipo do cart-item**

Extrair o shape do item para um schema nomeado e exportá-lo:
```ts
export const couponCartItemSchema = z.object({
	toolId: z.string().min(1),
	variantId: z.string().min(1),
	quantity: z.number().int().positive(),
});
export type CouponCartItem = z.infer<typeof couponCartItemSchema>;

const schema = z.object({
	code: z.string().min(1),
	cartItems: z.array(couponCartItemSchema).min(1),
});
```

- [ ] **Step 3: `coupon-field.tsx` — usar o tipo compartilhado**

Remover a interface local `CouponCartItem` e importar o tipo:
```ts
import { applyCouponAction, type CouponCartItem } from "@/app/checkout/_actions/apply-coupon";
```
`CouponFieldProps.cartItems` continua `CouponCartItem[]` — agora vindo do schema.

- [ ] **Step 4: check-types**

Run: `cd apps/web && ./node_modules/.bin/tsc --noEmit`
Expected: sem erros. (`checkout-content.tsx` passa `cartItems` com `{toolId, variantId, quantity}` — bate com o schema.)

- [ ] **Step 5: rodar testes do cupom**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/lib/coupons/validate-coupon.test.ts`
Expected: PASS — em especial o teste "rejeita abaixo do pedido mínimo" continua casando `/Pedido mínimo/`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/coupons/validate-coupon.ts apps/web/src/app/checkout/_actions/apply-coupon.ts apps/web/src/app/checkout/_components/coupon-field.tsx
git commit -m "refactor: fmtNumericBRL e tipo compartilhado do cart-item do cupom (#57)"
```

---

## Task 3 (Unidade B.1): Helper canônico de auto-promo em `lib/auto-promo.ts`

Cria a fonte única da regra de elegibilidade num **módulo server-only novo**, `lib/auto-promo.ts`.

> **Por que módulo separado, e não estender `lib/promotions.ts`:** `lib/promotions.ts` exporta `effectiveAutoDiscountCents` (puro) e é importado por `product-info.tsx`, que é `"use client"`. Se a query de auto-promo (que importa `db`/drizzle/schema) entrasse em `promotions.ts`, o driver do banco vazaria para o bundle do cliente e o build quebraria. Mantemos `promotions.ts` puro e isolamos a query em `auto-promo.ts` (só consumido por código server).

**Files:**
- Create: `apps/web/src/lib/auto-promo.ts`
- Create: `apps/web/src/lib/auto-promo.test.ts`

- [ ] **Step 1: Escrever o teste do helper (falha)**

Create `apps/web/src/lib/auto-promo.test.ts`:
```ts
import { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { tool } from "@emach/db/schema/tools";
import { describe, expect, it } from "vitest";
import {
	autoPromoToolIdsFromMap,
	fetchAutoPromosByToolId,
} from "./auto-promo";

const ROLLBACK = Symbol("rollback");
async function withRollback(fn: (tx: typeof db) => Promise<void>): Promise<void> {
	try {
		await db.transaction(async (tx) => {
			await fn(tx as unknown as typeof db);
			throw ROLLBACK;
		});
	} catch (err) {
		if (err !== ROLLBACK) throw err;
	}
}
async function seedTool(tx: typeof db): Promise<string> {
	const id = crypto.randomUUID();
	await tx.insert(tool).values({
		id, name: `Tool ${id}`,
		weightKg: "1.000", lengthCm: "10.00", widthCm: "10.00", heightCm: "10.00",
	});
	return id;
}

describe("auto-promo helper", () => {
	it("autoPromoToolIdsFromMap deriva o set dos toolIds com promo", () => {
		const map = new Map([
			["a", [{ discountType: "percent", discountValue: "10.00" }]],
			["b", []],
		]);
		const set = autoPromoToolIdsFromMap(map);
		expect(set.has("a")).toBe(true);
		expect(set.has("b")).toBe(false);
	});

	it("fetchAutoPromosByToolId pega promo específica vigente", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			const promoId = crypto.randomUUID();
			await tx.insert(promotion).values({
				id: promoId, title: "Auto", type: "promotion",
				discountType: "percent", discountValue: "15.00",
				appliesToAll: false, active: true,
			});
			await tx.insert(promotionTool).values({ promotionId: promoId, toolId });
			const map = await fetchAutoPromosByToolId(tx, [toolId], new Date());
			expect(map.get(toolId)?.length).toBe(1);
			expect(autoPromoToolIdsFromMap(map).has(toolId)).toBe(true);
		});
	});
});
```

- [ ] **Step 2: Rodar o teste (falha)**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/lib/auto-promo.test.ts`
Expected: FAIL — o módulo `./auto-promo` não existe.

- [ ] **Step 3: Criar `lib/auto-promo.ts`**

Conteúdo completo do novo arquivo:
```ts
import type { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

export interface AutoPromo {
	discountType: string;
	discountValue: string;
}

/**
 * Para cada tool, as promoções automáticas ativas/vigentes que a cobrem
 * (global via `applies_to_all` OU específica via `promotion_tool`).
 * Fonte única ecommerce-side da regra de elegibilidade. O SQL `LATERAL` em
 * packages/db/src/queries/catalog.ts aplica a MESMA regra na vitrine/PDP, mas
 * é owned-by-dashboard (nasce lá, chega via sync — ADR-0009); não unificar aqui.
 */
export async function fetchAutoPromosByToolId(
	tx: typeof db,
	toolIds: string[],
	now: Date
): Promise<Map<string, AutoPromo[]>> {
	const [globalRows, specificRows] = await Promise.all([
		tx
			.select({ discountType: promotion.discountType, discountValue: promotion.discountValue })
			.from(promotion)
			.where(
				and(
					eq(promotion.active, true),
					eq(promotion.type, "promotion"),
					eq(promotion.appliesToAll, true),
					or(isNull(promotion.startsAt), lte(promotion.startsAt, now)),
					or(isNull(promotion.endsAt), gt(promotion.endsAt, now))
				)
			),
		tx
			.select({
				toolId: promotionTool.toolId,
				discountType: promotion.discountType,
				discountValue: promotion.discountValue,
			})
			.from(promotion)
			.innerJoin(promotionTool, eq(promotionTool.promotionId, promotion.id))
			.where(
				and(
					eq(promotion.active, true),
					eq(promotion.type, "promotion"),
					inArray(promotionTool.toolId, toolIds),
					or(isNull(promotion.startsAt), lte(promotion.startsAt, now)),
					or(isNull(promotion.endsAt), gt(promotion.endsAt, now))
				)
			),
	]);

	const map = new Map<string, AutoPromo[]>();
	for (const toolId of toolIds) {
		map.set(
			toolId,
			globalRows.map((r) => ({ discountType: r.discountType, discountValue: r.discountValue }))
		);
	}
	for (const row of specificRows) {
		map.get(row.toolId)?.push({ discountType: row.discountType, discountValue: row.discountValue });
	}
	return map;
}

/** Set de toolIds com auto-promo vigente (preserva a semântica de exclusão do cupom). */
export function autoPromoToolIdsFromMap(map: Map<string, AutoPromo[]>): Set<string> {
	const set = new Set<string>();
	for (const [toolId, promos] of map) {
		if (promos.length > 0) {
			set.add(toolId);
		}
	}
	return set;
}
```

- [ ] **Step 4: Rodar o teste (passa)**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/lib/auto-promo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auto-promo.ts apps/web/src/lib/auto-promo.test.ts
git commit -m "feat: helper canonico de auto-promo (server-only) em lib/auto-promo (#57)"
```

---

## Task 4 (Unidade B.2): `validateCoupon` aceita set injetável

**Files:**
- Modify: `apps/web/src/lib/coupons/validate-coupon.ts` (remover `fetchAutoPromoToolIds` local; novo 4º param)
- Modify: `apps/web/src/lib/coupons/validate-coupon.test.ts` (+ teste do set injetado)

- [ ] **Step 1: Escrever o teste do set injetado (falha)**

Adicionar ao final do `describe("validateCoupon", ...)` em `validate-coupon.test.ts`:
```ts
it("usa o set injetado para excluir auto-promo sem re-consultar", async () => {
	await withRollback(async (tx) => {
		const toolId = await seedTool(tx);
		await seedPromotion(tx, "CUPOM", { discountValue: "10.00" });
		// Set injetado marca a tool como sob auto-promo → excluída da base.
		const result = await validateCoupon(
			tx,
			"CUPOM",
			[line(toolId, 10_000)],
			new Set([toolId])
		);
		expect(result).toEqual({
			ok: false,
			error: "Cupom não cobre nenhum item do carrinho",
		});
	});
});

it("set injetado vazio não exclui nada", async () => {
	await withRollback(async (tx) => {
		const toolId = await seedTool(tx);
		await seedPromotion(tx, "CUPOM", { discountValue: "10.00" });
		const result = await validateCoupon(tx, "CUPOM", [line(toolId, 10_000)], new Set());
		expect(result).toEqual(
			expect.objectContaining({ ok: true, discountCents: 1000 })
		);
	});
});
```

- [ ] **Step 2: Rodar (falha)**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/lib/coupons/validate-coupon.test.ts`
Expected: FAIL — `validateCoupon` ainda só aceita 3 args (4º ignorado → o teste do set injetado falha porque computa do DB e não acha auto-promo).

- [ ] **Step 3: Modificar `validate-coupon.ts`**

Remover a função `fetchAutoPromoToolIds` (linhas ~16-53) e seu uso. Adicionar import do helper canônico:
```ts
import { autoPromoToolIdsFromMap, fetchAutoPromosByToolId } from "@/lib/auto-promo";
```
Mudar a assinatura e o cálculo do set:
```ts
export async function validateCoupon(
	tx: typeof db,
	rawCode: string,
	lines: CouponLine[],
	autoPromoToolIds?: Set<string>
): Promise<CouponValidation> {
	// ... (lookup do promo, vigência, mínimo — inalterado) ...

	const toolIds = Array.from(new Set(lines.map((l) => l.toolId)));

	// escopo (inalterado) ...

	const autoPromoSet =
		autoPromoToolIds ??
		autoPromoToolIdsFromMap(await fetchAutoPromosByToolId(tx, toolIds, now));

	let eligibleSubtotalCents = 0;
	for (const line of lines) {
		const inScope = scopeToolIds === null || scopeToolIds.has(line.toolId);
		if (inScope && !autoPromoSet.has(line.toolId)) {
			eligibleSubtotalCents += line.basePriceCents * line.quantity;
		}
	}
	// ... (resto inalterado) ...
}
```
Conferir imports não usados após remover `fetchAutoPromoToolIds`: `promotion`/`promotionTool` ainda são usados (lookup do cupom + query de escopo); `inArray`, `and`, `eq`, `or`, `isNull`, `lte`, `gt`, `sql` — manter os que o escopo/lookup usam, remover os que sobrarem (o `tsc` acusa).

- [ ] **Step 4: Rodar (passa)**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/lib/coupons/validate-coupon.test.ts`
Expected: PASS — incluindo os testes antigos (que não injetam set → caminho de fallback computa do DB) e os dois novos.

- [ ] **Step 5: check-types**

Run: `cd apps/web && ./node_modules/.bin/tsc --noEmit`
Expected: sem erros, sem imports não usados.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/coupons/validate-coupon.ts apps/web/src/lib/coupons/validate-coupon.test.ts
git commit -m "feat: validateCoupon aceita set de auto-promo injetavel (#57)"
```

---

## Task 5 (Unidade B.3): `place-order` usa o helper e injeta o set

Elimina as queries redundantes (item 5): o `placeOrder` já computa o map de auto-promo no `prepareLines`; deriva o set dele e passa pro `validateCoupon`.

**Files:**
- Modify: `apps/web/src/app/checkout/_lib/place-order.ts` (remover fn local; `prepareLines` retorna o set; injetar)

- [ ] **Step 1: Remover a fn local e importar o helper**

Remover toda a função `fetchAutoPromosByToolId` local (linhas ~205-272). Manter o import de `effectiveAutoDiscountCents` de `@/lib/promotions` e adicionar o import do helper server-only:
```ts
import { effectiveAutoDiscountCents } from "@/lib/promotions";
import { autoPromoToolIdsFromMap, fetchAutoPromosByToolId } from "@/lib/auto-promo";
```
Remover os imports de `promotion`/`promotionTool`/operadores drizzle que só a fn removida usava — **conferir**: `promotion` ainda é usado (lock `FOR UPDATE`, update de `redemptionCount`); `promotionTool` deixa de ser usado aqui → remover. Operadores (`gt`, `isNull`, `lte`, `or`) que só a fn usava → remover; `and`, `eq`, `inArray`, `sql` seguem em uso. Deixar o `tsc` confirmar.

- [ ] **Step 2: `prepareLines` retorna `{ lines, autoPromoToolIds }`**

Mudar o tipo de retorno e o corpo:
```ts
async function prepareLines(
	tx: typeof db,
	input: CreateOrderInput
): Promise<{ lines: PreparedLine[]; autoPromoToolIds: Set<string> }> {
	// ... Promise.all já chama fetchAutoPromosByToolId(tx, toolIds, new Date()) → autoPromosByToolId
	// ... loop que monta `lines` (inalterado) ...
	return { lines, autoPromoToolIds: autoPromoToolIdsFromMap(autoPromosByToolId) };
}
```

- [ ] **Step 3: `placeOrder` consome o objeto e injeta o set**

```ts
const { lines, autoPromoToolIds } = await prepareLines(tx, input);
await checkAggregateStock(tx, lines);
// ...
const coupon = await validateCoupon(tx, input.couponCode, couponLines, autoPromoToolIds);
```

- [ ] **Step 4: check-types + testes de place-order**

Run: `cd apps/web && ./node_modules/.bin/tsc --noEmit`
Run: `cd apps/web && ./node_modules/.bin/vitest run src/app/checkout/_lib/place-order.test.ts src/app/checkout/_lib/place-order.shipping.test.ts`
Expected: PASS — comportamento de exclusão de auto-promo no cupom idêntico ao anterior.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/checkout/_lib/place-order.ts
git commit -m "perf: place-order injeta set de auto-promo no cupom, sem query redundante (#57)"
```

---

## Task 6 (Unidade C.1): `reconcilePrices` no cart-store + contexto

**Files:**
- Modify: `apps/web/src/lib/cart-store.ts`
- Create: `apps/web/src/lib/cart-store.test.ts`
- Modify: `apps/web/src/lib/cart-context.tsx`

- [ ] **Step 1: Escrever o teste de `reconcilePrices` (falha)**

Create `apps/web/src/lib/cart-store.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { type CartItem, reconcilePrices } from "./cart-store";

const item = (variantId: string, priceAmount: string): CartItem => ({
	variantId, priceAmount,
	toolId: "t", sku: "s", name: "n", slug: "sl", quantity: 1,
	categoryName: null, categorySlug: null, imageUrl: null, voltage: null,
});

describe("reconcilePrices", () => {
	it("atualiza o preço dos itens presentes no map", () => {
		const items = [item("v1", "100.00"), item("v2", "50.00")];
		const next = reconcilePrices(items, new Map([["v1", "85.00"]]));
		expect(next.find((i) => i.variantId === "v1")?.priceAmount).toBe("85.00");
		expect(next.find((i) => i.variantId === "v2")?.priceAmount).toBe("50.00");
	});

	it("retorna a MESMA referência quando nada muda (evita re-render)", () => {
		const items = [item("v1", "100.00")];
		const next = reconcilePrices(items, new Map([["v1", "100.00"]]));
		expect(next).toBe(items);
	});
});
```

- [ ] **Step 2: Rodar (falha)**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/lib/cart-store.test.ts`
Expected: FAIL — `reconcilePrices` não existe.

- [ ] **Step 3: Implementar `reconcilePrices` em `cart-store.ts`**

Adicionar ao final:
```ts
/**
 * Atualiza o `priceAmount` (snapshot) dos itens cujo `variantId` está em
 * `priceByVariantId`. Usado pela revalidação do checkout para alinhar o display
 * e o snapshot ao preço real atual antes do place-order. Retorna a MESMA
 * referência se nada mudou (evita re-render desnecessário no contexto).
 */
export function reconcilePrices(
	items: CartItem[],
	priceByVariantId: Map<string, string>
): CartItem[] {
	let changed = false;
	const next = items.map((i) => {
		const fresh = priceByVariantId.get(i.variantId);
		if (fresh != null && fresh !== i.priceAmount) {
			changed = true;
			return { ...i, priceAmount: fresh };
		}
		return i;
	});
	if (!changed) {
		return items;
	}
	saveCart(next);
	return next;
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/lib/cart-store.test.ts`
Expected: PASS (em `node`, `saveCart` cai no catch sem `localStorage` — o retorno não depende disso).

- [ ] **Step 5: Expor `reconcile` no `cart-context.tsx`**

Adicionar à interface `CartCtx`, ao default e ao provider:
```ts
import { /* ... */ reconcilePrices } from "@/lib/cart-store";

interface CartCtx {
	// ... existentes ...
	reconcile: (priceByVariantId: Map<string, string>) => void;
}

// no default do createContext:
reconcile: () => undefined,

// no componente:
const reconcile = useCallback((priceByVariantId: Map<string, string>) => {
	setItems((prev) => reconcilePrices(prev, priceByVariantId));
}, []);

// no value do Provider: { items, totalCount, add, setQty, remove, clear, reconcile }
```

- [ ] **Step 6: check-types**

Run: `cd apps/web && ./node_modules/.bin/tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/cart-store.ts apps/web/src/lib/cart-store.test.ts apps/web/src/lib/cart-context.tsx
git commit -m "feat: reconcilePrices no cart-store e contexto (#57)"
```

---

## Task 7 (Unidade C.2): Server action `revalidate-cart`

_Nota 2026-09-28: o schema real recebe só `toolId` e `variantId` (sem `quantity`) e o retorno de sucesso inclui `unavailable: string[]`; o mount em `checkout-content.tsx` remove do carrinho as variantes indisponíveis antes de reconciliar os preços._

**Files:**
- Create: `apps/web/src/app/checkout/_actions/revalidate-cart.ts`
- Create: `apps/web/src/app/checkout/_actions/revalidate-cart.test.ts`

- [ ] **Step 1: Escrever o teste de `computeFinalPrices` (falha)**

Create `apps/web/src/app/checkout/_actions/revalidate-cart.test.ts`:
```ts
import { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { tool, toolVariant } from "@emach/db/schema/tools";
import { describe, expect, it } from "vitest";
import { computeFinalPrices } from "./revalidate-cart";

const ROLLBACK = Symbol("rollback");
async function withRollback(fn: (tx: typeof db) => Promise<void>): Promise<void> {
	try {
		await db.transaction(async (tx) => {
			await fn(tx as unknown as typeof db);
			throw ROLLBACK;
		});
	} catch (err) {
		if (err !== ROLLBACK) throw err;
	}
}
async function seedToolWithVariant(
	tx: typeof db,
	price: string
): Promise<{ toolId: string; variantId: string }> {
	const toolId = crypto.randomUUID();
	const variantId = crypto.randomUUID();
	await tx.insert(tool).values({
		id: toolId, name: `Tool ${toolId}`,
		weightKg: "1.000", lengthCm: "10.00", widthCm: "10.00", heightCm: "10.00",
	});
	await tx.insert(toolVariant).values({
		id: variantId, toolId, sku: `SKU-${variantId}`, priceAmount: price,
	});
	return { toolId, variantId };
}

describe("computeFinalPrices", () => {
	it("retorna o preço base quando não há auto-promo", async () => {
		await withRollback(async (tx) => {
			const { toolId, variantId } = await seedToolWithVariant(tx, "349.90");
			const prices = await computeFinalPrices(tx, [{ toolId, variantId }]);
			expect(prices).toEqual([{ variantId, finalPriceCents: 34_990 }]);
		});
	});

	it("aplica a auto-promo vigente (menor preço)", async () => {
		await withRollback(async (tx) => {
			const { toolId, variantId } = await seedToolWithVariant(tx, "100.00");
			const promoId = crypto.randomUUID();
			await tx.insert(promotion).values({
				id: promoId, title: "Auto", type: "promotion",
				discountType: "percent", discountValue: "15.00",
				appliesToAll: false, active: true,
			});
			await tx.insert(promotionTool).values({ promotionId: promoId, toolId });
			const prices = await computeFinalPrices(tx, [{ toolId, variantId }]);
			expect(prices).toEqual([{ variantId, finalPriceCents: 8500 }]);
		});
	});
});
```
(Se o `toolVariant` exigir colunas NOT NULL além de `sku`/`priceAmount`, ajustar o seed conforme o schema — checar `packages/db/src/schema/tools.ts` antes.)

- [ ] **Step 2: Rodar (falha)**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/app/checkout/_actions/revalidate-cart.test.ts`
Expected: FAIL — módulo/`computeFinalPrices` não existe.

- [ ] **Step 3: Implementar `revalidate-cart.ts`**

```ts
"use server";

import { db } from "@emach/db";
import { toolVariant } from "@emach/db/schema/tools";
import { inArray } from "drizzle-orm";
import { z } from "zod";

import { fetchAutoPromosByToolId } from "@/lib/auto-promo";
import { log } from "@/lib/evlog";
import { numericToCents } from "@/lib/format";
import { effectiveAutoDiscountCents } from "@/lib/promotions";
import { requireCurrentClient } from "@/lib/session";

const schema = z.object({
	cartItems: z
		.array(z.object({ toolId: z.string().min(1), variantId: z.string().min(1) }))
		.min(1),
});

export interface RevalidatedPrice {
	finalPriceCents: number;
	variantId: string;
}

export type RevalidateCartResult =
	| { ok: true; prices: RevalidatedPrice[] }
	| { ok: false; error: string };

/**
 * Re-busca o preço real atual de cada variante e aplica a auto-promo vigente
 * (reusa o helper canônico de lib/promotions). Exportada à parte do action para
 * ser testável sem o guard de sessão.
 */
export async function computeFinalPrices(
	database: typeof db,
	items: Array<{ toolId: string; variantId: string }>
): Promise<RevalidatedPrice[]> {
	const variantIds = items.map((i) => i.variantId);
	const toolIds = Array.from(new Set(items.map((i) => i.toolId)));
	const [variants, autoPromos] = await Promise.all([
		database
			.select({
				id: toolVariant.id,
				toolId: toolVariant.toolId,
				priceAmount: toolVariant.priceAmount,
			})
			.from(toolVariant)
			.where(inArray(toolVariant.id, variantIds)),
		fetchAutoPromosByToolId(database, toolIds, new Date()),
	]);
	const byId = new Map(variants.map((v) => [v.id, v]));

	const prices: RevalidatedPrice[] = [];
	for (const item of items) {
		const variant = byId.get(item.variantId);
		if (!variant || variant.toolId !== item.toolId) {
			continue;
		}
		const base = numericToCents(variant.priceAmount);
		let final = base;
		for (const promo of autoPromos.get(item.toolId) ?? []) {
			const candidate = effectiveAutoDiscountCents(base, promo.discountType, promo.discountValue);
			if (candidate < final) {
				final = candidate;
			}
		}
		prices.push({ variantId: item.variantId, finalPriceCents: final });
	}
	return prices;
}

export async function revalidateCartAction(
	raw: z.infer<typeof schema>
): Promise<RevalidateCartResult> {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	await requireCurrentClient();
	try {
		const prices = await computeFinalPrices(db, parsed.data.cartItems);
		return { ok: true, prices };
	} catch (err) {
		log.error({
			action: "revalidate_cart_failed",
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return { ok: false, error: "Não foi possível atualizar os preços" };
	}
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/app/checkout/_actions/revalidate-cart.test.ts`
Expected: PASS.

- [ ] **Step 5: check-types**

Run: `cd apps/web && ./node_modules/.bin/tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/checkout/_actions/revalidate-cart.ts apps/web/src/app/checkout/_actions/revalidate-cart.test.ts
git commit -m "feat: server action revalidate-cart (#57)"
```

---

## Task 8 (Unidade C.3): Revalidar no mount + reconciliar + clamp no checkout

**Files:**
- Modify: `apps/web/src/app/checkout/_components/checkout-content.tsx`

- [ ] **Step 1: Importar o action e pegar `reconcile` do contexto**

```ts
import { revalidateCartAction } from "@/app/checkout/_actions/revalidate-cart";
// ...
const { items, clear, reconcile } = useCart();
```

- [ ] **Step 2: Revalidar uma vez no mount (guard com ref para não loopar)**

Adicionar abaixo dos refs existentes:
```ts
const revalidatedRef = useRef(false);
```
E um effect (o guard de `items.length === 0` roda ANTES de marcar o ref, para que ele dispare quando o carrinho terminar de carregar do `localStorage`):
```ts
useEffect(() => {
	if (revalidatedRef.current || items.length === 0) {
		return;
	}
	revalidatedRef.current = true;
	(async () => {
		const result = await revalidateCartAction({
			cartItems: items.map((i) => ({ toolId: i.toolId, variantId: i.variantId })),
		});
		if (result.ok) {
			const fresh = new Map(
				result.prices.map((p) => [p.variantId, (p.finalPriceCents / 100).toFixed(2)])
			);
			reconcile(fresh);
		}
	})();
}, [items, reconcile]);
```
> Nota: `reconcile` muda `items` quando há divergência → o effect re-roda, mas `revalidatedRef.current` já é `true` → retorna. Sem loop. O subtotal (`useMemo` com dep `items`) recalcula sozinho com os preços novos.

- [ ] **Step 3: Clamp no total exibido**

Trocar:
```ts
const total = subtotal - discount + shipping;
```
por:
```ts
const total = Math.max(0, subtotal - discount + shipping);
```

- [ ] **Step 4: check-types**

Run: `cd apps/web && ./node_modules/.bin/tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Smoke live (porta 3008 já está no ar)**

Cenário do repro do #57 (precisa de um item com auto-promo **expirada** no carrinho — usar um produto cujo snapshot no `localStorage` foi gravado sob promo já vencida; ou simular reduzindo a auto-promo no DB entre adicionar e abrir o checkout):
1. Adicionar ao carrinho um item cujo preço de catálogo atual difere do snapshot.
2. Abrir `/checkout` na tab pinada (tab 226475139).
3. Conferir no "Resumo do Pedido": o **subtotal** exibido bate com o preço real atual (não com o snapshot antigo).
4. Aplicar um cupom percentual: o **desconto** é coerente com o subtotal exibido.
5. Confirmar que o **Total** nunca fica negativo (testar cupom alto).
6. Submeter: não deve aparecer `"Preços atualizados, refaça o checkout"`.

Observar erros client no console via `read_console_messages` (onlyErrors) se algo quebrar; o log server é vigiado pelo Monitor.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/checkout/_components/checkout-content.tsx
git commit -m "fix: revalida precos do carrinho ao entrar no checkout + clamp no total (#57)"
```

---

## Task 9: Verificação final + Pull Request

- [ ] **Step 1: Suíte completa + types + lint**

Run: `cd apps/web && ./node_modules/.bin/vitest run`
Expected: toda a suíte verde (os 23 anteriores + os novos de promotions/cart-store/revalidate-cart/validate-coupon).
Run: `cd apps/web && ./node_modules/.bin/tsc --noEmit` → sem erros.
Run (na raiz): `bun run check` → sem erros de lint.

- [ ] **Step 2: Abrir o PR**

```bash
git push -u origin issues-abertos-1
gh pr create --title "feat: follow-ups do cupom no checkout (#57)" --body "$(cat <<'EOF'
Resolve os itens ecommerce-owned da #57 (2, 3, 5, 6). Itens cross-repo (1, 4) seguem num issue de handoff no dashboard, referenciado abaixo.

## O que mudou
- **Item 6:** conversor único `numericToCents`, `fmtNumericBRL`, tipo compartilhado do cart-item do cupom.
- **Itens 3+5:** regra de auto-promo centralizada em `lib/promotions.ts` (`fetchAutoPromosByToolId` + `autoPromoToolIdsFromMap`); `validateCoupon` aceita o set já computado pelo `placeOrder` → elimina 1-2 queries redundantes por resgate.
- **Item 2:** server action `revalidateCartAction` revalida preços ao entrar no checkout; reconcilia display + snapshot do `localStorage` silenciosamente; clamp `Math.max(0, total)`.

## Verificação
- check-types ✅ · lint ✅ · vitest (suíte completa, incl. novos testes de integração) ✅
- Smoke live `/checkout` (porta 3008): subtotal/desconto/total coerentes com o preço real; total nunca negativo; submit sem "Preços atualizados".

## Follow-up cross-repo
Issue de handoff no emach-dashboard (itens 1 e 4): commit de `order.coupon_id` e semântica de `order.discountAmount`.

Closes #57
EOF
)"
```
> Após criar, anotar a URL/número do PR — é citada no issue de handoff (Task 10).

---

## Task 10 (Fase final): Issue de handoff no `emach-dashboard`

**Só depois do PR aberto.** Usar a skill `handoff` para estruturar o conteúdo e abrir um issue no repo `othavioquiliao/emach-dashboard` (via `mcp__plugin_github_github__issue_write` ou `gh issue create -R othavioquiliao/emach-dashboard`).

- [ ] **Step 1: Gerar o conteúdo do handoff**

Invocar a skill `handoff` para compor o corpo, cobrindo:
- **Contexto:** cita a nossa issue **#57** e o **PR** recém-aberto (com URL); explica que cupom e auto-promo compartilham a tabela `promotion` e que o ecommerce já consome `order.coupon_id`.
- **Item 1 (imediato/crítico — como fazer):** commitar em `packages/db/src/schema/orders.ts` do dashboard, após `discountAmount`:
  ```ts
  couponId: text("coupon_id").references(() => promotion.id, { onDelete: "set null" }),
  ```
  Porquê: a coluna já existe no DB compartilhado (aplicada via `db:push`), mas a edição está sem commit no dashboard. Sem o commit, `db:check-drift` acusa drift e um `db:push` de lá **dropa** a coluna.
- **Item 4 (semântica — o que documentar):** `order.discountAmount` captura **só o cupom**; a economia da auto-promo já está embutida no `subtotalAmount` (snapshot de preço por item). Relatórios de margem/desconto que lerem `discountAmount` como "desconto total" subcontam. Se precisar do total concedido, derivar comparando `order_item.unit_price` com o preço de catálogo na data.

- [ ] **Step 2: Abrir o issue**

```bash
gh issue create -R othavioquiliao/emach-dashboard \
  --title "Espelhar order.coupon_id + documentar semântica de order.discountAmount (follow-up ecommerce #57)" \
  --body "<conteúdo gerado no Step 1>"
```

- [ ] **Step 3: Cruzar referência**

Comentar na nossa #57 (e/ou no PR) com o link do issue do dashboard, fechando o loop cross-repo.

---

## Self-Review (preenchido pelo autor do plano)

**Cobertura do spec:**
- Item 6 → Tasks 1, 2. ✅
- Itens 3+5 → Tasks 3, 4, 5. ✅
- Item 2 → Tasks 6, 7, 8. ✅
- Itens 1, 4 → Task 10 (handoff). ✅
- "catalog.ts não tocado" → documentado no comentário do helper (Task 3 Step 3), nenhuma edição em `catalog.ts`. ✅

**Consistência de tipos/nomes:** `numericToCents`, `fmtNumericBRL`, `AutoPromo`, `fetchAutoPromosByToolId`, `autoPromoToolIdsFromMap`, `reconcilePrices`, `reconcile`, `computeFinalPrices`, `revalidateCartAction`, `RevalidatedPrice` — usados de forma idêntica entre as tasks que os definem e as que os consomem. ✅

**Sem placeholders:** todo step com mudança de código mostra o código. ✅

---

## Riscos e brechas revisados (revisão adversarial)

Pontos que poderiam dar problema e como o plano os trata:

1. **[Resolvido — era a brecha mais séria] `db` vazando pro client bundle.**
   `lib/promotions.ts` é importado por `product-info.tsx` (`"use client"`). Estender
   esse arquivo com a query de auto-promo (que importa `db`/drizzle) quebraria o
   build / vazaria o driver pro cliente. → A query foi isolada num módulo
   **server-only** `lib/auto-promo.ts` (Task 3); `promotions.ts` fica puro.

2. **[Mitigado] Loop infinito no effect de revalidação (Task 8).** `reconcile`
   altera `items` → o effect tem `items` na dep array → re-roda. Guarda com
   `revalidatedRef` (marcado **depois** do early-return de carrinho vazio) garante
   uma única execução; o re-run subsequente sai pelo ref. Sem loop.

3. **[Aceito] Falha da revalidação degrada pro comportamento de hoje.** Se
   `revalidateCartAction` retornar `{ ok: false }` (DB indisponível), o snapshot
   não é reconciliado e o `place-order` ainda barra no submit com "Preços
   atualizados, refaça o checkout". Não piora o estado atual; só não conserta o
   display naquele caso raro. Sem fallback silencioso enganoso.

4. **[Verificado] Semântica do set derivado === regra antiga.** `autoPromoToolIdsFromMap`
   marca tool com `promos.length > 0`. `fetchAutoPromosByToolId` preenche todo
   toolId com `globalRows` (logo, promo global → todos no set) e empurra os
   específicos — idêntico ao antigo `fetchAutoPromoToolIds` (global → `new Set(todos)`;
   senão os específicos). Coberto pelos testes "set injetado" + os de exclusão
   existentes (Task 4).

5. **[Verificado] Seed de `toolVariant` no teste (Task 7).** Colunas obrigatórias
   sem default: `id`, `toolId`, `sku`, `priceAmount`. O seed do plano preenche
   exatamente essas (`voltage`/`costAmount` nullable; `isDefault`/`sortOrder`/
   timestamps com default). Não quebra por NOT NULL.

6. **[Atenção na execução] Imports órfãos pós-remoção.** Tasks 4 e 5 removem funções
   e devem limpar imports drizzle que ficam sem uso. O `tsc --noEmit` (passo de cada
   task) acusa — não é silencioso, mas o executor precisa de fato remover, não ignorar.

7. **[Fora de escopo, consciente] Discount do cupom vs revalidação.** O `discountCents`
   do cupom é sempre calculado server-side (`apply-coupon` re-busca preço real), então
   já é coerente com o preço fresco; a revalidação só conserta o **subtotal exibido**.
   Não há recálculo de cupom a fazer no client.
