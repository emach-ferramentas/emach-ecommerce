# Verificação do checkout end-to-end — Implementation Plan

> **Status em 2026-09-28:** implementado, com o trecho de estoque substituído pelo ADR-0003. As tasks 1 e 2 estão no código: `apps/web/vitest.config.ts`, `apps/web/src/app/checkout/_lib/place-order.ts` e `place-order.test.ts` (commits `c032642`, `10f4b32`). Os trechos de código abaixo são o estado de 2026-05-18: `placeOrder` deixou de receber `branchId` e de debitar estoque em `0149a44`, e o action foi ampliado (e-mail verificado, rate limit, anti-fraude de frete).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair a lógica de criação de pedido do `createOrderAction` para uma função `placeOrder` testável, cobri-la com um teste de integração (transação revertida), e verificar o fluxo no browser.

**Architecture:** `placeOrder(tx, params)` concentra a lógica de domínio (recálculo de preço, verificação de estoque, escrita transacional de `order`/`order_item`/`stock_movement`/`consent_log`) recebendo um transaction handle. `createOrderAction` vira um wrapper fino que faz só o plumbing do Next (parse, sessão, headers) e chama `placeOrder` dentro de `db.transaction`. O teste de integração roda contra o DB Supabase de dev dentro de uma transação que sempre dá ROLLBACK.

**Tech Stack:** TypeScript, Next.js 16 server actions, Drizzle ORM, vitest, PostgreSQL (Supabase).

**Spec:** `docs/superpowers/specs/2026-05-18-checkout-e2e-design.md` · **Issue:** #17

_Nota 2026-09-28: o código dos passos abaixo não reflete o estado atual. Débito de `stock_level`, `stock_movement` e `getDefaultBranchId` saíram; ver `2026-05-20-estoque-multi-filial.md` e `docs/adr/0003-estoque-multi-filial.md`. A página do pedido do passo 3 está em `apps/web/src/app/(shop)/pedidos/[number]/page.tsx`._

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/vitest.config.ts` | **Criar.** Config do vitest: ambiente `node`, alias `@` → `src`. |
| `apps/web/package.json` | **Modificar.** devDep `vitest` + script `test`. |
| `apps/web/src/app/checkout/_lib/place-order.ts` | **Criar.** `inputSchema`, tipos, helpers e `placeOrder` — toda a lógica de domínio, sem dependência do runtime Next. |
| `apps/web/src/app/checkout/_actions/create-order.ts` | **Modificar.** Reduzir ao wrapper fino: parse + sessão + headers + `db.transaction(placeOrder)`. |
| `apps/web/src/app/checkout/_lib/place-order.test.ts` | **Criar.** Teste de integração de `placeOrder` com helper `withRollback`. |

A lógica hoje vive toda em `create-order.ts` (499 linhas, leitura recomendada antes de começar). O refactor move o domínio para `_lib/place-order.ts` e deixa o action enxuto.

---

## Task 1: Infraestrutura de vitest em `apps/web`

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Adicionar vitest ao package.json**

Em `apps/web/package.json`, adicionar a chave `"test"` ao bloco `"scripts"` (após `"check-types"`) e a devDependency `vitest`. O bloco `"scripts"` fica:

```json
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start",
    "check-types": "tsc --noEmit",
    "test": "vitest run"
  },
```

E em `"devDependencies"` adicionar (ordem alfabética, manter o resto):

```json
    "vitest": "^2.1.8"
```

(Versão `^2.1.8` — a mesma já usada em `packages/db/package.json`, para consistência no monorepo.)

- [ ] **Step 2: Criar `apps/web/vitest.config.ts`**

```ts
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(import.meta.dirname, "src"),
		},
	},
	test: {
		environment: "node",
	},
});
```

- [ ] **Step 3: Instalar a dependência**

Run: `bun install`
Expected: exit 0; `vitest` aparece em `apps/web/node_modules`.

- [ ] **Step 4: Verificar que o vitest está disponível**

Run: `bun --cwd apps/web exec vitest --version`
Expected: imprime uma versão `2.x` e sai 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts bun.lock
git commit -m "build: configurar vitest em apps/web"
```

---

## Task 2: Extrair `placeOrder` e cobrir com teste de integração

Refactor + teste numa só task: o teste é escrito primeiro (RED — `place-order.ts` não existe), depois a extração o torna verde (GREEN).

**Files:**
- Create: `apps/web/src/app/checkout/_lib/place-order.test.ts`
- Create: `apps/web/src/app/checkout/_lib/place-order.ts`
- Modify: `apps/web/src/app/checkout/_actions/create-order.ts`

- [ ] **Step 1: Escrever o teste de integração (falha)**

Criar `apps/web/src/app/checkout/_lib/place-order.test.ts`:

```ts
import { db } from "@emach/db";
import { client } from "@emach/db/schema/client";
import { consentLog } from "@emach/db/schema/consent-log";
import { branch, stockLevel } from "@emach/db/schema/inventory";
import { order, orderItem } from "@emach/db/schema/orders";
import { stockMovement } from "@emach/db/schema/stock-movements";
import { tool, toolVariant } from "@emach/db/schema/tools";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { type CreateOrderInput, placeOrder } from "./place-order";

const ROLLBACK = Symbol("rollback");

/** Roda `fn` numa transação e sempre dá ROLLBACK — zero resíduo no banco. */
async function withRollback(
	fn: (tx: typeof db) => Promise<void>
): Promise<void> {
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

/** Semeia client+branch+tool+variant+stock dentro da transação `tx`. */
async function seed(
	tx: typeof db,
	stockQty: number
): Promise<{
	clientId: string;
	branchId: string;
	toolId: string;
	variantId: string;
}> {
	const branchId = crypto.randomUUID();
	await tx.insert(branch).values({ id: branchId, name: "Filial Teste" });

	const clientId = crypto.randomUUID();
	await tx.insert(client).values({
		id: clientId,
		name: "Cliente Teste",
		email: `t-${clientId}@test.local`,
	});

	const toolId = crypto.randomUUID();
	await tx.insert(tool).values({ id: toolId, name: "Furadeira Teste" });

	const variantId = crypto.randomUUID();
	await tx.insert(toolVariant).values({
		id: variantId,
		toolId,
		sku: `SKU-${variantId}`,
		priceAmount: "100.00",
		isDefault: true,
	});

	await tx
		.insert(stockLevel)
		.values({ variantId, branchId, quantity: stockQty });

	return { clientId, branchId, toolId, variantId };
}

function buildInput(toolId: string, variantId: string, qty: number) {
	return {
		name: "Cliente Teste",
		email: "cliente@test.local",
		phone: "11999999999",
		// placeOrder não revalida o input; documento único por execução
		// evita colisão com o índice unique de client.document.
		document: String(Date.now()).padStart(11, "0").slice(-11),
		addressId: null,
		newAddress: {
			zipCode: "01001000",
			street: "Rua Teste",
			number: "1",
			complement: "",
			neighborhood: "Centro",
			city: "São Paulo",
			state: "SP",
		},
		acceptMarketing: true,
		cartItems: [{ toolId, variantId, quantity: qty, priceAmount: "100.00" }],
		shippingAmount: "20.00",
	} satisfies CreateOrderInput;
}

describe("placeOrder", () => {
	it("cria o pedido, debita estoque e registra consentimento", async () => {
		await withRollback(async (tx) => {
			const { clientId, branchId, toolId, variantId } = await seed(tx, 10);
			const input = buildInput(toolId, variantId, 2);

			const result = await placeOrder(tx, {
				clientId,
				branchId,
				input,
				ipAddress: null,
				userAgent: null,
			});

			const [ord] = await tx
				.select()
				.from(order)
				.where(eq(order.id, result.orderId));
			expect(ord?.status).toBe("pending_payment");
			expect(ord?.subtotalAmount).toBe("200.00");
			expect(ord?.totalAmount).toBe("220.00");

			const items = await tx
				.select()
				.from(orderItem)
				.where(eq(orderItem.orderId, result.orderId));
			expect(items).toHaveLength(1);
			expect(items[0]?.quantity).toBe(2);
			expect(items[0]?.unitPrice).toBe("100.00");

			const [stock] = await tx
				.select()
				.from(stockLevel)
				.where(eq(stockLevel.variantId, variantId));
			expect(stock?.quantity).toBe(8);

			const movements = await tx
				.select()
				.from(stockMovement)
				.where(eq(stockMovement.orderId, result.orderId));
			expect(movements).toHaveLength(1);
			expect(movements[0]?.reason).toBe("saida_venda");
			expect(movements[0]?.actorType).toBe("system");
			expect(movements[0]?.delta).toBe(-2);

			const consents = await tx
				.select()
				.from(consentLog)
				.where(eq(consentLog.clientId, clientId));
			expect(consents).toHaveLength(3);
		});
	});

	it("rejeita quando o estoque é insuficiente", async () => {
		await withRollback(async (tx) => {
			const { clientId, branchId, toolId, variantId } = await seed(tx, 1);
			const input = buildInput(toolId, variantId, 5);

			await expect(
				placeOrder(tx, {
					clientId,
					branchId,
					input,
					ipAddress: null,
					userAgent: null,
				})
			).rejects.toThrow(/estoque/i);
		});
	});
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `bun --cwd apps/web test`
Expected: FAIL — vitest não resolve o módulo `./place-order` ("Cannot find module" / "Failed to load").

- [ ] **Step 3: Criar `apps/web/src/app/checkout/_lib/place-order.ts`**

Este arquivo recebe a lógica de domínio hoje em `create-order.ts`. Construa-o assim:

1. **Mover verbatim de `create-order.ts`**, sem `"use server"`: as constantes `PRICE_TOLERANCE_CENTS` e `newAddressSchema`; o `inputSchema` e os tipos `CreateOrderInput`/`CreateOrderResult`; a interface `AddressSnapshot`; as funções `centsFromString`, `formatOrderNumber`, `buildAddressSnapshot`; a interface `PreparedLine`. Exportar `inputSchema`, `CreateOrderInput`, `CreateOrderResult`.

2. **Imports necessários** no topo de `place-order.ts`:

```ts
import { db } from "@emach/db";
import { client, clientAddress } from "@emach/db/schema/client";
import { consentLog } from "@emach/db/schema/consent-log";
import { stockLevel } from "@emach/db/schema/inventory";
import { order, orderItem } from "@emach/db/schema/orders";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { stockMovement } from "@emach/db/schema/stock-movements";
import { tool, toolVariant } from "@emach/db/schema/tools";
import { and, eq, gt, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { addressFieldsSchema } from "@/lib/validators/address";
import { isValidCpfCnpj } from "@/lib/validators/cpf-cnpj";
```

3. **`fetchDiscountPctByToolId`** — mover de `create-order.ts`, mudando a assinatura para receber `tx` e usá-lo no lugar do singleton `db`:

```ts
async function fetchDiscountPctByToolId(
	tx: typeof db,
	toolIds: string[],
	now: Date
): Promise<Map<string, number>> {
	const promoRows = await tx
		.select({
			toolId: promotionTool.toolId,
			discountPct: promotion.discountPct,
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
		);

	const map = new Map<string, number>();
	for (const row of promoRows) {
		const pct = Number(row.discountPct);
		if (!Number.isFinite(pct) || pct <= 0) {
			continue;
		}
		const current = map.get(row.toolId) ?? 0;
		if (pct > current) {
			map.set(row.toolId, pct);
		}
	}
	return map;
}
```

4. **`prepareLines`** — mover de `create-order.ts`, mudando para: receber `tx` (e usá-lo nas leituras + na chamada a `fetchDiscountPctByToolId`); **lançar `Error` em vez de retornar `{ ok: false }`**; retornar `PreparedLine[]` direto:

```ts
async function prepareLines(
	tx: typeof db,
	input: CreateOrderInput
): Promise<PreparedLine[]> {
	const variantIds = input.cartItems.map((i) => i.variantId);
	const toolIds = Array.from(new Set(input.cartItems.map((i) => i.toolId)));

	const [variantRows, toolRows, discountPctByToolId] = await Promise.all([
		tx
			.select({
				id: toolVariant.id,
				toolId: toolVariant.toolId,
				sku: toolVariant.sku,
				voltage: toolVariant.voltage,
				priceAmount: toolVariant.priceAmount,
				costAmount: toolVariant.costAmount,
			})
			.from(toolVariant)
			.where(inArray(toolVariant.id, variantIds)),
		tx
			.select({
				id: tool.id,
				name: tool.name,
				model: tool.model,
				ncm: tool.ncm,
				cest: tool.cest,
				manufacturerName: tool.manufacturerName,
				weightKg: tool.weightKg,
				lengthCm: tool.lengthCm,
				widthCm: tool.widthCm,
				heightCm: tool.heightCm,
			})
			.from(tool)
			.where(inArray(tool.id, toolIds)),
		fetchDiscountPctByToolId(tx, toolIds, new Date()),
	]);

	if (variantRows.length !== variantIds.length) {
		throw new Error("Variante inválida no carrinho");
	}

	const toolById = new Map(toolRows.map((t) => [t.id, t]));
	const variantById = new Map(variantRows.map((v) => [v.id, v]));

	const lines: PreparedLine[] = [];
	for (const cartItem of input.cartItems) {
		const variant = variantById.get(cartItem.variantId);
		const toolRow = toolById.get(cartItem.toolId);
		if (!(variant && toolRow) || variant.toolId !== cartItem.toolId) {
			throw new Error("Inconsistência cart/DB");
		}
		const pct = discountPctByToolId.get(cartItem.toolId) ?? 0;
		const basePriceCents = centsFromString(variant.priceAmount);
		const finalPriceCents =
			pct > 0 ? Math.round(basePriceCents * (1 - pct / 100)) : basePriceCents;
		const submittedCents = centsFromString(cartItem.priceAmount);
		if (Math.abs(submittedCents - finalPriceCents) > PRICE_TOLERANCE_CENTS) {
			throw new Error("Preços atualizados, refaça o checkout");
		}
		lines.push({
			cartItem,
			variant,
			tool: toolRow,
			finalPriceCents,
			lineTotalCents: finalPriceCents * cartItem.quantity,
		});
	}

	return lines;
}
```

5. **`checkStock`** — mover de `create-order.ts`, mudando para receber `tx`, **lançar `Error`** em vez de retornar `{ ok: false }`, e retornar `void`:

```ts
async function checkStock(
	tx: typeof db,
	lines: PreparedLine[],
	branchId: string
): Promise<void> {
	const stockRows = await tx
		.select()
		.from(stockLevel)
		.where(
			and(
				eq(stockLevel.branchId, branchId),
				inArray(
					stockLevel.variantId,
					lines.map((l) => l.variant.id)
				)
			)
		);
	const stockByVariant = new Map(
		stockRows.map((s) => [s.variantId, s.quantity])
	);
	for (const line of lines) {
		const available = stockByVariant.get(line.variant.id) ?? 0;
		if (available < line.cartItem.quantity) {
			throw new Error(`Sem estoque para ${line.tool.name}`);
		}
	}
}
```

6. **`placeOrder`** — a função nova exportada, que orquestra tudo sobre `tx`:

```ts
export async function placeOrder(
	tx: typeof db,
	params: {
		clientId: string;
		branchId: string;
		input: CreateOrderInput;
		ipAddress: string | null;
		userAgent: string | null;
	}
): Promise<{ orderId: string; orderNumber: string }> {
	const { clientId, branchId, input, ipAddress, userAgent } = params;

	const lines = await prepareLines(tx, input);
	await checkStock(tx, lines, branchId);

	const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
	const shippingCents = centsFromString(input.shippingAmount);
	const totalCents = subtotalCents + shippingCents;

	await tx
		.update(client)
		.set({
			name: input.name,
			phone: input.phone,
			document: input.document,
		})
		.where(eq(client.id, clientId));

	const { snapshot } = await buildAddressSnapshot({
		clientId,
		addressId: input.addressId,
		newAddress: input.newAddress,
		recipient: input.name,
		tx,
	});

	const consentVersion = "1.0";
	const consentRows = [
		{ kind: "tos" as const, granted: true },
		{ kind: "privacy" as const, granted: true },
		{ kind: "marketing_email" as const, granted: input.acceptMarketing },
	];
	await tx.insert(consentLog).values(
		consentRows.map((c) => ({
			id: crypto.randomUUID(),
			clientId,
			kind: c.kind,
			granted: c.granted,
			version: consentVersion,
			ipAddress,
			userAgent,
		}))
	);

	const seqRow = await tx.execute(
		sql`SELECT nextval('order_number_seq')::int AS seq`
	);
	const seq = Number(
		(seqRow as unknown as { rows: Array<{ seq: number }> }).rows[0]?.seq ??
			(seqRow as unknown as Array<{ seq: number }>)[0]?.seq
	);
	if (!Number.isFinite(seq)) {
		throw new Error("Falha ao gerar número do pedido");
	}
	const orderNumber = formatOrderNumber(seq);

	const orderId = crypto.randomUUID();
	const subtotalAmount = (subtotalCents / 100).toFixed(2);
	const totalAmount = (totalCents / 100).toFixed(2);

	await tx.insert(order).values({
		id: orderId,
		number: orderNumber,
		clientId,
		branchId,
		status: "pending_payment",
		subtotalAmount,
		discountAmount: "0",
		shippingAmount: input.shippingAmount,
		totalAmount,
		shippingAddress: snapshot,
	});

	for (const line of lines) {
		const orderItemId = crypto.randomUUID();
		const unitPrice = (line.finalPriceCents / 100).toFixed(2);
		const lineTotal = (line.lineTotalCents / 100).toFixed(2);

		await tx.insert(orderItem).values({
			id: orderItemId,
			orderId,
			toolId: line.tool.id,
			variantId: line.variant.id,
			sku: line.variant.sku,
			name: line.tool.name,
			model: line.tool.model,
			voltage: line.variant.voltage,
			unitPrice,
			quantity: line.cartItem.quantity,
			lineTotal,
			discountAmount: "0",
			cost: line.variant.costAmount ?? null,
			ncm: line.tool.ncm,
			cest: line.tool.cest,
			manufacturerName: line.tool.manufacturerName,
			weightKg: line.tool.weightKg,
			lengthCm: line.tool.lengthCm,
			widthCm: line.tool.widthCm,
			heightCm: line.tool.heightCm,
		});

		const updated = await tx
			.update(stockLevel)
			.set({
				quantity: sql`${stockLevel.quantity} - ${line.cartItem.quantity}`,
			})
			.where(
				and(
					eq(stockLevel.variantId, line.variant.id),
					eq(stockLevel.branchId, branchId),
					gte(stockLevel.quantity, line.cartItem.quantity)
				)
			)
			.returning({ quantity: stockLevel.quantity });
		const after = updated[0];
		if (!after) {
			throw new Error(`Stock insuficiente para ${line.tool.name}`);
		}
		const previousQty = after.quantity + line.cartItem.quantity;

		await tx.insert(stockMovement).values({
			id: crypto.randomUUID(),
			variantId: line.variant.id,
			branchId,
			previousQty,
			newQty: after.quantity,
			delta: -line.cartItem.quantity,
			reason: "saida_venda",
			orderId,
			orderItemId,
			actorType: "system",
		});
	}

	return { orderId, orderNumber };
}
```

`buildAddressSnapshot` move verbatim — já recebe `tx: typeof db`; manter como está, apenas garantir que `newAddressSchema` está definido neste arquivo.

- [ ] **Step 4: Reescrever `create-order.ts` como wrapper fino**

Substituir TODO o conteúdo de `apps/web/src/app/checkout/_actions/create-order.ts` por:

```ts
"use server";

import { db } from "@emach/db";
import { headers } from "next/headers";

import { getDefaultBranchId } from "@/lib/default-branch";
import { log } from "@/lib/evlog";
import { requireCurrentClient } from "@/lib/session";

import {
	type CreateOrderInput,
	type CreateOrderResult,
	inputSchema,
	placeOrder,
} from "../_lib/place-order";

export type { CreateOrderInput, CreateOrderResult };

export async function createOrderAction(
	rawInput: CreateOrderInput
): Promise<CreateOrderResult> {
	const parsed = inputSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	const input = parsed.data;

	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const branchId = await getDefaultBranchId();

	const reqHeaders = await headers();
	const ipAddress =
		reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
	const userAgent = reqHeaders.get("user-agent") ?? null;

	try {
		const result = await db.transaction((tx) =>
			placeOrder(tx as unknown as typeof db, {
				clientId,
				branchId,
				input,
				ipAddress,
				userAgent,
			})
		);
		return { ok: true, ...result };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "create_order_failed",
			clientId,
			branchId,
			error: message,
		});
		return { ok: false, error: message };
	}
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `bun --cwd apps/web test`
Expected: PASS — 2 testes verdes ("cria o pedido…", "rejeita quando o estoque é insuficiente").

- [ ] **Step 6: Verificar tipos e lint**

Run: `bun run check-types`
Expected: 6/6 pacotes, exit 0. (Se algum arquivo importava `CreateOrderInput`/`CreateOrderResult` de `_actions/create-order`, o `export type` re-exportado mantém esses imports válidos.)

Run: `bun run check`
Expected: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/checkout
git commit -m "refactor: extrair placeOrder testavel do createOrderAction

Closes #17"
```

---

## Task 3: Smoke manual do checkout

Verificação interativa do que o teste de integração não cobre: o wrapper Next e o render da página de pedido.

**Files:** nenhum (verificação).

- [ ] **Step 1: Subir o app**

Run: `bun run dev:web`
Expected: app em `http://localhost:3001` sem erro de boot.

- [ ] **Step 2: Percorrer o fluxo no browser**

Com `agent-browser` (ou manualmente): autenticar como cliente → abrir um produto → adicionar uma variante ao carrinho → ir ao checkout → preencher dados/endereço → finalizar.
Expected: redirect para `/pedidos/<numero>`; a página renderiza o pedido (status "Aguardando pagamento", itens, totais, endereço) sem erro.

- [ ] **Step 3: Confirmar no banco**

Run: `psql "$DATABASE_URL" -c "SELECT number, status, total_amount FROM \"order\" ORDER BY created_at DESC LIMIT 1;"`
Expected: a linha do pedido recém-criado, `status = pending_payment`.

- [ ] **Step 4: Registrar o resultado**

Comentar na issue #17 o resultado do smoke (`gh issue comment 17 --body "..."`) — ou, se já fechada pelo commit da Task 2, reabrir só se o smoke falhar.

---

## Self-Review

**Spec coverage:**
- Refactor `placeOrder` → Task 2 (steps 3-4). ✓
- Infra vitest em `apps/web` → Task 1. ✓
- Teste de integração com transação revertida → Task 2 (step 1, helper `withRollback`). ✓
- Smoke manual → Task 3. ✓
- Acceptance criteria #1-#3 → Task 2 (teste) + Task 3 (smoke). #4 → o teste existe e roda via `bun --cwd apps/web test`. ✓

**Placeholders:** nenhum — todo código está completo nos steps.

**Type consistency:** `placeOrder(tx, { clientId, branchId, input, ipAddress, userAgent })` e o tipo `CreateOrderInput` são idênticos no teste (Task 2 step 1) e na implementação (step 3) e no action (step 4). `prepareLines`/`checkStock`/`fetchDiscountPctByToolId` recebem `tx` como primeiro parâmetro de forma consistente.

**Caveat:** `order_number_seq` não reverte no ROLLBACK — cada run do teste consome um número de pedido (gaps inofensivos), conforme o spec.
