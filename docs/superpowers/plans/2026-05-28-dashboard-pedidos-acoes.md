# Dashboard de Pedidos — Ações (Plano 2) Implementation Plan

> **Status em 2026-09-28:** implementado (PR #36, commit `a3d62d2`), com o pagamento como stub por desenho. Cancelar, comprar novamente e avaliar vivem em `apps/web/src/app/dashboard/pedidos/_actions/{orders,reviews}.ts`; `/pagar` e o download de NF-e existem em `pedidos/[id]/pagar/` e `pedidos/[id]/_components/order-documents.tsx`. Não há integração Asaas: `payment-methods.tsx` ainda usa dados mock (`TODO(asaas)`).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar as ações do pedido funcionais — cancelar, comprar novamente, avaliar (por item) — e desenhar o stub do fluxo de pagamento Asaas + download de NF-e, reintroduzindo os botões por status (hoje ocultos pelo Plano 1).

**Architecture:** Server actions (`"use server"`) com guarda de sessão + Zod + `ActionResult`, no padrão de `dados-pessoais/_actions/addresses.ts`. Mutações em `order`/`orderStatusHistory`/`review` usam `actorType='system'` (cliente não é staff). "Comprar novamente" busca preço/estoque atuais no servidor e o cliente adiciona ao cart (store client-side existente). O pagamento é um **stub visual** pronto pro Asaas (sem confirmação real — pedido segue `pending_payment`).

**Tech Stack:** Next 16 (RSC + Server Actions + typedRoutes), Drizzle, Zod, shadcn Sheet/Tabs (Base UI), sonner, `@emach/db/queries/reviews` (`canCreateReview`).

**Spec:** `docs/superpowers/specs/2026-05-28-dashboard-pedidos-design.md` (§3.5–3.7, §8, §9). Depende do Plano 1 (`@/lib/orders/*`).

---

## Pré-requisitos e fatos verificados

- `cancelOrderAction`/`createReviewAction`/`rebuyAction` ficam em `apps/web/src/app/dashboard/pedidos/_actions/` (nova pasta). Padrão: `"use server"`, `requireCurrentClient()`, Zod, `ActionResult<T> = { ok: true; data } | { ok: false; error }`, `log.error({ action, ...ctx })` no catch, `revalidatePath`.
- `orderStatusHistory` insert exige `actorType` (`'system'`), `actorUserId` null (CHECK `actor_coherence`), `fromStatus`, `toStatus`, `id` (`crypto.randomUUID()`), `reason`.
- `review` insert: `{ id, toolId, clientId, orderId, rating (1..5), title: string|null, body, status }` — `status` default `'pending'`. Unique `(toolId, clientId, orderId)`.
- `canCreateReview(db, { clientId, orderId, toolId })` de `@emach/db/queries/reviews` retorna `{ ok: true } | { ok: false; reason }` (valida: pago, janela 90d de `paidAt`, item no pedido, não avaliado).
- Cart (client) — `useCart().add(snapshot, qty)`. `CartItemSnapshot = { toolId, variantId, slug, name, sku, voltage, priceAmount, imageUrl, categoryName: string|null, categorySlug: string|null }` (ver `buildCartItem` em `product/[slug]/_components/product-info.tsx`).
- `stockLevel` agrega por `variantId` (`SUM(quantity)`), ver `checkAggregateStock` em `checkout/_lib/place-order.ts`.
- `toolCategory` é M2M (tool↔category). Para o snapshot do cart, pegar 1 categoria (ou null).
- Sheet (`@emach/ui/components/sheet`) exporta: `Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger`.
- `star-rating.tsx` é **read-only** (exibição). A sheet de avaliação precisa de um seletor de estrelas **interativo** próprio (Task 3 inclui um `StarInput`).
- `order.nfeUrl` (string|null) → botão "Baixar nota fiscal".
- Bans (CLAUDE.md): `console.*`, `: any`/`as any`, `key={index}`, raw `<img>`, `forwardRef`, manual memo, barrel files, `target="_blank"` sem `rel="noopener"`.

_Nota 2026-09-28: divergências do código atual em relação a estes fatos._
- _O hook é `useCartActions()` de `@/lib/cart-context` (o `rebuy-button.tsx` usa `add` dele), não `useCart()`._
- _`product-info.tsx` e `star-rating.tsx` estão em `apps/web/src/app/(shop)/product/[slug]/_components/`, e o carrinho é `apps/web/src/app/(shop)/cart`._
- _`cancelOrderAction` mudou no #227: transação, `status` no `WHERE` do `UPDATE` e devolução do uso do cupom. O trecho do Task 1 abaixo é o original._
- _`requestRefundAction` vive em `app/dashboard/pedidos/_actions/refunds.ts` e importa o `ActionResult` sem `data` de `lib/actions/types.ts`; `orders.ts` ainda declara o próprio `ActionResult<T>`._

---

## File Structure

**Criar:**
- `apps/web/src/app/dashboard/pedidos/_actions/orders.ts` — `cancelOrderAction`, `rebuyAction` (+ tipos).
- `apps/web/src/app/dashboard/pedidos/_actions/reviews.ts` — `createReviewAction`.
- `apps/web/src/lib/orders/rebuy-query.ts` — helper de leitura para o rebuy (preço/estoque/imagem/categoria atuais).
- `apps/web/src/app/dashboard/pedidos/[id]/_components/rebuy-button.tsx` — client; chama `rebuyAction` e popula o cart.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/cancel-order-button.tsx` — client; chama `cancelOrderAction` com confirmação.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/review-sheet.tsx` — client; sheet com `StarInput` + form, chama `createReviewAction`.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/review-item-button.tsx` — client island por item ("Avaliar"/"Avaliado").
- `apps/web/src/app/dashboard/pedidos/[id]/pagar/page.tsx` — RSC, valida pedido pendente.
- `apps/web/src/app/dashboard/pedidos/[id]/pagar/_components/payment-methods.tsx` — client; tabs Pix/Boleto/Cartão (stub).

**Modificar:**
- `apps/web/src/lib/orders/queries.ts` — `getClientOrderDetail` passa a incluir `reviewedToolIds: string[]` (itens já avaliados pelo client neste pedido) e o `OrderDetailData` ganha o campo.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/order-actions.tsx` — reintroduz botões por status (cancelar/pagar/rebuy) + NF-e.
- `apps/web/src/app/dashboard/pedidos/[id]/page.tsx` — passa `order` + `reviewedToolIds` ao OrderActions/OrderItems.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/order-items.tsx` — renderiza `ReviewItemButton` por item quando elegível.
- `apps/web/src/app/dashboard/pedidos/_components/order-card.tsx` — botões por status na lista (cancelar/pagar/rebuy + Ver detalhes).

---

## Task 1: `cancelOrderAction`

**Files:**
- Create: `apps/web/src/app/dashboard/pedidos/_actions/orders.ts`

- [ ] **Step 1: Implementar a action (parte 1 — cancelar)**

```ts
// apps/web/src/app/dashboard/pedidos/_actions/orders.ts
"use server";

import { db } from "@emach/db";
import { order, orderStatusHistory } from "@emach/db/schema/orders";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { log } from "@/lib/evlog";
import { requireCurrentClient } from "@/lib/session";

export type ActionResult<T = undefined> =
	| { ok: true; data: T }
	| { ok: false; error: string };

const CANCELABLE = new Set(["pending_payment", "payment_failed"]);

const orderIdSchema = z.object({ orderId: z.string().min(1) });

export async function cancelOrderAction(
	raw: { orderId: string }
): Promise<ActionResult> {
	const parsed = orderIdSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "ID inválido" };
	}
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { orderId } = parsed.data;

	try {
		const result = await db.transaction(async (tx) => {
			const [row] = await tx
				.select({ id: order.id, status: order.status })
				.from(order)
				.where(and(eq(order.id, orderId), eq(order.clientId, clientId)))
				.limit(1);
			if (!row) {
				return { ok: false as const, error: "Pedido não encontrado" };
			}
			if (!CANCELABLE.has(row.status)) {
				return {
					ok: false as const,
					error: "Este pedido não pode mais ser cancelado",
				};
			}

			await tx
				.update(order)
				.set({ status: "canceled", canceledAt: new Date() })
				.where(eq(order.id, orderId));

			await tx.insert(orderStatusHistory).values({
				id: crypto.randomUUID(),
				orderId,
				fromStatus: row.status,
				toStatus: "canceled",
				actorType: "system",
				actorUserId: null,
				reason: "Cancelado pelo cliente",
			});

			return { ok: true as const, data: undefined };
		});

		if (result.ok) {
			revalidatePath("/dashboard/pedidos");
			revalidatePath(`/dashboard/pedidos/${orderId}`);
		}
		return result;
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({ action: "cancel_order_failed", clientId, orderId, error: message });
		return { ok: false, error: "Não foi possível cancelar o pedido" };
	}
}
```

- [ ] **Step 2: Type-check** — `bun check-types` → 0 erros.
- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/pedidos/_actions/orders.ts
git commit -m "feat: action de cancelar pedido"
```

---

## Task 2: `rebuyAction` + helper de leitura

**Files:**
- Create: `apps/web/src/lib/orders/rebuy-query.ts`
- Modify: `apps/web/src/app/dashboard/pedidos/_actions/orders.ts` (adiciona `rebuyAction`)

- [ ] **Step 1: Helper de leitura `rebuy-query.ts`**

```ts
// apps/web/src/lib/orders/rebuy-query.ts
import "server-only"; // remover se o pacote não existir (Plano 1 confirmou ausência) -> então NÃO incluir esta linha
import { db } from "@emach/db";
import { category, toolCategory } from "@emach/db/schema/categories";
import { stockLevel } from "@emach/db/schema/inventory";
import { orderItem } from "@emach/db/schema/orders";
import { tool, toolImage, toolVariant } from "@emach/db/schema/tools";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

export interface RebuyItem {
	toolId: string;
	variantId: string;
	slug: string;
	name: string;
	sku: string;
	voltage: string | null;
	priceAmount: string;
	imageUrl: string | null;
	categoryName: string | null;
	categorySlug: string | null;
	quantity: number;
	available: boolean;
}

export async function getRebuyItems(
	clientId: string,
	orderId: string
): Promise<RebuyItem[] | null> {
	// valida ownership via orderItem -> order (uma query)
	const items = await db
		.select({
			toolId: orderItem.toolId,
			variantId: orderItem.variantId,
			quantity: orderItem.quantity,
		})
		.from(orderItem)
		.innerJoin(
			// junta ao próprio order p/ garantir ownership
			sql`"order"`,
			sql`"order"."id" = ${orderItem.orderId} AND "order"."client_id" = ${clientId} AND "order"."id" = ${orderId}`
		);
	if (items.length === 0) {
		return null;
	}

	const variantIds = items.map((i) => i.variantId);
	const toolIds = Array.from(new Set(items.map((i) => i.toolId)));

	const [variants, tools, images, cats, stock] = await Promise.all([
		db
			.select({
				id: toolVariant.id,
				sku: toolVariant.sku,
				voltage: toolVariant.voltage,
				priceAmount: toolVariant.priceAmount,
			})
			.from(toolVariant)
			.where(inArray(toolVariant.id, variantIds)),
		db
			.select({ id: tool.id, name: tool.name, slug: tool.slug })
			.from(tool)
			.where(inArray(tool.id, toolIds)),
		db
			.select({ toolId: toolImage.toolId, url: toolImage.url })
			.from(toolImage)
			.where(inArray(toolImage.toolId, toolIds))
			.orderBy(asc(toolImage.toolId), asc(toolImage.sortOrder)),
		db
			.select({
				toolId: toolCategory.toolId,
				name: category.name,
				slug: category.slug,
			})
			.from(toolCategory)
			.innerJoin(category, eq(category.id, toolCategory.categoryId))
			.where(inArray(toolCategory.toolId, toolIds)),
		db
			.select({
				variantId: stockLevel.variantId,
				total: sql<number>`COALESCE(SUM(${stockLevel.quantity}), 0)::int`,
			})
			.from(stockLevel)
			.where(inArray(stockLevel.variantId, variantIds))
			.groupBy(stockLevel.variantId),
	]);

	const variantById = new Map(variants.map((v) => [v.id, v]));
	const toolById = new Map(tools.map((t) => [t.id, t]));
	const imageByTool = new Map<string, string>();
	for (const im of images) {
		if (!imageByTool.has(im.toolId)) {
			imageByTool.set(im.toolId, im.url);
		}
	}
	const catByTool = new Map<string, { name: string; slug: string | null }>();
	for (const c of cats) {
		if (!catByTool.has(c.toolId)) {
			catByTool.set(c.toolId, { name: c.name, slug: c.slug });
		}
	}
	const stockByVariant = new Map(stock.map((s) => [s.variantId, s.total]));

	return items.map((i) => {
		const v = variantById.get(i.variantId);
		const t = toolById.get(i.toolId);
		const cat = catByTool.get(i.toolId) ?? null;
		const total = stockByVariant.get(i.variantId) ?? 0;
		return {
			toolId: i.toolId,
			variantId: i.variantId,
			slug: t?.slug ?? i.toolId,
			name: t?.name ?? "Produto",
			sku: v?.sku ?? "",
			voltage: v?.voltage ?? null,
			priceAmount: v?.priceAmount ?? "0",
			imageUrl: imageByTool.get(i.toolId) ?? null,
			categoryName: cat?.name ?? null,
			categorySlug: cat?.slug ?? null,
			quantity: i.quantity,
			available: Boolean(v) && total >= i.quantity,
		};
	});
}
```

> NÃO inclua `import "server-only"` (o Plano 1 confirmou que o pacote não está instalado). A primeira linha do bloco acima é uma instrução, não código — comece o arquivo direto pelos imports reais. Se o join inline via `sql\`"order"\`` der atrito de tipagem, troque por: buscar `order` por `(id, clientId)` primeiro (retorna null se não existe), depois `orderItem` por `orderId` — duas queries, mesma garantia de ownership (padrão idêntico ao `getClientOrderDetail`). **Prefira a versão de duas queries** por clareza.

- [ ] **Step 2: `rebuyAction` em `_actions/orders.ts`** (append)

```ts
// adicionar ao topo de _actions/orders.ts:
import { getRebuyItems } from "@/lib/orders/rebuy-query";

export interface RebuySnapshot {
	toolId: string;
	variantId: string;
	slug: string;
	name: string;
	sku: string;
	voltage: string | null;
	priceAmount: string;
	imageUrl: string | null;
	categoryName: string | null;
	categorySlug: string | null;
	quantity: number;
}

export async function rebuyAction(
	raw: { orderId: string }
): Promise<ActionResult<{ items: RebuySnapshot[]; skipped: number }>> {
	const parsed = orderIdSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "ID inválido" };
	}
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { orderId } = parsed.data;

	try {
		const rows = await getRebuyItems(clientId, orderId);
		if (rows === null) {
			return { ok: false, error: "Pedido não encontrado" };
		}
		const available = rows.filter((r) => r.available);
		const items: RebuySnapshot[] = available.map((r) => ({
			toolId: r.toolId,
			variantId: r.variantId,
			slug: r.slug,
			name: r.name,
			sku: r.sku,
			voltage: r.voltage,
			priceAmount: r.priceAmount,
			imageUrl: r.imageUrl,
			categoryName: r.categoryName,
			categorySlug: r.categorySlug,
			quantity: r.quantity,
		}));
		if (items.length === 0) {
			return { ok: false, error: "Nenhum item disponível para recompra" };
		}
		return { ok: true, data: { items, skipped: rows.length - items.length } };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({ action: "rebuy_failed", clientId, orderId, error: message });
		return { ok: false, error: "Não foi possível montar a recompra" };
	}
}
```

- [ ] **Step 3: Type-check + commit**

```bash
bun check-types
git add apps/web/src/lib/orders/rebuy-query.ts apps/web/src/app/dashboard/pedidos/_actions/orders.ts
git commit -m "feat: action de comprar novamente"
```

---

## Task 3: Avaliação — action + sheet + estado por item

**Files:**
- Create: `apps/web/src/app/dashboard/pedidos/_actions/reviews.ts`
- Modify: `apps/web/src/lib/orders/queries.ts` (incluir `reviewedToolIds`)
- Create: `apps/web/src/app/dashboard/pedidos/[id]/_components/review-sheet.tsx`
- Create: `apps/web/src/app/dashboard/pedidos/[id]/_components/review-item-button.tsx`

- [ ] **Step 1: `createReviewAction`**

```ts
// apps/web/src/app/dashboard/pedidos/_actions/reviews.ts
"use server";

import { db } from "@emach/db";
import { canCreateReview } from "@emach/db/queries/reviews";
import { review } from "@emach/db/schema/reviews";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { log } from "@/lib/evlog";
import { requireCurrentClient } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
	orderId: z.string().min(1),
	toolId: z.string().min(1),
	rating: z.number().int().min(1).max(5),
	title: z.string().trim().max(120).optional(),
	body: z.string().trim().min(3, "Escreva sua avaliação").max(2000),
});

const REASON_MESSAGE: Record<string, string> = {
	order_not_found: "Pedido não encontrado",
	order_not_owned_by_client: "Pedido não encontrado",
	not_paid: "Só é possível avaliar pedidos pagos",
	window_expired: "O prazo de avaliação (90 dias) expirou",
	tool_not_in_order: "Produto não está neste pedido",
	already_reviewed: "Você já avaliou este produto",
};

export async function createReviewAction(raw: {
	orderId: string;
	toolId: string;
	rating: number;
	title?: string;
	body: string;
}): Promise<ActionResult> {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { orderId, toolId, rating, title, body } = parsed.data;

	try {
		const can = await canCreateReview(db, { clientId, orderId, toolId });
		if (!can.ok) {
			return { ok: false, error: REASON_MESSAGE[can.reason] ?? "Não permitido" };
		}
		await db.insert(review).values({
			id: crypto.randomUUID(),
			toolId,
			clientId,
			orderId,
			rating,
			title: title || null,
			body,
			status: "pending",
		});
		revalidatePath(`/dashboard/pedidos/${orderId}`);
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({ action: "create_review_failed", clientId, orderId, toolId, error: message });
		return { ok: false, error: "Não foi possível enviar a avaliação" };
	}
}
```

- [ ] **Step 2: `getClientOrderDetail` inclui `reviewedToolIds`**

Em `apps/web/src/lib/orders/queries.ts`: importar `review` de `@emach/db/schema/reviews`; adicionar `reviewedToolIds: string[]` à interface `OrderDetailData`; na função, após buscar `items`, rodar:

```ts
import { review } from "@emach/db/schema/reviews";
// ...dentro de getClientOrderDetail, antes do return:
const reviewed = await db
	.select({ toolId: review.toolId })
	.from(review)
	.where(and(eq(review.orderId, orderId), eq(review.clientId, clientId)));
const reviewedToolIds = reviewed.map((r) => r.toolId);
// incluir reviewedToolIds no objeto retornado
```

- [ ] **Step 3: `StarInput` + `review-sheet.tsx`** (client; seletor de estrelas interativo)

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/_components/review-sheet.tsx
"use client";

import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@emach/ui/components/sheet";
import { cn } from "@emach/ui/lib/utils";
import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmachButton } from "@/components/emach-button";
import { createReviewAction } from "../../_actions/reviews";

const STARS = [1, 2, 3, 4, 5] as const;

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
	const [hover, setHover] = useState(0);
	return (
		<div className="flex gap-1" onMouseLeave={() => setHover(0)}>
			{STARS.map((n) => (
				<button
					aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
					className="p-0.5"
					key={n}
					onClick={() => onChange(n)}
					onMouseEnter={() => setHover(n)}
					type="button"
				>
					<Star
						className={cn(
							"h-7 w-7 transition-colors",
							(hover || value) >= n ? "fill-emach-red text-emach-red" : "text-gray-40"
						)}
						strokeWidth={1.5}
					/>
				</button>
			))}
		</div>
	);
}

export function ReviewSheet({
	open,
	onOpenChange,
	orderId,
	toolId,
	productName,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	orderId: string;
	toolId: string;
	productName: string;
}) {
	const [rating, setRating] = useState(0);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [pending, startTransition] = useTransition();

	function submit() {
		if (rating < 1) {
			toast.error("Escolha uma nota");
			return;
		}
		startTransition(async () => {
			const res = await createReviewAction({ orderId, toolId, rating, title, body });
			if (res.ok) {
				toast.success("Avaliação enviada para moderação");
				onOpenChange(false);
				setRating(0);
				setTitle("");
				setBody("");
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent className="flex flex-col gap-0" side="right">
				<SheetHeader>
					<SheetTitle className="font-display">Avaliar produto</SheetTitle>
				</SheetHeader>
				<div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
					<div className="font-semibold text-[14px] text-near-black">{productName}</div>
					<div>
						<div className="mb-2 font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">Sua nota</div>
						<StarInput onChange={setRating} value={rating} />
					</div>
					<label className="block">
						<span className="mb-1.5 block font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">Título (opcional)</span>
						<input
							className="h-10 w-full border border-border px-3 text-[14px] outline-none focus:border-near-black"
							maxLength={120}
							onChange={(e) => setTitle(e.target.value)}
							value={title}
						/>
					</label>
					<label className="block">
						<span className="mb-1.5 block font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">Sua avaliação</span>
						<textarea
							className="min-h-[120px] w-full border border-border p-3 text-[14px] outline-none focus:border-near-black"
							maxLength={2000}
							onChange={(e) => setBody(e.target.value)}
							value={body}
						/>
					</label>
				</div>
				<SheetFooter className="flex-row gap-2">
					<SheetClose asChild>
						<EmachButton size="md" variant="ghost">Cancelar</EmachButton>
					</SheetClose>
					<EmachButton disabled={pending} onClick={submit} size="md" variant="primary">
						{pending ? "Enviando..." : "Enviar avaliação"}
					</EmachButton>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
```

> Verificar a API exata de `Sheet`/`SheetContent` (prop `side`, `asChild` em `SheetClose`) lendo `packages/ui/src/components/sheet.tsx` antes de finalizar; ajustar props ao que o componente expõe. `EmachButton` aceita `disabled`? Conferir em `@/components/emach-button`; se não, usar `aria-disabled` + guard no handler.

- [ ] **Step 4: `review-item-button.tsx`** (island por item)

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/_components/review-item-button.tsx
"use client";

import { useState } from "react";
import { EmachButton } from "@/components/emach-button";
import { ReviewSheet } from "./review-sheet";

export function ReviewItemButton({
	orderId,
	toolId,
	productName,
	reviewed,
}: {
	orderId: string;
	toolId: string;
	productName: string;
	reviewed: boolean;
}) {
	const [open, setOpen] = useState(false);
	if (reviewed) {
		return <span className="font-semibold text-[12px] text-success">Avaliado ✓</span>;
	}
	return (
		<>
			<EmachButton onClick={() => setOpen(true)} size="sm" variant="outline">
				Avaliar
			</EmachButton>
			<ReviewSheet
				onOpenChange={setOpen}
				open={open}
				orderId={orderId}
				productName={productName}
				toolId={toolId}
			/>
		</>
	);
}
```

- [ ] **Step 5: Type-check + commit**

```bash
bun check-types && bunx biome check apps/web/src/app/dashboard/pedidos apps/web/src/lib/orders
git add apps/web/src/app/dashboard/pedidos/_actions/reviews.ts apps/web/src/lib/orders/queries.ts "apps/web/src/app/dashboard/pedidos/[id]/_components/review-sheet.tsx" "apps/web/src/app/dashboard/pedidos/[id]/_components/review-item-button.tsx"
git commit -m "feat: avaliação de produto por item (sheet)"
```

---

## Task 4: Stub de pagamento Asaas (`/pagar`)

**Files:**
- Create: `apps/web/src/app/dashboard/pedidos/[id]/pagar/page.tsx`
- Create: `apps/web/src/app/dashboard/pedidos/[id]/pagar/_components/payment-methods.tsx`

- [ ] **Step 1: RSC `pagar/page.tsx`** (valida pedido pendente do client)

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/pagar/page.tsx
import { notFound, redirect } from "next/navigation";
import { getClientOrderDetail } from "@/lib/orders/queries";
import { requireCurrentClient } from "@/lib/session";
import { PaymentMethods } from "./_components/payment-methods";

export default async function PagarPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const session = await requireCurrentClient();
	const detail = await getClientOrderDetail(session.user.id, id);
	if (!detail) {
		notFound();
	}
	const { order } = detail;
	if (order.status !== "pending_payment" && order.status !== "payment_failed") {
		redirect(`/dashboard/pedidos/${id}`);
	}
	return (
		<div className="mx-auto max-w-[760px]">
			<h1 className="mb-1 font-display font-medium text-[32px] leading-none">
				Pagamento
			</h1>
			<p className="mb-7 text-[13px] text-gray-60">Pedido #{order.number}</p>
			<PaymentMethods
				orderNumber={order.number}
				subtotal={order.subtotalAmount}
				shipping={order.shippingAmount}
				total={order.totalAmount}
			/>
		</div>
	);
}
```

- [ ] **Step 2: `payment-methods.tsx`** (client; tabs Pix/Boleto/Cartão — dados mock, pronto pro Asaas)

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/pagar/_components/payment-methods.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@emach/ui/components/tabs";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { fmtNumericBRL } from "@/lib/format";

// TODO(asaas): trocar os dados mock por cobrança real gerada via Asaas
// (Pix copia-e-cola + QR, linha digitável do boleto, tokenização do cartão).
// O webhook do Asaas confirma o pagamento e muda o status para "paid".
const MOCK_PIX = "00020126580014br.gov.bcb.pix0136mock-emach-asaas-pendente5204000053039865802BR";
const MOCK_BOLETO = "23793.38128 60007.827136 42000.063305 9 00000000000000";

export function PaymentMethods({
	orderNumber,
	subtotal,
	shipping,
	total,
}: {
	orderNumber: string;
	subtotal: string;
	shipping: string;
	total: string;
}) {
	const copy = (text: string, label: string) => async () => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${label} copiado`);
		} catch {
			toast.error("Não foi possível copiar");
		}
	};

	return (
		<div className="grid gap-6 md:grid-cols-[1fr_260px]">
			<Tabs defaultValue="pix">
				<TabsList variant="line">
					<TabsTrigger value="pix">Pix</TabsTrigger>
					<TabsTrigger value="boleto">Boleto</TabsTrigger>
					<TabsTrigger value="cartao">Cartão</TabsTrigger>
				</TabsList>

				<TabsContent className="pt-5" value="pix">
					<div className="flex flex-col items-center gap-4 border border-border p-6">
						<div className="emach-bg-placeholder h-40 w-40" aria-label="QR Code Pix (stub)" />
						<p className="text-center text-[12px] text-gray-60">Escaneie o QR ou copie o código abaixo</p>
						<div className="flex w-full gap-2">
							<code className="min-w-0 flex-1 truncate border border-border bg-gray-10 px-3 py-2 font-mono text-[11px]">{MOCK_PIX}</code>
							<button className="inline-flex items-center gap-1.5 border border-near-black px-3 text-[12px] hover:bg-near-black hover:text-white" onClick={copy(MOCK_PIX, "Código Pix")} type="button">
								<Copy className="h-3.5 w-3.5" /> Copiar
							</button>
						</div>
					</div>
				</TabsContent>

				<TabsContent className="pt-5" value="boleto">
					<div className="space-y-4 border border-border p-6">
						<p className="text-[12px] text-gray-60">Linha digitável (compensação em 1-2 dias úteis):</p>
						<div className="flex gap-2">
							<code className="min-w-0 flex-1 truncate border border-border bg-gray-10 px-3 py-2 font-mono text-[12px]">{MOCK_BOLETO}</code>
							<button className="inline-flex items-center gap-1.5 border border-near-black px-3 text-[12px] hover:bg-near-black hover:text-white" onClick={copy(MOCK_BOLETO, "Linha digitável")} type="button">
								<Copy className="h-3.5 w-3.5" /> Copiar
							</button>
						</div>
					</div>
				</TabsContent>

				<TabsContent className="pt-5" value="cartao">
					<div className="space-y-3 border border-border p-6">
						<input className="h-10 w-full border border-border px-3 text-[14px]" disabled placeholder="Número do cartão" />
						<div className="flex gap-3">
							<input className="h-10 w-full border border-border px-3 text-[14px]" disabled placeholder="Validade" />
							<input className="h-10 w-full border border-border px-3 text-[14px]" disabled placeholder="CVV" />
						</div>
						<p className="text-[12px] text-gray-50">Pagamento com cartão estará disponível em breve.</p>
					</div>
				</TabsContent>
			</Tabs>

			<aside className="h-fit border border-border bg-gray-10 p-4 text-[13px]">
				<div className="mb-3 font-display font-semibold text-[11px] uppercase tracking-[0.12em]">Resumo</div>
				<div className="flex justify-between py-1"><span className="text-gray-60">Pedido</span><span>#{orderNumber}</span></div>
				<div className="flex justify-between py-1"><span className="text-gray-60">Subtotal</span><span>{fmtNumericBRL(subtotal)}</span></div>
				<div className="flex justify-between py-1"><span className="text-gray-60">Frete</span><span>{Number(shipping) === 0 ? "Grátis" : fmtNumericBRL(shipping)}</span></div>
				<div className="mt-2 flex justify-between border-near-black border-t pt-2 font-bold"><span>Total</span><span>{fmtNumericBRL(total)}</span></div>
			</aside>
		</div>
	);
}
```

> Confirmar a API do `Tabs`/`TabsTrigger`/`TabsContent` (`variant="line"` já usado no Plano 1) e a classe `emach-bg-placeholder`/`text-gray-40` existem. `disabled` em `<input>` é HTML nativo — ok.

- [ ] **Step 3: Type-check + biome + commit**

```bash
bun check-types && bunx biome check apps/web/src/app/dashboard/pedidos
git add "apps/web/src/app/dashboard/pedidos/[id]/pagar/"
git commit -m "feat: stub de pagamento Asaas (Pix/Boleto/Cartão)"
```

---

## Task 5: Reintroduzir ações por status (detalhe + lista + NF-e)

**Files:**
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/order-actions.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/page.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/order-items.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/_components/order-card.tsx`

- [ ] **Step 1: `cancel-order-button.tsx` + `rebuy-button.tsx`** (clients)

```tsx
// cancel-order-button.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmachButton } from "@/components/emach-button";
import { cancelOrderAction } from "../../_actions/orders";

export function CancelOrderButton({ orderId }: { orderId: string }) {
	const [confirming, setConfirming] = useState(false);
	const [pending, start] = useTransition();
	const router = useRouter();
	function onClick() {
		if (!confirming) {
			setConfirming(true);
			return;
		}
		start(async () => {
			const res = await cancelOrderAction({ orderId });
			if (res.ok) {
				toast.success("Pedido cancelado");
				router.refresh();
			} else {
				toast.error(res.error);
				setConfirming(false);
			}
		});
	}
	return (
		<EmachButton disabled={pending} onClick={onClick} size="sm" variant="ghost">
			{confirming ? "Confirmar cancelamento?" : "Cancelar pedido"}
		</EmachButton>
	);
}
```

```tsx
// rebuy-button.tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { EmachButton } from "@/components/emach-button";
import { useCart } from "@/lib/cart-context";
import { rebuyAction } from "../../_actions/orders";

export function RebuyButton({ orderId, variant = "outline" }: { orderId: string; variant?: "outline" | "primary" | "ghost" }) {
	const { add } = useCart();
	const [pending, start] = useTransition();
	const router = useRouter();
	function onClick() {
		start(async () => {
			const res = await rebuyAction({ orderId });
			if (!res.ok) {
				toast.error(res.error);
				return;
			}
			for (const item of res.data.items) {
				const { quantity, ...snapshot } = item;
				add(snapshot, quantity);
			}
			if (res.data.skipped > 0) {
				toast.info(`${res.data.skipped} item(ns) indisponível(is) não foram adicionados`);
			}
			toast.success("Itens adicionados ao carrinho");
			router.push("/cart");
		});
	}
	return (
		<EmachButton disabled={pending} onClick={onClick} size="sm" variant={variant}>
			Comprar novamente
		</EmachButton>
	);
}
```

> `/cart` é a rota do carrinho (confirmar; o checkout usa `router.push("/checkout")` e existe `app/cart/`). `RebuySnapshot` tem `quantity` — o destructure separa antes de `add(snapshot, quantity)` para casar com `CartItemSnapshot` (sem `quantity`).

- [ ] **Step 2: `order-actions.tsx`** — botões por status + NF-e

```tsx
// order-actions.tsx
import type { OrderStatus } from "@emach/db/schema/orders";
import type { Route } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { emachButtonVariants } from "@/components/emach-button";
import { CancelOrderButton } from "./cancel-order-button";
import { RebuyButton } from "./rebuy-button";

export function OrderActions({
	orderId,
	status,
	nfeUrl,
}: {
	orderId: string;
	status: OrderStatus;
	nfeUrl: string | null;
}) {
	const pagarHref = `/dashboard/pedidos/${orderId}/pagar` as Route;
	const isPending = status === "pending_payment" || status === "payment_failed";
	const canRebuy = status === "delivered" || status === "canceled" || status === "refunded" || status === "returned";

	const buttons: React.ReactNode[] = [];
	if (nfeUrl) {
		buttons.push(
			<a className={emachButtonVariants({ variant: "ghost", size: "sm" })} href={nfeUrl} key="nfe" rel="noopener" target="_blank">
				<Download className="mr-1.5 h-3.5 w-3.5" /> Nota fiscal
			</a>
		);
	}
	if (isPending) {
		buttons.push(<CancelOrderButton key="cancel" orderId={orderId} />);
		buttons.push(
			<Link className={emachButtonVariants({ variant: "primary", size: "sm" })} href={pagarHref} key="pay">
				Pagar agora
			</Link>
		);
	} else if (canRebuy) {
		buttons.push(<RebuyButton key="rebuy" orderId={orderId} variant="primary" />);
	}

	if (buttons.length === 0) {
		return null;
	}
	return <div className="mt-6 flex flex-wrap justify-end gap-2">{buttons}</div>;
}
```

- [ ] **Step 3: detalhe — `page.tsx`** passa props ao OrderActions + reviewedToolIds ao OrderItems

Adicionar import `OrderActions`; renderizar `<OrderActions nfeUrl={order.nfeUrl} orderId={order.id} status={order.status} />` após `<OrderTracking>`. Passar `reviewedToolIds`, `orderId`, `status` ao `<OrderItems>` (próximo step).

- [ ] **Step 4: `order-items.tsx`** — botão "Avaliar"/"Avaliado" por item quando elegível

Adicionar props `orderId: string`, `status: OrderStatus`, `reviewedToolIds: string[]`. Quando `status === "delivered"`, renderizar à direita de cada item um `<ReviewItemButton orderId={orderId} toolId={item.toolId} productName={item.name} reviewed={reviewedToolIds.includes(item.toolId)} />` (client island). O componente continua Server Component (o island é client).

> Nota: `canCreateReview` valida a janela de 90d no servidor (action). A UI mostra "Avaliar" para itens não avaliados de pedidos `delivered`; se a janela expirou, a action retorna erro amigável. (Opcional: ocultar o botão usando `paidAt` + 90d no server — fora do escopo mínimo.)

- [ ] **Step 5: lista — `order-card.tsx`** botões por status

Reintroduzir footer com botões conforme status (espelha order-actions, tamanho `sm`): `pending_payment`/`payment_failed` → CancelOrderButton + Link "Pagar agora" + "Ver detalhes"; `delivered`/terminais → RebuyButton + "Ver detalhes"; demais → só "Ver detalhes". O card volta a misturar Server (estrutura) + client islands (botões) — manter o card como Server Component e usar os botões client como islands (não readicionar `"use client"` ao card).

- [ ] **Step 6: Verificação**

```bash
bun check-types && bunx biome check apps/web/src/app/dashboard/pedidos
```
Smoke (`bun dev:web`): cancelar um pedido pendente (status muda, histórico ganha entrada), "comprar novamente" (vai pro /cart com itens), abrir sheet de avaliação e enviar (review pending criado; item vira "Avaliado"), `/pagar` mostra os 3 métodos, botão NF-e aparece quando `nfeUrl` presente.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/dashboard/pedidos/[id]/_components/" "apps/web/src/app/dashboard/pedidos/[id]/page.tsx" apps/web/src/app/dashboard/pedidos/_components/order-card.tsx
git commit -m "feat: reintroduzir ações do pedido por status + NF-e"
```

---

## Self-Review (ao escrever o plano)

**Cobertura do spec:**
- §3.5 cancelar (pending/failed, statusHistory system) → Task 1 + 5. ✓
- §3.6 stub Asaas Pix/Boleto/Cartão → Task 4. ✓
- §3.7 avaliar por item em sheet, review pending, canCreateReview → Task 3. ✓
- §8 assinaturas das actions → Tasks 1-3. ✓
- §9 comprar novamente (disponíveis ao cart, avisa indisponíveis, vai pro /cart) → Task 2 + 5. ✓
- §9 NF-e quando nfeUrl → Task 5. ✓
- §9 "avaliado" derivado de review existente → Task 3 (reviewedToolIds). ✓

**Placeholders:** Steps 3/4/5 da Task 5 descrevem mudanças em componentes existentes com props explícitas e os componentes-cliente completos nos Steps anteriores; o JSX de wiring é mecânico. Aceitável.

**Consistência de tipos:** `ActionResult`/`RebuySnapshot`/`RebuyItem` definidos e usados de forma consistente. `rebuyAction` retorna `RebuySnapshot[]` (com `quantity`); `RebuyButton` separa `quantity` antes de `add(snapshot, quantity)` (casa com `CartItemSnapshot`). `OrderDetailData.reviewedToolIds` adicionado na Task 3 e consumido na Task 5.

**Riscos a verificar na execução:**
- API exata de `Sheet` (prop `side`, `asChild`) e se `EmachButton` aceita `disabled` → confirmar nos componentes (`packages/ui/src/components/sheet.tsx`, `@/components/emach-button`).
- Rota do carrinho: confirmar `/cart` (existe `app/cart/`).
- `import "server-only"` NÃO deve entrar em `rebuy-query.ts` (pacote ausente — Plano 1).
- Ownership no `getRebuyItems`: preferir a versão de DUAS queries (order por id+clientId, depois orderItem) em vez do join inline com `sql`.
- `canCreateReview` é `async` e recebe `(db, input)` — confirmar a assinatura em `@emach/db/queries/reviews`.
- `emach-bg-placeholder`, `text-gray-40` existem no tema (Plano 1 usou `emach-bg-placeholder`; `gray-40` checar — senão `gray-50`).
```

> Pré-condição de execução: este plano só deve rodar **após** o Plano 1 estar mergeado (ou na mesma branch), pois depende de `@/lib/orders/{status,queries}` e do `order-actions.tsx` já neutralizado.
