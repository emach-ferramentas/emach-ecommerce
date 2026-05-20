# Estoque multi-filial — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar débito de estoque do storefront em `pending_payment` (viola contrato compartilhado). Validação no checkout vira otimista (`SUM(stock_level.quantity) >= total` por variante), `order.branch_id = NULL`, nenhum `stock_movement` criado. Débito real fica para a futura integração de pagamento (issue separado), na transição `pending_payment → paid` — escopo dela, não deste plano.

**Architecture:** Refator localizado em `apps/web/src/app/checkout/_lib/place-order.ts` (remove parâmetro `branchId`, substitui `checkStock` por `checkAggregateStock` que faz `SELECT GROUP BY`, remove bloco que mutava `stock_level` e gravava `stock_movement`). `apps/web/src/app/checkout/_actions/create-order.ts` para de chamar `getDefaultBranchId`. `apps/web/src/lib/default-branch.ts` deletado (re-cria quando pagamento for integrado). Testes reescritos com cenários multi-filial. ADR-0003 documenta a nova decisão; ADR-0001 marcado superseded.

**Tech Stack:** TypeScript, Drizzle ORM, Postgres, Vitest, Bun, Next.js 16.

**Spec:** `docs/superpowers/specs/2026-05-20-estoque-multi-filial-design.md`

---

## Pré-flight

- [ ] **PF.1: Confirmar estado do working tree**

```bash
git status
git branch --show-current
```

Esperado:
- branch: `feat/melhorias-pages-2`
- Pode haver modificação pré-existente em `apps/web/src/components/product-card.tsx` (reformatação) — ignorar, não bloqueia.
- Specs e plans novos podem aparecer como untracked — esperado.

- [ ] **PF.2: Confirmar testes atuais passando**

```bash
cd apps/web && bun test src/app/checkout/_lib/place-order.test.ts
```

Esperado: 3/3 testes passam (cria pedido, rejeita por estoque insuficiente, rejeita por documento duplicado). Se algum falhar, parar e investigar antes de mudar qualquer coisa.

- [ ] **PF.3: Contrato do dashboard já alinhado (sem PR coordenado)**

A v2 deste spec confirmou que o contrato canônico do dashboard (`emach-dashboard/docs/integration/admin-ecommerce.md` mergeado em 2026-05-18, ADR-0007 do dashboard) já especifica: storefront é dono do débito de venda, e o débito acontece na transição para `paid`. Este plano apenas REMOVE o débito errado em `pending_payment`. **Nenhum PR coordenado no dashboard é necessário.**

O débito real fica para um issue futuro, quando integração de pagamento (Asaas/PIX/etc.) for adicionada.

---

## Task 1: Reescrever testes (TDD — vermelho)

**Files:**
- Modify: `apps/web/src/app/checkout/_lib/place-order.test.ts` (substituição completa do conteúdo)

Esta task escreve os testes do novo comportamento antes da implementação. Eles vão **falhar** porque `placeOrder` ainda recebe `branchId` e debita estoque.

- [ ] **Step 1.1: Sobrescrever o arquivo de teste com a nova suite**

Substitua **todo o conteúdo** de `apps/web/src/app/checkout/_lib/place-order.test.ts` por:

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
const RE_ESTOQUE = /estoque/i;
const RE_DOC_DUP = /cadastrado em outra conta/i;
const RE_SQL_LEAK = /Failed query|update "client"/i;

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

interface SeedResult {
	clientId: string;
	toolId: string;
	variantId: string;
	branchIds: string[];
}

/**
 * Semeia client+tool+variant + N filiais, cada uma com a quantidade
 * indicada em `stockPerBranch`. Retorna IDs criados.
 */
async function seedMultiBranch(
	tx: typeof db,
	stockPerBranch: number[]
): Promise<SeedResult> {
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

	const branchIds: string[] = [];
	for (const [i, qty] of stockPerBranch.entries()) {
		const branchId = crypto.randomUUID();
		await tx
			.insert(branch)
			.values({ id: branchId, name: `Filial Teste ${i + 1}` });
		await tx
			.insert(stockLevel)
			.values({ variantId, branchId, quantity: qty });
		branchIds.push(branchId);
	}

	return { clientId, toolId, variantId, branchIds };
}

/** Semeia um segundo tool+variant para cenários multi-item. */
async function seedSecondVariant(
	tx: typeof db,
	stockPerBranch: number[],
	existingBranchIds: string[]
): Promise<{ toolId: string; variantId: string }> {
	const toolId = crypto.randomUUID();
	await tx.insert(tool).values({ id: toolId, name: "Serra Teste" });

	const variantId = crypto.randomUUID();
	await tx.insert(toolVariant).values({
		id: variantId,
		toolId,
		sku: `SKU-${variantId}`,
		priceAmount: "100.00",
		isDefault: true,
	});

	for (const [i, qty] of stockPerBranch.entries()) {
		const branchId = existingBranchIds[i];
		if (!branchId) {
			throw new Error("Branch faltando para semear segunda variante");
		}
		await tx
			.insert(stockLevel)
			.values({ variantId, branchId, quantity: qty });
	}

	return { toolId, variantId };
}

function buildInput(
	items: Array<{ toolId: string; variantId: string; quantity: number }>
): CreateOrderInput {
	return {
		name: "Cliente Teste",
		email: "cliente@test.local",
		phone: "11999999999",
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
		cartItems: items.map((i) => ({
			toolId: i.toolId,
			variantId: i.variantId,
			quantity: i.quantity,
			priceAmount: "100.00",
		})),
		shippingAmount: "20.00",
	};
}

describe("placeOrder (multi-filial)", () => {
	it("cria pedido com order.branch_id NULL e nenhum stock_movement (filial única)", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);
			const input = buildInput([{ toolId, variantId, quantity: 2 }]);

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
			expect(ord?.branchId).toBeNull();
			expect(ord?.status).toBe("pending_payment");
			expect(ord?.subtotalAmount).toBe("200.00");
			expect(ord?.totalAmount).toBe("220.00");

			const items = await tx
				.select()
				.from(orderItem)
				.where(eq(orderItem.orderId, result.orderId));
			expect(items).toHaveLength(1);
			expect(items[0]?.quantity).toBe(2);

			const stocks = await tx
				.select()
				.from(stockLevel)
				.where(eq(stockLevel.variantId, variantId));
			expect(stocks.map((s) => s.quantity)).toEqual([10]);

			const movements = await tx
				.select()
				.from(stockMovement)
				.where(eq(stockMovement.orderId, result.orderId));
			expect(movements).toHaveLength(0);

			const consents = await tx
				.select()
				.from(consentLog)
				.where(eq(consentLog.clientId, clientId));
			expect(consents).toHaveLength(3);
		});
	});

	it("autoriza pedido quando o estoque agregado de 2 filiais é suficiente", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [3, 2]);
			const input = buildInput([{ toolId, variantId, quantity: 4 }]);

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
			expect(ord?.branchId).toBeNull();

			const stocks = await tx
				.select()
				.from(stockLevel)
				.where(eq(stockLevel.variantId, variantId));
			const totalQty = stocks.reduce((s, r) => s + r.quantity, 0);
			expect(totalQty).toBe(5);
			expect(stocks.map((s) => s.quantity).sort()).toEqual([2, 3]);

			const movements = await tx
				.select()
				.from(stockMovement)
				.where(eq(stockMovement.orderId, result.orderId));
			expect(movements).toHaveLength(0);
		});
	});

	it("rejeita pedido quando o estoque agregado é insuficiente", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [3, 2]);
			const input = buildInput([{ toolId, variantId, quantity: 6 }]);

			await expect(
				placeOrder(tx, {
					clientId,
					input,
					ipAddress: null,
					userAgent: null,
				})
			).rejects.toThrow(RE_ESTOQUE);
		});
	});

	it("rejeita pedido quando a variante não tem nenhum registro em stock_level", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, []);
			const input = buildInput([{ toolId, variantId, quantity: 1 }]);

			await expect(
				placeOrder(tx, {
					clientId,
					input,
					ipAddress: null,
					userAgent: null,
				})
			).rejects.toThrow(RE_ESTOQUE);
		});
	});

	it("rejeita pedido multi-item quando uma das variantes tem estoque agregado insuficiente", async () => {
		await withRollback(async (tx) => {
			const seedA = await seedMultiBranch(tx, [10]);
			const seedB = await seedSecondVariant(tx, [1], seedA.branchIds);
			const input = buildInput([
				{ toolId: seedA.toolId, variantId: seedA.variantId, quantity: 2 },
				{ toolId: seedB.toolId, variantId: seedB.variantId, quantity: 5 },
			]);

			await expect(
				placeOrder(tx, {
					clientId: seedA.clientId,
					input,
					ipAddress: null,
					userAgent: null,
				})
			).rejects.toThrow(RE_ESTOQUE);

			// Nada gravado: sem pedido criado.
			const orders = await tx
				.select()
				.from(order)
				.where(eq(order.clientId, seedA.clientId));
			expect(orders).toHaveLength(0);
		});
	});

	it("validação otimista — documenta oversell aceito em concorrência (ADR-0003)", async () => {
		// Cenário: agregado total = 1, dois pedidos concorrentes pedindo 1 cada.
		// SEM lock pessimista, ambos passam. Admin resolve manualmente no dashboard.
		// Este teste documenta o trade-off intencional do ADR-0003 — não é um bug.
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [1]);
			const otherClientId = crypto.randomUUID();
			await tx.insert(client).values({
				id: otherClientId,
				name: "Cliente Concorrente",
				email: `c-${otherClientId}@test.local`,
			});

			const input1 = buildInput([{ toolId, variantId, quantity: 1 }]);
			const input2 = {
				...buildInput([{ toolId, variantId, quantity: 1 }]),
				document: crypto.randomUUID().slice(0, 11).replace(/-/g, "0"),
			};

			// Como estamos numa única transação de teste, simulamos a concorrência
			// chamando placeOrder duas vezes em sequência sem mutação intermediária
			// de stock_level (placeOrder não muta mais — esse é o ponto do teste).
			const r1 = await placeOrder(tx, {
				clientId,
				input: input1,
				ipAddress: null,
				userAgent: null,
			});
			const r2 = await placeOrder(tx, {
				clientId: otherClientId,
				input: input2,
				ipAddress: null,
				userAgent: null,
			});

			expect(r1.orderId).toBeTruthy();
			expect(r2.orderId).toBeTruthy();

			const stocks = await tx
				.select()
				.from(stockLevel)
				.where(eq(stockLevel.variantId, variantId));
			// Estoque continua inalterado — débito é responsabilidade do dashboard.
			expect(stocks[0]?.quantity).toBe(1);
		});
	});

	it("rejeita com erro amigável quando o documento já pertence a outra conta", async () => {
		await withRollback(async (tx) => {
			const { clientId, toolId, variantId } = await seedMultiBranch(tx, [10]);

			const takenDoc = crypto.randomUUID();
			const otherId = crypto.randomUUID();
			await tx.insert(client).values({
				id: otherId,
				name: "Outro Cliente",
				email: `o-${otherId}@test.local`,
				document: takenDoc,
			});

			const input = {
				...buildInput([{ toolId, variantId, quantity: 1 }]),
				document: takenDoc,
			};
			const call = placeOrder(tx, {
				clientId,
				input,
				ipAddress: null,
				userAgent: null,
			});

			await expect(call).rejects.toThrow(RE_DOC_DUP);
			await expect(call).rejects.not.toThrow(RE_SQL_LEAK);
		});
	});
});
```

- [ ] **Step 1.2: Rodar os testes para confirmar que falham**

```bash
cd apps/web && bun test src/app/checkout/_lib/place-order.test.ts
```

Esperado: **FAIL**. Erros esperados:
- TypeScript: `placeOrder` ainda exige `branchId` no params, então `bun test` pode falhar antes mesmo de rodar.
- Se rodar, vários testes falham com expectativas sobre `ord?.branchId` (espera null, recebe string) e `movements` (espera 0, recebe 1).

Esse é o estado correto do "vermelho" do TDD.

- [ ] **Step 1.3: Commit do teste vermelho**

```bash
git add apps/web/src/app/checkout/_lib/place-order.test.ts
git commit -m "test(checkout): reescreve suite para estoque multi-filial (vermelho)"
```

---

## Task 2: Refator de `placeOrder` (verde)

**Files:**
- Modify: `apps/web/src/app/checkout/_lib/place-order.ts`

- [ ] **Step 2.1: Substituir `checkStock` por `checkAggregateStock`**

Em `apps/web/src/app/checkout/_lib/place-order.ts`, **substituir** a função `checkStock` inteira (linhas 309-335) por:

```ts
async function checkAggregateStock(
	tx: typeof db,
	lines: PreparedLine[]
): Promise<void> {
	const variantIds = lines.map((l) => l.variant.id);
	const rows = await tx
		.select({
			variantId: stockLevel.variantId,
			total: sql<number>`COALESCE(SUM(${stockLevel.quantity}), 0)::int`,
		})
		.from(stockLevel)
		.where(inArray(stockLevel.variantId, variantIds))
		.groupBy(stockLevel.variantId);

	const totalByVariant = new Map(rows.map((r) => [r.variantId, r.total]));
	for (const line of lines) {
		const total = totalByVariant.get(line.variant.id) ?? 0;
		if (total < line.cartItem.quantity) {
			throw new OrderError(`Sem estoque para ${line.tool.name}`);
		}
	}
}
```

- [ ] **Step 2.2: Mudar assinatura de `placeOrder`**

Em `placeOrder` (linhas ~337-347), trocar:

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
```

por:

```ts
export async function placeOrder(
	tx: typeof db,
	params: {
		clientId: string;
		input: CreateOrderInput;
		ipAddress: string | null;
		userAgent: string | null;
	}
): Promise<{ orderId: string; orderNumber: string }> {
	const { clientId, input, ipAddress, userAgent } = params;

	const lines = await prepareLines(tx, input);
	await checkAggregateStock(tx, lines);
```

- [ ] **Step 2.3: Gravar `order.branchId = null`**

No `INSERT order` (linha ~414), trocar:

```ts
await tx.insert(order).values({
	id: orderId,
	number: orderNumber,
	clientId,
	branchId,
	status: "pending_payment",
```

por:

```ts
await tx.insert(order).values({
	id: orderId,
	number: orderNumber,
	clientId,
	branchId: null,
	status: "pending_payment",
```

- [ ] **Step 2.4: Remover bloco de débito e stock_movement**

No loop `for (const line of lines)` (linhas ~427-486), o bloco inteiro depois do `await tx.insert(orderItem).values(...)` é o que muda estoque. Trocar o loop por:

```ts
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
}
```

Removido: `UPDATE stockLevel`, leitura de `updated`, cálculo de `previousQty`, `INSERT stockMovement`.

- [ ] **Step 2.5: Limpar imports não usados**

No topo do arquivo (linhas 1-10), remover imports que ficaram órfãos. Conferir e remover:

- `stockMovement` (era usado só no INSERT removido).
- `gte` de `drizzle-orm` (era usado na guarda do UPDATE).

Manter: `stockLevel` (ainda usado em `checkAggregateStock`), `inArray`, `sql`, `eq`, `and`, `gt`, `isNull`, `lte`, `or`.

Linha de import esperada após limpeza:

```ts
import { stockLevel } from "@emach/db/schema/inventory";
// (linha de stock-movements removida)
```

e:

```ts
import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
```

- [ ] **Step 2.6: Rodar testes — verificar verde**

```bash
cd apps/web && bun test src/app/checkout/_lib/place-order.test.ts
```

Esperado: **7/7 PASS** (6 cenários multi-filial + cenário de documento duplicado).

Se algum falhar, ler a mensagem com cuidado. Possíveis causas:
- Esqueceu de tirar `branchId` de algum lugar.
- Import de `stockMovement`/`gte` ainda presente → TS warning.
- `checkAggregateStock` retornando totais errados — verificar SQL do `SUM`.

- [ ] **Step 2.7: Commit do verde**

```bash
git add apps/web/src/app/checkout/_lib/place-order.ts
git commit -m "refactor(checkout): placeOrder valida estoque agregado e nao debita mais"
```

---

## Task 3: Atualizar caller (`create-order.ts`)

**Files:**
- Modify: `apps/web/src/app/checkout/_actions/create-order.ts`

- [ ] **Step 3.1: Remover import e uso de `getDefaultBranchId`**

Substituir o conteúdo de `apps/web/src/app/checkout/_actions/create-order.ts` por:

```ts
"use server";

import { db } from "@emach/db";
import { headers } from "next/headers";

import { log } from "@/lib/evlog";
import { requireCurrentClient } from "@/lib/session";

import {
	type CreateOrderInput,
	type CreateOrderResult,
	inputSchema,
	OrderError,
	placeOrder,
} from "../_lib/place-order";

const GENERIC_ORDER_ERROR =
	"Não foi possível concluir o pedido. Tente novamente.";

export type { CreateOrderInput, CreateOrderResult } from "../_lib/place-order";

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

	const reqHeaders = await headers();
	const ipAddress =
		reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
	const userAgent = reqHeaders.get("user-agent") ?? null;

	try {
		const result = await db.transaction((tx) =>
			placeOrder(tx as unknown as typeof db, {
				clientId,
				input,
				ipAddress,
				userAgent,
			})
		);
		return { ok: true, ...result };
	} catch (err) {
		const rawMessage = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "create_order_failed",
			clientId,
			error: rawMessage,
		});
		const userError =
			err instanceof OrderError ? err.message : GENERIC_ORDER_ERROR;
		return { ok: false, error: userError };
	}
}
```

Mudanças vs. o arquivo original:
- Removido `import { getDefaultBranchId } from "@/lib/default-branch"`.
- Removida linha `const branchId = await getDefaultBranchId()`.
- Removido `branchId` do params de `placeOrder`.
- Removido `branchId` do `log.error` payload.

- [ ] **Step 3.2: Verificar tipos**

```bash
bun --cwd apps/web check-types
```

Esperado: sem erros.

- [ ] **Step 3.3: Rodar testes novamente para garantir que ainda passam**

```bash
cd apps/web && bun test src/app/checkout/_lib/place-order.test.ts
```

Esperado: 7/7 PASS.

- [ ] **Step 3.4: Commit**

```bash
git add apps/web/src/app/checkout/_actions/create-order.ts
git commit -m "refactor(checkout): create-order.ts nao resolve mais default branch"
```

---

## Task 4: Deletar `lib/default-branch.ts`

**Files:**
- Delete: `apps/web/src/lib/default-branch.ts`

- [ ] **Step 4.1: Garantir que ninguém mais usa**

```bash
grep -rn "default-branch\|getDefaultBranchId" apps/web/src packages/ 2>/dev/null
```

Esperado: nenhuma ocorrência (após Task 3 ter removido a última referência).

Se aparecer alguma, parar e investigar — pode ter ficado callsite esquecido.

- [ ] **Step 4.2: Deletar o arquivo**

```bash
rm apps/web/src/lib/default-branch.ts
```

- [ ] **Step 4.3: Verificar build types**

```bash
bun run check-types
```

Esperado: 6/6 workspaces passam.

- [ ] **Step 4.4: Commit**

```bash
git add -A apps/web/src/lib/default-branch.ts
git commit -m "chore(checkout): remove lib/default-branch.ts (nao usado)"
```

---

## Task 5: Documentação — ADR-0003 e marcação do ADR-0001

**Files:**
- Create: `docs/adr/0003-estoque-multi-filial.md`
- Modify: `docs/adr/0001-debito-de-estoque-na-criacao-do-pedido.md`

- [ ] **Step 5.1: Criar ADR-0003**

Criar `docs/adr/0003-estoque-multi-filial.md` com:

```md
# Estoque multi-filial: storefront valida agregado, débito adiado para integração de pagamento

Storefront valida disponibilidade agregada (`SUM(stock_level.quantity)` por variante em todas as filiais) no checkout, mas não muta `stock_level` nem grava `stock_movement`. `order.branch_id` é NULL na criação. Débito de estoque acontecerá quando a integração de pagamento for implementada, na transição `pending_payment → paid`, conforme o contrato canônico (`emach-dashboard/docs/integration/admin-ecommerce.md` e ADR-0007 do dashboard).

## Considered Options

- **Manter ADR-0001 (débito em pending_payment, filial única):** rejeitado — viola contrato compartilhado e bagunça `stock_movement` quando a venda real veio de outra filial.
- **Implementar `confirmPayment()` agora sem integração de pagamento:** rejeitado — função sem caller é código morto até a integração real chegar. YAGNI.
- **Mover responsabilidade para o dashboard (escrever em `preparing`):** rejeitado — contradiz o ADR-0007 do dashboard, que coloca a responsabilidade no storefront.

## Consequences

- Vendas em produção não geram `stock_movement` até integração de pagamento ser implementada. Admin precisa manualmente debitar/ajustar estoque até lá. Aceitável: site está em fase pré-pagamento.
- Janela de oversell entre pedidos concorrentes: aceita. Sem lock pessimista. Volume não justifica.
- `order.branch_id` fica NULL em pedidos novos. Pedidos antigos com valor preenchido mantêm — sem migration retroativa.
- Quando integração de pagamento for adicionada (issue separado), criar `confirmPayment(orderId)` em `apps/web/src/lib/payment/` (ou similar) que: resolve filial, UPDATE stock_level com guarda, INSERT stock_movement (actor `system`, reason `saida_venda`), UPDATE order SET status='paid', paidAt=now().
```

- [ ] **Step 5.2: Marcar ADR-0001 como superseded**

Editar `docs/adr/0001-debito-de-estoque-na-criacao-do-pedido.md` adicionando, **imediatamente após o título H1** e antes do primeiro parágrafo, a linha:

```md
> **Superseded by [ADR-0003](./0003-estoque-multi-filial.md) em 2026-05-20.**
```

Arquivo final começa com:

```md
# Débito de estoque na criação do pedido

> **Superseded by [ADR-0003](./0003-estoque-multi-filial.md) em 2026-05-20.**

O storefront debita o estoque de forma síncrona ...
```

- [ ] **Step 5.3: Commit dos ADRs**

```bash
git add docs/adr/0003-estoque-multi-filial.md docs/adr/0001-debito-de-estoque-na-criacao-do-pedido.md
git commit -m "docs(adr): ADR-0003 (estoque multi-filial) substitui ADR-0001"
```

---

## Task 6: Verificação final + smoke

**Files:** nenhum.

- [ ] **Step 6.1: Type check completo**

```bash
bun run check-types
```

Esperado: 6/6 workspaces passam.

- [ ] **Step 6.2: Test completo do apps/web**

```bash
bun --cwd apps/web test
```

Esperado: todos os testes passam (não só os de checkout).

- [ ] **Step 6.3: Auditoria de queries de catálogo (spec exige)**

```bash
grep -n "SUM(sl.quantity)\|SUM(\${stockLevel" packages/db/src/queries/catalog.ts
```

Esperado: 3 ocorrências em `getTools`, `getToolBySlug`, `getActivePromotions` (linhas 344-349, 552-558, 779-784). Nenhuma referência a `branch.is_default` ou filtro por `branch_id`.

Confirma que catálogo já agrega corretamente e não precisa de mudança.

- [ ] **Step 6.4: Smoke manual de checkout**

```bash
bun run dev:web
```

No browser:
1. Abrir `http://localhost:3001/`.
2. Navegar para `/catalog`, escolher um produto que tenha estoque agregado > 0.
3. Adicionar ao carrinho.
4. Ir para `/checkout`, preencher dados, submeter.
5. Confirmar que pedido é criado sem erro.

Via MCP Supabase, validar:

```sql
SELECT id, number, branch_id, status, created_at
FROM "order"
ORDER BY created_at DESC
LIMIT 1;
```

Esperado: `branch_id IS NULL`, `status = 'pending_payment'`.

```sql
SELECT COUNT(*) FROM stock_movement
WHERE order_id = (SELECT id FROM "order" ORDER BY created_at DESC LIMIT 1);
```

Esperado: `count = 0`.

Parar `bun run dev:web` (Ctrl+C).

- [ ] **Step 6.5: Sem commit nesta task**

Task 6 é só verificação. Nada a commitar.

---

## Pós-conclusão

- [ ] **Pós 1: Reportar ao user**

Resumir:
- Arquivos alterados (lista).
- 7 testes passando.
- ADR-0003 criado, ADR-0001 marcado superseded.
- Próximo passo recomendado: push + abrir PR.

- [ ] **Pós 2: Sugerir issue de follow-up**

Recomendar abrir issue separado para "Integração de pagamento + `confirmPayment()` (débito de estoque na transição `paid`)". Esse é o escopo prematuro deste plano, deixado explicitamente para depois.

---

## Non-goals (não fazer neste plano)

- **NÃO** mexer em `packages/db/src/queries/catalog.ts` (já agrega corretamente).
- **NÃO** mexer em schemas Drizzle (`order.branch_id` e `stock_movement.branch_id` já são nullable).
- **NÃO** gerar migration nova (sem mudança de schema).
- **NÃO** criar feature flag — sequenciamento manual (dashboard primeiro) é suficiente.
- **NÃO** migrar `branch_id` retroativamente em pedidos antigos.
- **NÃO** implementar `confirmPayment()` ou lógica de transição para `paid` — escopo do issue futuro de integração de pagamento.
- **NÃO** integrar gateway de pagamento (Asaas, PIX, etc.) — fora de escopo.
