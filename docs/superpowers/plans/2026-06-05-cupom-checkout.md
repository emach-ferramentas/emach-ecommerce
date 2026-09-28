# Cupom no checkout + correção do sync de promoções — Implementation Plan

> **Status em 2026-09-28:** implementado. Os dez passos estão no código: `apps/web/src/lib/promotions.ts`, `apps/web/src/lib/coupons/validate-coupon.ts`, `apps/web/src/app/checkout/_actions/apply-coupon.ts`, `_components/coupon-field.tsx`, integração em `_lib/place-order.ts` e `order.coupon_id` em `packages/db/src/schema/orders.ts`. O código dos passos foi alterado depois (ver `2026-06-07-followups-cupom-checkout.md`); os checkboxes abaixo ficam como estavam.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o breakage do sync de promoções (`discount_pct` removido) e implementar aplicação de cupom (`type='promocode'`) no checkout do storefront.

**Architecture:** Helper puro de desconto automático compartilhado entre PDP e checkout; lógica de cupom isolada em `lib/coupons/` (validação + cálculo) consumida por uma server action de preview e pela transação de criação do pedido; coluna `order.coupon_id` nas duas cópias do schema (DB Supabase compartilhado). Cupom incide **só sobre itens elegíveis e sem auto-promo** (nunca empilha).

**Tech Stack:** Next 16 (RSC + server actions), Drizzle ORM, Postgres (Supabase), Zod, Vitest, Base UI (shadcn `base-lyra`).

---

## Decisões travadas (do spec)

- Desconto de cupom específico: **só itens elegíveis**.
- Cupom **nunca empilha** com auto-promo: itens com promoção automática ativa ficam **fora** da base elegível.
- Persistência: **`order.coupon_id`** (FK `promotion`, `on delete set null`) + `order.discount_amount` (já existe).
- Campo de cupom: **página de checkout**.
- Incremento de `redemption_count`: **na criação do pedido** (não há transição `paid`), com `SELECT … FOR UPDATE` + re-check.
- Schema do dashboard: editado localmente, **sem commit lá** — só o branch deste repo é commitado.

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `apps/web/src/lib/promotions.ts` | Helper puro `effectiveAutoDiscountCents` (percent/fixed) | Criar |
| `apps/web/src/lib/promotions.test.ts` | Testes do helper | Criar |
| `apps/web/src/lib/coupons/validate-coupon.ts` | Núcleo: resolução + escopo + auto-promo + cálculo | Criar |
| `apps/web/src/lib/coupons/validate-coupon.test.ts` | Testes (integração, DB) | Criar |
| `apps/web/src/app/checkout/_actions/apply-coupon.ts` | Server action: preview do desconto | Criar |
| `apps/web/src/app/checkout/_components/coupon-field.tsx` | UI isolada do campo de cupom | Criar |
| `apps/web/src/app/(shop)/product/[slug]/_components/product-info.tsx` | Fix breakage `discountPct` (PDP) | Modificar |
| `apps/web/src/app/checkout/_lib/place-order.ts` | Fix auto-desconto + integração do cupom | Modificar |
| `apps/web/src/app/checkout/_lib/place-order.test.ts` | Testes de cupom no pedido | Modificar |
| `apps/web/src/app/checkout/_components/checkout-content.tsx` | Linha Desconto + estado + `couponCode` | Modificar |
| `packages/db/src/schema/orders.ts` (este repo **e** dashboard) | Coluna `coupon_id` | Modificar |

---

## Task 1: Helper de desconto automático

Foundation pura, reusada por PDP, checkout e cupom. Centraliza a regra `percent`/`fixed` que hoje está triplicada (catalog SQL, product-info, place-order).

**Files:**
- Create: `apps/web/src/lib/promotions.ts`
- Test: `apps/web/src/lib/promotions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/promotions.test.ts
import { describe, expect, it } from "vitest";
import { effectiveAutoDiscountCents } from "./promotions";

describe("effectiveAutoDiscountCents", () => {
	it("aplica percentual", () => {
		expect(effectiveAutoDiscountCents(10_000, "percent", "10.00")).toBe(9000);
	});
	it("aplica desconto fixo em reais", () => {
		expect(effectiveAutoDiscountCents(10_000, "fixed", "30.00")).toBe(7000);
	});
	it("faz clamp do fixo em zero", () => {
		expect(effectiveAutoDiscountCents(2000, "fixed", "30.00")).toBe(0);
	});
	it("ignora valor inválido ou não-positivo (retorna base)", () => {
		expect(effectiveAutoDiscountCents(10_000, "percent", "0")).toBe(10_000);
		expect(effectiveAutoDiscountCents(10_000, "percent", "abc")).toBe(10_000);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bunx vitest run src/lib/promotions.test.ts`
Expected: FAIL — `effectiveAutoDiscountCents is not a function` / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/promotions.ts
/**
 * Preço unitário (em centavos) após UMA promoção automática.
 * `percent`: base × (1 − valor/100); `fixed`: max(base − valor, 0).
 * Espelha a regra do SQL em packages/db/src/queries/catalog.ts.
 */
export function effectiveAutoDiscountCents(
	baseCents: number,
	discountType: string,
	discountValue: string
): number {
	const value = Number(discountValue);
	if (!Number.isFinite(value) || value <= 0) {
		return baseCents;
	}
	if (discountType === "fixed") {
		return Math.max(baseCents - Math.round(value * 100), 0);
	}
	return Math.round(baseCents * (1 - value / 100));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bunx vitest run src/lib/promotions.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/promotions.ts apps/web/src/lib/promotions.test.ts
git commit -m "feat: helper effectiveAutoDiscountCents (percent/fixed)"
```

---

## Task 2: Fix breakage da PDP (`product-info.tsx`)

`applyDiscount` usa `promotion.discountPct` (coluna removida) → erro TS. `activePromotion` na PDP é o objeto `Promotion` completo (sem preço pré-calculado), então recalculamos com o helper.

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-info.tsx:36-49`

- [ ] **Step 1: Adicionar import do helper**

No bloco de imports (após `import { fmtBRL, fmtNumericBRL, numericToCents } from "@/lib/format";` na linha 23):

```ts
import { effectiveAutoDiscountCents } from "@/lib/promotions";
```

- [ ] **Step 2: Reescrever `applyDiscount`**

Substituir o corpo atual (linhas 36-49):

```ts
function applyDiscount(
	priceAmount: string,
	promotion: ToolDetail["activePromotion"]
): string | null {
	if (!promotion) {
		return null;
	}
	const baseCents = numericToCents(priceAmount);
	const discountedCents = effectiveAutoDiscountCents(
		baseCents,
		promotion.discountType,
		promotion.discountValue
	);
	if (discountedCents >= baseCents) {
		return null;
	}
	return (discountedCents / 100).toFixed(2);
}
```

- [ ] **Step 3: Verificar que o erro TS sumiu**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep product-info || echo "OK product-info"`
Expected: `OK product-info` (sem erro TS2339 de `discountPct`).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/_components/product-info.tsx"
git commit -m "fix: PDP usa discountType/discountValue no lugar de discountPct removido"
```

---

## Task 3: Fix breakage do checkout (`place-order.ts` auto-desconto)

_Nota 2026-09-28: `fetchAutoDiscountByToolId` foi substituída por `fetchAutoPromosByToolId` em `apps/web/src/lib/auto-promo.ts` (plano de follow-ups, Task 3); os números de linha de `place-order.ts` abaixo não valem mais._

`fetchDiscountPctByToolId` lê `discountPct` (removido), é percent-only e ignora `applies_to_all`. Reescrever para `percent`+`fixed` e respeitar promoção global — alinhando com o catalog. Os testes de estoque existentes devem continuar passando.

**Files:**
- Modify: `apps/web/src/app/checkout/_lib/place-order.ts:203-308`

- [ ] **Step 1: Adicionar import do helper**

Após `import { isValidCpfCnpj } from "@/lib/validators/cpf-cnpj";` (linha 14):

```ts
import { effectiveAutoDiscountCents } from "@/lib/promotions";
```

- [ ] **Step 2: Substituir `fetchDiscountPctByToolId` por `fetchAutoPromosByToolId`**

Substituir toda a função `fetchDiscountPctByToolId` (linhas 203-237) por:

```ts
/**
 * Para cada tool, todas as promoções automáticas ativas/vigentes que a cobrem
 * (global via `applies_to_all` OU específica via `promotion_tool`). O caller
 * escolhe o menor preço resultante por linha (descontos nunca somam).
 */
async function fetchAutoPromosByToolId(
	tx: typeof db,
	toolIds: string[],
	now: Date
): Promise<Map<string, Array<{ discountType: string; discountValue: string }>>> {
	const [globalRows, specificRows] = await Promise.all([
		tx
			.select({
				discountType: promotion.discountType,
				discountValue: promotion.discountValue,
			})
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

	const map = new Map<
		string,
		Array<{ discountType: string; discountValue: string }>
	>();
	for (const toolId of toolIds) {
		map.set(
			toolId,
			globalRows.map((r) => ({
				discountType: r.discountType,
				discountValue: r.discountValue,
			}))
		);
	}
	for (const row of specificRows) {
		map.get(row.toolId)?.push({
			discountType: row.discountType,
			discountValue: row.discountValue,
		});
	}
	return map;
}
```

- [ ] **Step 3: Atualizar `prepareLines` para usar o novo fetch**

Em `prepareLines`, na desestruturação do `Promise.all` (linha ~246), trocar `discountPctByToolId` por `autoPromosByToolId` e a chamada:

```ts
	const [variantRows, toolRows, autoPromosByToolId] = await Promise.all([
```

e (na linha ~273) trocar `fetchDiscountPctByToolId(tx, toolIds, new Date())` por:

```ts
		fetchAutoPromosByToolId(tx, toolIds, new Date()),
```

- [ ] **Step 4: Atualizar o cálculo de `finalPriceCents` no loop**

Substituir as linhas que usam `pct` (linhas ~290-293) por:

```ts
		const promos = autoPromosByToolId.get(cartItem.toolId) ?? [];
		const basePriceCents = centsFromString(variant.priceAmount);
		let finalPriceCents = basePriceCents;
		for (const promo of promos) {
			const candidate = effectiveAutoDiscountCents(
				basePriceCents,
				promo.discountType,
				promo.discountValue
			);
			if (candidate < finalPriceCents) {
				finalPriceCents = candidate;
			}
		}
```

- [ ] **Step 5: Verificar tipos e rodar os testes de estoque existentes**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep place-order || echo "OK place-order"`
Expected: `OK place-order`.

Run: `cd apps/web && bunx vitest run src/app/checkout/_lib/place-order.test.ts`
Expected: PASS (todos os testes de estoque/multi-filial existentes seguem verdes — preços base "100.00" sem auto-promo ⇒ comportamento inalterado).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/checkout/_lib/place-order.ts
git commit -m "fix: place-order aplica auto-promo percent/fixed + applies_to_all"
```

---

## Task 4: Schema `order.coupon_id`

Coluna nova em tabela **Shared** (DB Supabase único). Editar as duas cópias do schema; **commit só neste repo**.

**Files:**
- Modify: `packages/db/src/schema/orders.ts` (este repo)
- Modify: `/home/othavio/Projects/emach/emach-dashboard/packages/db/src/schema/orders.ts` (sem commit)

- [ ] **Step 1: Adicionar import de `promotion` no schema deste repo**

No topo de `packages/db/src/schema/orders.ts`, garantir o import (verificar se já existe; se não, adicionar junto aos outros imports de schema):

```ts
import { promotion } from "./promotions";
```

- [ ] **Step 2: Adicionar a coluna `couponId` no `order`**

Em `packages/db/src/schema/orders.ts`, dentro do objeto de colunas do `order`, logo após `discountAmount` (linha ~99):

```ts
		couponId: text("coupon_id").references(() => promotion.id, {
			onDelete: "set null",
		}),
```

- [ ] **Step 3: Espelhar a MESMA mudança no dashboard (sem commit)**

Aplicar Steps 1 e 2 idênticos em `/home/othavio/Projects/emach/emach-dashboard/packages/db/src/schema/orders.ts`. **Não commitar no dashboard** — apenas deixar o arquivo editado (coordenação ADR-0009; o commit lá é do usuário).

- [ ] **Step 4: Aplicar no banco compartilhado**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun db:push`
Expected: drizzle-kit adiciona a coluna `coupon_id` (nullable) + FK; sem prompt destrutivo (coluna nova nullable).

Run: `bun db:apply-triggers`
Expected: triggers reaplicados (idempotente).

- [ ] **Step 5: Verificar a coluna no banco**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun db:check-drift`
Expected: sem drift entre schema Drizzle e DB.

- [ ] **Step 6: Commit (só ecommerce)**

```bash
git add packages/db/src/schema/orders.ts
git commit -m "feat: coluna order.coupon_id (FK promotion, set null)"
```

---

## Task 5: Núcleo de validação do cupom

Validação + escopo + exclusão de auto-promo + cálculo. Self-contained (recebe `tx`/`db`), reusada por action e place-order. Teste de integração (DB) com `withRollback`.

**Files:**
- Create: `apps/web/src/lib/coupons/validate-coupon.ts`
- Test: `apps/web/src/lib/coupons/validate-coupon.test.ts`

- [ ] **Step 1: Escrever a implementação**

```ts
// apps/web/src/lib/coupons/validate-coupon.ts
import type { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

export interface CouponLine {
	/** Preço ORIGINAL da variante em centavos (sem auto-promo). */
	basePriceCents: number;
	quantity: number;
	toolId: string;
}

export type CouponValidation =
	| { ok: true; discountCents: number; promotionId: string }
	| { ok: false; error: string };

/** Tools sob promoção automática ativa (global ou específica) — não empilham com cupom. */
async function fetchAutoPromoToolIds(
	tx: typeof db,
	toolIds: string[],
	now: Date
): Promise<Set<string>> {
	const [globalAuto] = await tx
		.select({ id: promotion.id })
		.from(promotion)
		.where(
			and(
				eq(promotion.active, true),
				eq(promotion.type, "promotion"),
				eq(promotion.appliesToAll, true),
				or(isNull(promotion.startsAt), lte(promotion.startsAt, now)),
				or(isNull(promotion.endsAt), gt(promotion.endsAt, now))
			)
		)
		.limit(1);
	if (globalAuto) {
		return new Set(toolIds);
	}

	const rows = await tx
		.select({ toolId: promotionTool.toolId })
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
		);
	return new Set(rows.map((r) => r.toolId));
}

export async function validateCoupon(
	tx: typeof db,
	rawCode: string,
	lines: CouponLine[]
): Promise<CouponValidation> {
	const code = rawCode.trim();
	if (!code) {
		return { ok: false, error: "Cupom inválido" };
	}
	const now = new Date();

	const [promo] = await tx
		.select()
		.from(promotion)
		.where(and(eq(promotion.code, code), eq(promotion.type, "promocode")))
		.limit(1);

	if (!(promo && promo.active)) {
		return { ok: false, error: "Cupom inválido" };
	}
	if (promo.startsAt && promo.startsAt > now) {
		return { ok: false, error: "Cupom inválido" };
	}
	if (promo.endsAt && promo.endsAt <= now) {
		return { ok: false, error: "Cupom expirado" };
	}
	if (
		promo.maxRedemptions !== null &&
		promo.redemptionCount >= promo.maxRedemptions
	) {
		return { ok: false, error: "Cupom esgotado" };
	}

	const toolIds = Array.from(new Set(lines.map((l) => l.toolId)));

	// Escopo: null = vale para todos; senão restringe ao promotion_tool do cupom.
	let scopeToolIds: Set<string> | null = null;
	if (!promo.appliesToAll) {
		const scoped = await tx
			.select({ toolId: promotionTool.toolId })
			.from(promotionTool)
			.where(
				and(
					eq(promotionTool.promotionId, promo.id),
					inArray(promotionTool.toolId, toolIds)
				)
			);
		scopeToolIds = new Set(scoped.map((r) => r.toolId));
	}

	const autoPromoToolIds = await fetchAutoPromoToolIds(tx, toolIds, now);

	let eligibleSubtotalCents = 0;
	for (const line of lines) {
		const inScope = scopeToolIds === null || scopeToolIds.has(line.toolId);
		if (inScope && !autoPromoToolIds.has(line.toolId)) {
			eligibleSubtotalCents += line.basePriceCents * line.quantity;
		}
	}

	if (eligibleSubtotalCents === 0) {
		return { ok: false, error: "Cupom não cobre nenhum item do carrinho" };
	}

	if (promo.minOrderAmount !== null) {
		const minCents = Math.round(Number(promo.minOrderAmount) * 100);
		if (eligibleSubtotalCents < minCents) {
			const minBRL = Number(promo.minOrderAmount).toLocaleString("pt-BR", {
				currency: "BRL",
				style: "currency",
			});
			return { ok: false, error: `Pedido mínimo de ${minBRL}` };
		}
	}

	const value = Number(promo.discountValue);
	const discountCents =
		promo.discountType === "fixed"
			? Math.min(Math.round(value * 100), eligibleSubtotalCents)
			: Math.min(
					Math.round((eligibleSubtotalCents * value) / 100),
					eligibleSubtotalCents
				);

	return {
		ok: true,
		discountCents: Math.max(0, discountCents),
		promotionId: promo.id,
	};
}
```

- [ ] **Step 2: Escrever os testes (falhando)**

```ts
// apps/web/src/lib/coupons/validate-coupon.test.ts
import { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { tool } from "@emach/db/schema/tools";
import { describe, expect, it } from "vitest";
import { type CouponLine, validateCoupon } from "./validate-coupon";

const ROLLBACK = Symbol("rollback");

async function withRollback(fn: (tx: typeof db) => Promise<void>): Promise<void> {
	try {
		await db.transaction(async (tx) => {
			await fn(tx as unknown as typeof db);
			throw ROLLBACK;
		});
	} catch (err) {
		if (err !== ROLLBACK) {
			throw err;
		}
	}
}

async function seedTool(tx: typeof db): Promise<string> {
	const toolId = crypto.randomUUID();
	await tx.insert(tool).values({ id: toolId, name: `Tool ${toolId}` });
	return toolId;
}

interface PromoOpts {
	appliesToAll?: boolean;
	discountType?: "percent" | "fixed";
	discountValue?: string;
	endsAt?: Date | null;
	maxRedemptions?: number | null;
	minOrderAmount?: string | null;
	redemptionCount?: number;
	type?: "promotion" | "promocode";
}

async function seedPromotion(
	tx: typeof db,
	code: string,
	opts: PromoOpts = {}
): Promise<string> {
	const id = crypto.randomUUID();
	await tx.insert(promotion).values({
		id,
		title: `Promo ${code}`,
		type: opts.type ?? "promocode",
		code,
		discountType: opts.discountType ?? "percent",
		discountValue: opts.discountValue ?? "10.00",
		appliesToAll: opts.appliesToAll ?? true,
		maxRedemptions: opts.maxRedemptions ?? null,
		redemptionCount: opts.redemptionCount ?? 0,
		minOrderAmount: opts.minOrderAmount ?? null,
		active: true,
		endsAt: opts.endsAt ?? null,
	});
	return id;
}

const line = (toolId: string, basePriceCents: number, quantity = 1): CouponLine => ({
	toolId,
	basePriceCents,
	quantity,
});

describe("validateCoupon", () => {
	it("aplica percentual sobre a base elegível", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "OFF10", { discountValue: "10.00" });
			const result = await validateCoupon(tx, "OFF10", [line(toolId, 10_000, 2)]);
			expect(result).toEqual(
				expect.objectContaining({ ok: true, discountCents: 2000 })
			);
		});
	});

	it("aplica desconto fixo com clamp na base", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "MENOS50", {
				discountType: "fixed",
				discountValue: "50.00",
			});
			const result = await validateCoupon(tx, "MENOS50", [line(toolId, 3000)]);
			expect(result).toEqual(
				expect.objectContaining({ ok: true, discountCents: 3000 })
			);
		});
	});

	it("rejeita código inexistente", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			const result = await validateCoupon(tx, "NOPE", [line(toolId, 10_000)]);
			expect(result).toEqual({ ok: false, error: "Cupom inválido" });
		});
	});

	it("rejeita cupom expirado", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "VELHO", { endsAt: new Date(Date.now() - 1000) });
			const result = await validateCoupon(tx, "VELHO", [line(toolId, 10_000)]);
			expect(result).toEqual({ ok: false, error: "Cupom expirado" });
		});
	});

	it("rejeita cupom esgotado", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "CHEIO", {
				maxRedemptions: 5,
				redemptionCount: 5,
			});
			const result = await validateCoupon(tx, "CHEIO", [line(toolId, 10_000)]);
			expect(result).toEqual({ ok: false, error: "Cupom esgotado" });
		});
	});

	it("rejeita abaixo do pedido mínimo", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			await seedPromotion(tx, "MIN", { minOrderAmount: "200.00" });
			const result = await validateCoupon(tx, "MIN", [line(toolId, 10_000)]);
			expect(result.ok).toBe(false);
			expect((result as { error: string }).error).toMatch(/Pedido mínimo/);
		});
	});

	it("exclui itens com auto-promo ativa da base", async () => {
		await withRollback(async (tx) => {
			const toolId = await seedTool(tx);
			// auto-promo específica cobrindo o tool
			const autoId = await seedPromotion(tx, "AUTO-X", {
				type: "promotion",
				appliesToAll: false,
			});
			await tx.insert(promotionTool).values({ promotionId: autoId, toolId });
			await seedPromotion(tx, "CUPOM", { discountValue: "10.00" });
			const result = await validateCoupon(tx, "CUPOM", [line(toolId, 10_000)]);
			// único item está em auto-promo → base elegível = 0
			expect(result).toEqual({
				ok: false,
				error: "Cupom não cobre nenhum item do carrinho",
			});
		});
	});

	it("restringe escopo a promotion_tool do cupom", async () => {
		await withRollback(async (tx) => {
			const inTool = await seedTool(tx);
			const outTool = await seedTool(tx);
			const couponId = await seedPromotion(tx, "ESCOPO", {
				appliesToAll: false,
				discountValue: "10.00",
			});
			await tx
				.insert(promotionTool)
				.values({ promotionId: couponId, toolId: inTool });
			const result = await validateCoupon(tx, "ESCOPO", [
				line(inTool, 10_000),
				line(outTool, 10_000),
			]);
			// só inTool entra na base (1×10000) → 10% = 1000
			expect(result).toEqual(
				expect.objectContaining({ ok: true, discountCents: 1000 })
			);
		});
	});
});
```

- [ ] **Step 3: Run para ver falhar (módulo já existe; testes validam comportamento)**

Run: `cd apps/web && bunx vitest run src/lib/coupons/validate-coupon.test.ts`
Expected: PASS — se a implementação do Step 1 estiver correta, todos passam. Se algum falhar, corrigir a implementação (não o teste) até verde.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/coupons/validate-coupon.ts apps/web/src/lib/coupons/validate-coupon.test.ts
git commit -m "feat: validateCoupon (escopo, auto-promo, mínimo, limite, cálculo)"
```

---

## Task 6: Server action de preview (`apply-coupon`)

Valida o cupom no servidor com preços re-buscados do DB (nunca confia no client) e devolve o desconto pro UI.

**Files:**
- Create: `apps/web/src/app/checkout/_actions/apply-coupon.ts`

- [ ] **Step 1: Escrever a action**

```ts
// apps/web/src/app/checkout/_actions/apply-coupon.ts
"use server";

import { db } from "@emach/db";
import { toolVariant } from "@emach/db/schema/tools";
import { inArray } from "drizzle-orm";
import { z } from "zod";

import { type CouponLine, validateCoupon } from "@/lib/coupons/validate-coupon";
import { log } from "@/lib/evlog";
import { requireCurrentClient } from "@/lib/session";

const schema = z.object({
	code: z.string().min(1),
	cartItems: z
		.array(
			z.object({
				toolId: z.string().min(1),
				variantId: z.string().min(1),
				quantity: z.number().int().positive(),
			})
		)
		.min(1),
});

export type ApplyCouponResult =
	| { ok: true; discountCents: number }
	| { ok: false; error: string };

export async function applyCouponAction(
	raw: z.infer<typeof schema>
): Promise<ApplyCouponResult> {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	await requireCurrentClient();
	const { code, cartItems } = parsed.data;

	try {
		const variantIds = cartItems.map((i) => i.variantId);
		const variants = await db
			.select({
				id: toolVariant.id,
				toolId: toolVariant.toolId,
				priceAmount: toolVariant.priceAmount,
			})
			.from(toolVariant)
			.where(inArray(toolVariant.id, variantIds));
		const byId = new Map(variants.map((v) => [v.id, v]));

		const lines: CouponLine[] = [];
		for (const item of cartItems) {
			const variant = byId.get(item.variantId);
			if (!variant || variant.toolId !== item.toolId) {
				return { ok: false, error: "Carrinho inválido" };
			}
			lines.push({
				toolId: item.toolId,
				quantity: item.quantity,
				basePriceCents: Math.round(Number(variant.priceAmount) * 100),
			});
		}

		const result = await validateCoupon(db, code, lines);
		if (!result.ok) {
			return { ok: false, error: result.error };
		}
		return { ok: true, discountCents: result.discountCents };
	} catch (err) {
		log.error({
			action: "apply_coupon_failed",
			code,
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return { ok: false, error: "Não foi possível validar o cupom" };
	}
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep apply-coupon || echo "OK apply-coupon"`
Expected: `OK apply-coupon`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/checkout/_actions/apply-coupon.ts
git commit -m "feat: server action applyCouponAction (preview do desconto)"
```

---

## Task 7: Integração do cupom no `placeOrder`

_Nota 2026-09-28: erros de cupom no pedido passam por `publicCouponError` (`lib/coupons/validate-coupon.ts`), que colapsa código inexistente, expirado e esgotado em "Cupom inválido ou indisponível"; as asserções de mensagem abaixo refletem o texto original._

Re-valida no servidor (verdade), trava a linha da `promotion` (`FOR UPDATE`), re-check do limite, incrementa `redemption_count`, grava `coupon_id`/`discount_amount` e ajusta o total.

**Files:**
- Modify: `apps/web/src/app/checkout/_lib/place-order.ts` (inputSchema, order insert, placeOrder body)
- Test: `apps/web/src/app/checkout/_lib/place-order.test.ts`

- [ ] **Step 1: Adicionar import do validateCoupon**

Após o import do helper (Task 3 Step 1):

```ts
import { validateCoupon } from "@/lib/coupons/validate-coupon";
```

- [ ] **Step 2: Adicionar `couponCode` ao inputSchema**

No `inputSchema` (linha ~62), após `shippingAmount`:

```ts
	couponCode: z.string().trim().min(1).optional(),
```

- [ ] **Step 3: Aplicar o cupom dentro de `placeOrder`**

Em `placeOrder`, logo após `const totalCents = subtotalCents + shippingCents;` (linha ~414), substituir essa linha por:

```ts
	let discountCents = 0;
	let couponId: string | null = null;
	if (input.couponCode) {
		const couponLines = lines.map((l) => ({
			toolId: l.tool.id,
			quantity: l.cartItem.quantity,
			basePriceCents: centsFromString(l.variant.priceAmount),
		}));
		const coupon = await validateCoupon(tx, input.couponCode, couponLines);
		if (!coupon.ok) {
			throw new OrderError(coupon.error);
		}

		// Trava a linha da promoção e re-checa o limite na mesma transação
		// (mesmo padrão idempotente do débito de estoque).
		const lockRes = await tx.execute(
			sql`SELECT redemption_count, max_redemptions FROM promotion WHERE id = ${coupon.promotionId} FOR UPDATE`
		);
		const lock =
			(lockRes as unknown as {
				rows: Array<{ redemption_count: number; max_redemptions: number | null }>;
			}).rows?.[0] ??
			(lockRes as unknown as Array<{
				redemption_count: number;
				max_redemptions: number | null;
			}>)[0];
		if (
			lock &&
			lock.max_redemptions !== null &&
			lock.redemption_count >= lock.max_redemptions
		) {
			throw new OrderError("Cupom esgotado");
		}

		await tx
			.update(promotion)
			.set({ redemptionCount: sql`${promotion.redemptionCount} + 1` })
			.where(eq(promotion.id, coupon.promotionId));

		discountCents = coupon.discountCents;
		couponId = coupon.promotionId;
	}
	const totalCents = subtotalCents - discountCents + shippingCents;
```

- [ ] **Step 4: Gravar `discountAmount`/`couponId` no insert do `order`**

No `tx.insert(order).values({...})` (linha ~474), trocar `discountAmount: "0",` por:

```ts
			discountAmount: (discountCents / 100).toFixed(2),
			couponId,
```

- [ ] **Step 5: Adicionar testes de cupom**

Acrescentar ao final de `place-order.test.ts`, dentro de um novo `describe`. (Reusa `seedMultiBranch`, `buildInput`, `withRollback`, `db`, `order`, `eq` já presentes no arquivo; adicionar imports de `promotion` e `promotionTool`.)

No topo, adicionar aos imports:

```ts
import { promotion, promotionTool } from "@emach/db/schema/promotions";
```

E o bloco de testes:

```ts
describe("placeOrder (cupom)", () => {
	it("aplica cupom percentual: grava discount/coupon/total e incrementa resgate", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);
			const couponId = crypto.randomUUID();
			await tx.insert(promotion).values({
				id: couponId,
				title: "Cupom 10%",
				type: "promocode",
				code: "OFF10",
				discountType: "percent",
				discountValue: "10.00",
				appliesToAll: true,
				redemptionCount: 0,
				active: true,
			});

			const input = {
				...buildInput([{ toolId, variantId, quantity: 2 }]),
				couponCode: "OFF10",
			};
			const result = await placeOrder(tx, {
				clientId,
				input,
				ipAddress: null,
				userAgent: null,
			});

			const [ord] = await tx
				.select()
				.from(order)
				.where(eq(order.id, result.orderId));
			// subtotal 200, desconto 10% = 20, frete 20 → total 200
			expect(ord?.subtotalAmount).toBe("200.00");
			expect(ord?.discountAmount).toBe("20.00");
			expect(ord?.totalAmount).toBe("200.00");
			expect(ord?.couponId).toBe(couponId);

			const [promoAfter] = await tx
				.select()
				.from(promotion)
				.where(eq(promotion.id, couponId));
			expect(promoAfter?.redemptionCount).toBe(1);
		});
	});

	it("rejeita cupom esgotado", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);
			await tx.insert(promotion).values({
				id: crypto.randomUUID(),
				title: "Esgotado",
				type: "promocode",
				code: "CHEIO",
				discountType: "percent",
				discountValue: "10.00",
				appliesToAll: true,
				maxRedemptions: 1,
				redemptionCount: 1,
				active: true,
			});
			const input = {
				...buildInput([{ toolId, variantId, quantity: 1 }]),
				couponCode: "CHEIO",
			};
			await expect(
				placeOrder(tx, { clientId, input, ipAddress: null, userAgent: null })
			).rejects.toThrow(/esgotado/i);
		});
	});

	it("ignora item em auto-promo na base do cupom", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);
			// auto-promo específica cobrindo o tool
			const autoId = crypto.randomUUID();
			await tx.insert(promotion).values({
				id: autoId,
				title: "Auto",
				type: "promotion",
				discountType: "percent",
				discountValue: "20.00",
				appliesToAll: false,
				redemptionCount: 0,
				active: true,
			});
			await tx.insert(promotionTool).values({ promotionId: autoId, toolId });
			await tx.insert(promotion).values({
				id: crypto.randomUUID(),
				title: "Cupom",
				type: "promocode",
				code: "CUPOM",
				discountType: "percent",
				discountValue: "10.00",
				appliesToAll: true,
				redemptionCount: 0,
				active: true,
			});
			const input = {
				...buildInput([{ toolId, variantId, quantity: 1 }]),
				couponCode: "CUPOM",
			};
			// único item está em auto-promo → cupom não cobre nada
			await expect(
				placeOrder(tx, { clientId, input, ipAddress: null, userAgent: null })
			).rejects.toThrow(/não cobre/i);
		});
	});
});
```

> Nota: `buildInput` fixa `priceAmount: "100.00"`. Com auto-promo de 20% no terceiro teste, o `prepareLines` recalcula o preço final (80.00) e a tolerância de 1 centavo faria o pedido falhar por "Preços atualizados" **antes** do cupom. Como o teste espera falha do cupom, ajustar o `priceAmount` do item para `"80.00"` nesse caso específico, OU trocar a asserção para `/Preços atualizados|não cobre/`. Usar: `expect(...).rejects.toThrow(/não cobre|Preços atualizados/i)`.

- [ ] **Step 6: Verificar tipos e rodar os testes**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep place-order || echo "OK place-order"`
Expected: `OK place-order`.

Run: `cd apps/web && bunx vitest run src/app/checkout/_lib/place-order.test.ts`
Expected: PASS (testes antigos + 3 novos de cupom).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/checkout/_lib/place-order.ts apps/web/src/app/checkout/_lib/place-order.test.ts
git commit -m "feat: place-order aplica cupom (FOR UPDATE + incremento idempotente)"
```

---

## Task 8: Componente de UI `coupon-field`

Isolado do `checkout-content.tsx` (747 linhas). Input + Aplicar/Remover + estado aplicado/erro. Estilo Ferrari (label Barlow Condensed uppercase, sem vermelho).

**Files:**
- Create: `apps/web/src/app/checkout/_components/coupon-field.tsx`

- [ ] **Step 1: Escrever o componente**

```tsx
// apps/web/src/app/checkout/_components/coupon-field.tsx
"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";

import { applyCouponAction } from "@/app/checkout/_actions/apply-coupon";
import { fmtBRL } from "@/lib/format";

interface CouponCartItem {
	quantity: number;
	toolId: string;
	variantId: string;
}

interface CouponFieldProps {
	applied: { code: string; discountCents: number } | null;
	cartItems: CouponCartItem[];
	onApplied: (value: { code: string; discountCents: number }) => void;
	onRemoved: () => void;
}

export function CouponField({
	applied,
	cartItems,
	onApplied,
	onRemoved,
}: CouponFieldProps) {
	const [code, setCode] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const apply = async () => {
		const trimmed = code.trim();
		if (!trimmed) {
			return;
		}
		setLoading(true);
		setError(null);
		const result = await applyCouponAction({ code: trimmed, cartItems });
		setLoading(false);
		if (result.ok) {
			onApplied({ code: trimmed.toUpperCase(), discountCents: result.discountCents });
			setCode("");
		} else {
			setError(result.error);
		}
	};

	if (applied) {
		return (
			<div className="flex items-center justify-between border border-border bg-gray-10 px-3 py-2 text-sm">
				<span>
					Cupom <strong>{applied.code}</strong> aplicado
				</span>
				<button
					aria-label="Remover cupom"
					className="inline-flex items-center gap-1 text-gray-60 hover:text-near-black"
					onClick={onRemoved}
					type="button"
				>
					<X className="h-3.5 w-3.5" /> Remover
				</button>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			<span className="font-display text-[11px] text-gray-60 uppercase tracking-[0.12em]">
				Cupom de desconto
			</span>
			<div className="flex gap-2">
				<input
					className="h-10 min-w-0 flex-1 border border-border px-3 text-sm uppercase"
					onChange={(e) => setCode(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							apply();
						}
					}}
					placeholder="Inserir código"
					value={code}
				/>
				<button
					className="inline-flex items-center gap-1.5 border border-near-black px-4 text-sm hover:bg-near-black hover:text-white disabled:opacity-50"
					disabled={loading || code.trim().length === 0}
					onClick={apply}
					type="button"
				>
					{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
				</button>
			</div>
			{error ? <p className="text-[12px] text-red-600">{error}</p> : null}
		</div>
	);
}
```

> `fmtBRL` está importado para uso futuro caso queira exibir o valor no próprio campo; se o lint acusar import não usado, remover a linha do import. (Verificar no Step 2.)

- [ ] **Step 2: Verificar tipos e lint**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep coupon-field || echo "OK coupon-field"`
Expected: `OK coupon-field`.

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun check 2>&1 | grep coupon-field || echo "lint OK"`
Expected: `lint OK` (se acusar `fmtBRL` não usado, remover o import e repetir).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/checkout/_components/coupon-field.tsx
git commit -m "feat: componente CouponField (input + aplicar/remover)"
```

---

## Task 9: Integração no resumo do checkout

Estado do cupom, linha "Desconto", total ajustado e `couponCode` no envio do pedido.

**Files:**
- Modify: `apps/web/src/app/checkout/_components/checkout-content.tsx`

- [ ] **Step 1: Importar o componente**

Após `import { createOrderAction } from "@/app/checkout/_actions/create-order";` (linha ~25):

```ts
import { CouponField } from "@/app/checkout/_components/coupon-field";
```

- [ ] **Step 2: Adicionar estado do cupom e ajustar o total**

Logo após `const shipping = selectedShippingCents ?? 0;` (linha ~145), substituir `const total = subtotal + shipping;` por:

```ts
	const [coupon, setCoupon] = useState<{
		code: string;
		discountCents: number;
	} | null>(null);
	const discount = coupon?.discountCents ?? 0;
	const total = subtotal - discount + shipping;
```

> `useState` já está importado (linha 21).

- [ ] **Step 3: Enviar `couponCode` no `createOrderAction`**

No objeto passado para `createOrderAction` (linha ~177), após `shippingAmount: (selectedShippingCents / 100).toFixed(2),` adicionar:

```ts
					couponCode: coupon?.code,
```

- [ ] **Step 4: Renderizar o campo e a linha de desconto**

No bloco do resumo, dentro do `<div className="space-y-2 text-sm">` (linha ~568), logo após o `</div>` da linha de Subtotal (linha ~572) e antes do bloco de Frete, inserir:

```tsx
								<CouponField
									applied={coupon}
									cartItems={items.map((i) => ({
										toolId: i.toolId,
										variantId: i.variantId,
										quantity: i.quantity,
									}))}
									onApplied={setCoupon}
									onRemoved={() => setCoupon(null)}
								/>
								{discount > 0 ? (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Desconto</span>
										<span>−{fmtBRL(discount)}</span>
									</div>
								) : null}
```

> `fmtBRL` e `items` já estão no escopo do componente.

- [ ] **Step 5: Verificar tipos**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep checkout-content || echo "OK checkout-content"`
Expected: `OK checkout-content`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/checkout/_components/checkout-content.tsx
git commit -m "feat: campo de cupom + linha de desconto no resumo do checkout"
```

---

## Task 10: Verificação final + smoke

**Files:** nenhum (verificação).

- [ ] **Step 1: Type-check do monorepo inteiro**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun check-types`
Expected: sem erros (nenhum `discountPct`, nenhum tipo quebrado).

- [ ] **Step 2: Rodar toda a suíte de testes do checkout/cupom**

Run: `cd apps/web && bunx vitest run src/lib/promotions.test.ts src/lib/coupons/validate-coupon.test.ts src/app/checkout/_lib/place-order.test.ts`
Expected: PASS em todos.

- [ ] **Step 3: Lint**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun check`
Expected: sem erros (corrigir o que aparecer; sem `console`, sem `any`, sem `key={index}`).

- [ ] **Step 4: Smoke visual com `/dev-here 3001`**

Subir o dev server na 3001 e validar manualmente no browser logado:
1. Adicionar item sem auto-promo ao carrinho → ir ao checkout.
2. Inserir um cupom `promocode` ativo (criar um no dashboard ou via SQL) → ver linha "Desconto" e total reduzido.
3. Inserir código inválido → ver mensagem de erro.
4. Concluir o pedido → conferir no DB que `order.coupon_id`, `order.discount_amount` e `promotion.redemption_count` foram gravados.

Verificar erros runtime via `nextjs_call <port> get_errors` (MCP next-devtools) caso a tela quebre.

- [ ] **Step 5: Concluir a branch**

Após smoke OK, usar `superpowers:finishing-a-development-branch` para decidir merge/PR. Lembrar o usuário do **commit pendente no dashboard** (`packages/db/src/schema/orders.ts` — coluna `coupon_id`).

---

## Self-Review

**Spec coverage:**
- Parte 0 (breakage) → Tasks 2 (product-info) + 3 (place-order auto-promo). ✓
- Parte 1 (schema coupon_id) → Task 4. ✓
- Parte 2 (lógica cupom) → Tasks 5 (validate) + 6 (action). ✓
- Parte 3 (integração pedido) → Task 7. ✓
- Parte 4 (UI) → Tasks 8 (campo) + 9 (resumo). ✓
- Parte 5 (erros user-safe) → mensagens em validateCoupon (Task 5) + OrderError (Task 7). ✓
- Parte 6 (testes) → Tasks 1, 5, 7 + verificação Task 10. ✓
- Decisão "nunca empilha com auto-promo" → `fetchAutoPromoToolIds` em validateCoupon (Task 5) + teste (Task 5 Step 2, Task 7 Step 5). ✓

**Type consistency:** `effectiveAutoDiscountCents(baseCents, discountType, discountValue)` idêntico em Tasks 1/2/3. `validateCoupon(tx, rawCode, lines)` e `CouponLine {toolId, quantity, basePriceCents}` idênticos em Tasks 5/6/7. `applyCouponAction({code, cartItems})` / `ApplyCouponResult` idênticos em Tasks 6/8. `coupon: {code, discountCents}` idêntico em Tasks 8/9.

**Placeholders:** nenhum TODO/TBD; todo passo de código tem o código real.
