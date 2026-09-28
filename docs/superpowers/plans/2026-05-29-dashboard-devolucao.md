# Devolução / Reembolso (client-side) Implementation Plan

> **Status em 2026-09-28:** implementado (PR #39, commit `b753d68`). A lista real de `/dashboard/reembolso`, a sheet de solicitar devolução e `requestRefundAction` existem em `apps/web/src/app/dashboard/reembolso/`, `apps/web/src/app/dashboard/pedidos/[id]/_components/refund-sheet.tsx`, `apps/web/src/app/dashboard/pedidos/_actions/refunds.ts` e `apps/web/src/lib/refunds/`; os mocks foram apagados. O #96 moveu `ACTIVE_REFUND_STATUSES` para `@emach/db/schema/orders`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar a área de devolução/reembolso do cliente (`/dashboard/reembolso` + botão no detalhe do pedido) à tabela real `refund_request`, removendo os mocks.

**Architecture:** RSC lê `refundRequest` do cliente logado via queries inline em `apps/web/src/lib/refunds/*`. Solicitação criada por server action (`actorType='system'`, pois o cliente não é staff `user`). Pedido inteiro (sem itens parciais), categoria simples de motivo, elegível em `shipped`/`delivered`, 1 solicitação ativa por pedido. Pagamento/estorno real do Asaas fica fora de escopo — só o campo `asaasRefundRef` está pronto.

**Tech Stack:** Next.js 16 (RSC + Server Actions), React 19, Drizzle (Postgres/Supabase), Better Auth (`EcommerceSession`), Zod, shadcn (Base UI) Sheet, vitest.

**Contexto de schema (já sincronizado, ver `@emach/db/schema/orders`):**
- `refundReasonEnum` = `defeito | item_errado | avaria_transporte | arrependimento | outro`
- `refundStatusEnum` = `requested | under_review | approved | refunded | rejected`
- `refundRequest`: `id, orderId, clientId, reasonCategory, reasonText, status (default requested), amount, asaasRefundRef, rejectionReason, actorType, actorUserId, requestedAt, resolvedAt, createdAt`. Índice parcial único `refund_request_one_open_per_order` em `orderId WHERE status IN ('requested','under_review')`. CHECK `refund_actor_coherence`.
- Tipos: `RefundRequest`, `NewRefundRequest`, `RefundReason`, `RefundStatus`.

**Mapeamento de status → tab:**
- "Em andamento" (`em_andamento`): `requested`, `under_review`, `approved`
- "Finalizado" (`finalizado`): `refunded`, `rejected`

**Regra de "solicitação ativa":** `requested`, `under_review` **ou** `approved`. O índice parcial do DB só cobre `requested`/`under_review` (backstop de corrida); a app bloqueia também `approved` na elegibilidade.

_Nota 2026-09-28: o índice parcial de hoje (`packages/db/src/schema/orders.ts`) já cobre `approved`, porque o predicado deriva de `ACTIVE_REFUND_STATUSES`. `ACTIVE_REFUND_STATUSES` não é mais definida em `lib/refunds/status.ts` (Task 1): vem de `@emach/db/schema/orders`, e `status.ts` a importa de lá. Os comentários de `refunds.ts` que citam só `requested`/`under_review` estão defasados._

**Arquivos que vão sair (mocks):**
- `apps/web/src/app/dashboard/_lib/mock-refunds.ts` (deletado)
- `apps/web/src/app/dashboard/_lib/types.ts` (tipos de refund mock removidos)

---

## File Structure

**Criar:**
- `apps/web/src/lib/refunds/status.ts` — módulo puro: labels PT, opções de motivo, tabs, mapeamento status→tab, contagem, tone do badge.
- `apps/web/src/lib/refunds/status.test.ts` — testes do módulo puro.
- `apps/web/src/lib/refunds/queries.ts` — queries inline: lista de devoluções do cliente, devolução ativa de um pedido, elegibilidade.
- `apps/web/src/app/dashboard/pedidos/_actions/refunds.ts` — `requestRefundAction`.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/refund-sheet.tsx` — sheet de solicitar devolução.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/request-refund-button.tsx` — botão que abre a sheet.

**Modificar:**
- `apps/web/src/app/dashboard/pedidos/[id]/page.tsx` — buscar devolução ativa + elegibilidade; renderizar botão/bloco.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/order-refund-block.tsx` — tipos reais.
- `apps/web/src/app/dashboard/reembolso/page.tsx` — RSC busca dados reais.
- `apps/web/src/app/dashboard/reembolso/_components/refunds-tabs.tsx` — recebe dados por props.
- `apps/web/src/app/dashboard/reembolso/_components/refund-card.tsx` — tipos reais.
- `apps/web/src/app/dashboard/reembolso/_components/refund-status-badge.tsx` — tipos reais.
- `apps/web/src/app/dashboard/_lib/types.ts` — remover tipos de refund mock.

**Deletar:**
- `apps/web/src/app/dashboard/_lib/mock-refunds.ts`

---

## Task 1: Módulo de status de devolução

**Files:**
- Create: `apps/web/src/lib/refunds/status.ts`
- Test: `apps/web/src/lib/refunds/status.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/src/lib/refunds/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	countRefundsByTab,
	REFUND_REASON_OPTIONS,
	REFUND_STATUS_BADGE,
	statusToRefundTab,
} from "./status";

describe("statusToRefundTab", () => {
	it("agrupa requested/under_review/approved em em_andamento", () => {
		expect(statusToRefundTab("requested")).toBe("em_andamento");
		expect(statusToRefundTab("under_review")).toBe("em_andamento");
		expect(statusToRefundTab("approved")).toBe("em_andamento");
	});

	it("agrupa refunded/rejected em finalizado", () => {
		expect(statusToRefundTab("refunded")).toBe("finalizado");
		expect(statusToRefundTab("rejected")).toBe("finalizado");
	});
});

describe("countRefundsByTab", () => {
	it("conta por tab", () => {
		const counts = countRefundsByTab([
			"requested",
			"approved",
			"refunded",
			"rejected",
			"rejected",
		]);
		expect(counts.em_andamento).toBe(2);
		expect(counts.finalizado).toBe(3);
	});

	it("zera com lista vazia", () => {
		expect(countRefundsByTab([])).toEqual({ em_andamento: 0, finalizado: 0 });
	});
});

describe("REFUND_STATUS_BADGE / REFUND_REASON_OPTIONS", () => {
	it("cobre os 5 status com label e tone", () => {
		for (const s of [
			"requested",
			"under_review",
			"approved",
			"refunded",
			"rejected",
		] as const) {
			expect(REFUND_STATUS_BADGE[s].label.length).toBeGreaterThan(0);
			expect(REFUND_STATUS_BADGE[s].tone.length).toBeGreaterThan(0);
		}
	});

	it("expõe 5 opções de motivo", () => {
		expect(REFUND_REASON_OPTIONS).toHaveLength(5);
	});
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd apps/web && bunx vitest run src/lib/refunds/status.test.ts`
Expected: FAIL com "Cannot find module './status'".

- [ ] **Step 3: Implementar o módulo**

`apps/web/src/lib/refunds/status.ts`:

```ts
import type { RefundReason, RefundStatus } from "@emach/db/schema/orders";

export type RefundBadgeTone =
	| "info"
	| "warning"
	| "progress"
	| "success"
	| "muted";

export const REFUND_STATUS_BADGE: Record<
	RefundStatus,
	{ label: string; tone: RefundBadgeTone }
> = {
	requested: { label: "Solicitado", tone: "info" },
	under_review: { label: "Em análise", tone: "warning" },
	approved: { label: "Aprovado", tone: "progress" },
	refunded: { label: "Reembolsado", tone: "success" },
	rejected: { label: "Recusado", tone: "muted" },
};

export const REFUND_BADGE_TONE_CLASS: Record<RefundBadgeTone, string> = {
	info: "text-link-hover border-link-hover",
	warning: "text-[#B45309] border-[#B45309]",
	progress: "text-near-black border-near-black",
	success: "text-success border-success",
	muted: "text-gray-50 border-border bg-gray-10",
};

export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
	defeito: "Produto com defeito",
	item_errado: "Item errado / diferente do pedido",
	avaria_transporte: "Avaria no transporte",
	arrependimento: "Arrependimento (7 dias)",
	outro: "Outro motivo",
};

// Ordem de exibição no <select> da sheet.
export const REFUND_REASON_OPTIONS = [
	"defeito",
	"item_errado",
	"avaria_transporte",
	"arrependimento",
	"outro",
] as const satisfies readonly RefundReason[];

export const REFUND_TABS = ["em_andamento", "finalizado"] as const;
export type RefundTab = (typeof REFUND_TABS)[number];

export const REFUND_TAB_LABEL: Record<RefundTab, string> = {
	em_andamento: "Em andamento",
	finalizado: "Finalizado",
};

const STATUS_TO_TAB: Record<RefundStatus, RefundTab> = {
	requested: "em_andamento",
	under_review: "em_andamento",
	approved: "em_andamento",
	refunded: "finalizado",
	rejected: "finalizado",
};

export function statusToRefundTab(status: RefundStatus): RefundTab {
	return STATUS_TO_TAB[status];
}

export function countRefundsByTab(
	statuses: RefundStatus[]
): Record<RefundTab, number> {
	const counts: Record<RefundTab, number> = {
		em_andamento: 0,
		finalizado: 0,
	};
	for (const s of statuses) {
		counts[STATUS_TO_TAB[s]] += 1;
	}
	return counts;
}

// Status que contam como "solicitação ativa" — bloqueiam nova solicitação.
export const ACTIVE_REFUND_STATUSES = [
	"requested",
	"under_review",
	"approved",
] as const satisfies readonly RefundStatus[];

export function isActiveRefund(status: RefundStatus): boolean {
	return (ACTIVE_REFUND_STATUSES as readonly RefundStatus[]).includes(status);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd apps/web && bunx vitest run src/lib/refunds/status.test.ts`
Expected: PASS (todos os testes verdes).

- [ ] **Step 5: check-types**

Run: `bun check-types`
Expected: 6/6 successful.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/refunds/status.ts apps/web/src/lib/refunds/status.test.ts
git commit -m "feat: módulo de status de devolução"
```

---

## Task 2: Queries de devolução (inline)

**Files:**
- Create: `apps/web/src/lib/refunds/queries.ts`

- [ ] **Step 1: Implementar as queries**

`apps/web/src/lib/refunds/queries.ts`:

```ts
import { db } from "@emach/db";
import type {
	OrderStatus,
	RefundReason,
	RefundStatus,
} from "@emach/db/schema/orders";
import { order, orderItem, refundRequest } from "@emach/db/schema/orders";
import { toolImage } from "@emach/db/schema/tools";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ACTIVE_REFUND_STATUSES } from "./status";

export interface RefundPreviewItem {
	id: string;
	imageUrl: string | null;
	name: string;
	quantity: number;
	unitPrice: string;
	voltage: string | null;
}

export interface RefundListItem {
	amount: string;
	id: string;
	orderId: string;
	orderNumber: string;
	preview: RefundPreviewItem[];
	reasonCategory: RefundReason;
	reasonText: string | null;
	rejectionReason: string | null;
	requestedAt: Date;
	resolvedAt: Date | null;
	status: RefundStatus;
}

type RefundRequestRow = typeof refundRequest.$inferSelect;

/** Pedido elegível a devolução: enviado ou entregue. */
export function isRefundEligibleStatus(status: OrderStatus): boolean {
	return status === "shipped" || status === "delivered";
}

/** Mapa toolId -> URL da imagem primária (menor sortOrder). */
async function primaryImageByToolId(
	toolIds: string[]
): Promise<Map<string, string>> {
	if (toolIds.length === 0) {
		return new Map();
	}
	const rows = await db
		.select({
			toolId: toolImage.toolId,
			url: toolImage.url,
			sortOrder: toolImage.sortOrder,
		})
		.from(toolImage)
		.where(inArray(toolImage.toolId, toolIds))
		.orderBy(asc(toolImage.toolId), asc(toolImage.sortOrder));
	const map = new Map<string, string>();
	for (const r of rows) {
		if (!map.has(r.toolId)) {
			map.set(r.toolId, r.url);
		}
	}
	return map;
}

/** Devoluções do cliente, mais recentes primeiro, com preview dos itens do pedido. */
export async function listClientRefunds(
	clientId: string
): Promise<RefundListItem[]> {
	const refunds = await db
		.select({
			id: refundRequest.id,
			orderId: refundRequest.orderId,
			orderNumber: order.number,
			status: refundRequest.status,
			reasonCategory: refundRequest.reasonCategory,
			reasonText: refundRequest.reasonText,
			rejectionReason: refundRequest.rejectionReason,
			amount: refundRequest.amount,
			requestedAt: refundRequest.requestedAt,
			resolvedAt: refundRequest.resolvedAt,
		})
		.from(refundRequest)
		.innerJoin(order, eq(order.id, refundRequest.orderId))
		.where(eq(refundRequest.clientId, clientId))
		.orderBy(desc(refundRequest.requestedAt));

	if (refunds.length === 0) {
		return [];
	}

	const orderIds = Array.from(new Set(refunds.map((r) => r.orderId)));
	const items = await db
		.select({
			id: orderItem.id,
			orderId: orderItem.orderId,
			toolId: orderItem.toolId,
			name: orderItem.name,
			voltage: orderItem.voltage,
			quantity: orderItem.quantity,
			unitPrice: orderItem.unitPrice,
		})
		.from(orderItem)
		.where(inArray(orderItem.orderId, orderIds));

	const imageByTool = await primaryImageByToolId(
		Array.from(new Set(items.map((i) => i.toolId)))
	);

	const itemsByOrder = new Map<string, typeof items>();
	for (const it of items) {
		const arr = itemsByOrder.get(it.orderId) ?? [];
		arr.push(it);
		itemsByOrder.set(it.orderId, arr);
	}

	return refunds.map((r) => ({
		id: r.id,
		orderId: r.orderId,
		orderNumber: r.orderNumber,
		status: r.status,
		reasonCategory: r.reasonCategory,
		reasonText: r.reasonText,
		rejectionReason: r.rejectionReason,
		amount: r.amount,
		requestedAt: r.requestedAt,
		resolvedAt: r.resolvedAt,
		preview: (itemsByOrder.get(r.orderId) ?? []).map((i) => ({
			id: i.id,
			name: i.name,
			voltage: i.voltage,
			quantity: i.quantity,
			unitPrice: i.unitPrice,
			imageUrl: imageByTool.get(i.toolId) ?? null,
		})),
	}));
}

/**
 * Devolução ATIVA (requested/under_review/approved) de um pedido do cliente,
 * ou `null`. Usada no detalhe pra esconder o botão e mostrar o bloco de status.
 * Inclui também devoluções terminais (refunded/rejected) — retorna a mais
 * recente independente do status pra exibir o desfecho no detalhe.
 */
export async function getRefundForOrder(
	clientId: string,
	orderId: string
): Promise<RefundRequestRow | null> {
	const [row] = await db
		.select()
		.from(refundRequest)
		.where(
			and(
				eq(refundRequest.orderId, orderId),
				eq(refundRequest.clientId, clientId)
			)
		)
		.orderBy(desc(refundRequest.requestedAt))
		.limit(1);
	return row ?? null;
}

export function hasActiveRefund(refund: RefundRequestRow | null): boolean {
	if (!refund) {
		return false;
	}
	return (ACTIVE_REFUND_STATUSES as readonly RefundStatus[]).includes(
		refund.status
	);
}
```

- [ ] **Step 2: check-types**

Run: `bun check-types`
Expected: 6/6 successful.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/refunds/queries.ts
git commit -m "feat: queries de devolução do cliente"
```

---

## Task 3: Server action de solicitar devolução

**Files:**
- Create: `apps/web/src/app/dashboard/pedidos/_actions/refunds.ts`

- [ ] **Step 1: Implementar a action**

`apps/web/src/app/dashboard/pedidos/_actions/refunds.ts`:

```ts
"use server";

import { db } from "@emach/db";
import { order, refundRequest } from "@emach/db/schema/orders";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { log } from "@/lib/evlog";
import { isRefundEligibleStatus } from "@/lib/refunds/queries";
import { ACTIVE_REFUND_STATUSES } from "@/lib/refunds/status";
import { requireCurrentClient } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
	orderId: z.string().min(1),
	reasonCategory: z.enum([
		"defeito",
		"item_errado",
		"avaria_transporte",
		"arrependimento",
		"outro",
	]),
	reasonText: z.string().trim().max(2000).optional(),
});

export async function requestRefundAction(raw: {
	orderId: string;
	reasonCategory: string;
	reasonText?: string;
}): Promise<ActionResult> {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { orderId, reasonCategory, reasonText } = parsed.data;

	try {
		// Posse + elegibilidade num só fetch.
		const [orderRow] = await db
			.select({
				id: order.id,
				status: order.status,
				totalAmount: order.totalAmount,
			})
			.from(order)
			.where(and(eq(order.id, orderId), eq(order.clientId, clientId)))
			.limit(1);

		if (!orderRow) {
			return { ok: false, error: "Pedido não encontrado" };
		}
		if (!isRefundEligibleStatus(orderRow.status)) {
			return {
				ok: false,
				error: "Devolução disponível só para pedidos enviados ou entregues",
			};
		}

		// Já existe solicitação ATIVA (requested/under_review/approved)?
		const [active] = await db
			.select({ id: refundRequest.id })
			.from(refundRequest)
			.where(
				and(
					eq(refundRequest.orderId, orderId),
					eq(refundRequest.clientId, clientId),
					inArray(refundRequest.status, [...ACTIVE_REFUND_STATUSES])
				)
			)
			.limit(1);
		if (active) {
			return {
				ok: false,
				error: "Já existe uma solicitação de devolução aberta para este pedido",
			};
		}

		await db.insert(refundRequest).values({
			id: crypto.randomUUID(),
			orderId,
			clientId,
			reasonCategory,
			reasonText: reasonText || null,
			status: "requested",
			amount: orderRow.totalAmount,
			// Cliente não é staff `user` — solicitação parte do sistema.
			actorType: "system",
			actorUserId: null,
		});

		revalidatePath(`/dashboard/pedidos/${orderId}`);
		revalidatePath("/dashboard/reembolso");
		return { ok: true };
	} catch (err) {
		// Backstop de corrida: índice parcial único em (orderId) WHERE
		// status IN ('requested','under_review').
		const code = (err as { cause?: { code?: string } })?.cause?.code;
		if (code === "23505") {
			return {
				ok: false,
				error: "Já existe uma solicitação de devolução aberta para este pedido",
			};
		}
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "request_refund_failed",
			clientId,
			orderId,
			error: message,
		});
		return { ok: false, error: "Não foi possível solicitar a devolução" };
	}
}
```

- [ ] **Step 2: check-types**

Run: `bun check-types`
Expected: 6/6 successful.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/pedidos/_actions/refunds.ts
git commit -m "feat: action de solicitar devolução"
```

---

## Task 4: Sheet + botão de solicitar devolução, integrados ao detalhe

**Files:**
- Create: `apps/web/src/app/dashboard/pedidos/[id]/_components/refund-sheet.tsx`
- Create: `apps/web/src/app/dashboard/pedidos/[id]/_components/request-refund-button.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/order-refund-block.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/page.tsx`

- [ ] **Step 1: Reescrever `order-refund-block.tsx` com tipos reais**

Substituir o conteúdo inteiro de `apps/web/src/app/dashboard/pedidos/[id]/_components/order-refund-block.tsx`:

```tsx
import type { RefundStatus } from "@emach/db/schema/orders";
import { cn } from "@emach/ui/lib/utils";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

interface RefundSummary {
	rejectionReason: string | null;
	resolvedAt: Date | null;
	status: RefundStatus;
}

interface OrderRefundBlockProps {
	refund: RefundSummary;
	variant?: "card" | "page";
}

export function OrderRefundBlock({
	refund,
	variant = "card",
}: OrderRefundBlockProps) {
	if (refund.status === "refunded") {
		const date = refund.resolvedAt ? DATE_FMT.format(refund.resolvedAt) : "—";
		return (
			<Row
				bg="bg-[#fafafa]"
				label="Reembolso"
				text={
					<>
						Estornado em <strong className="text-near-black">{date}</strong>
					</>
				}
				variant={variant}
			/>
		);
	}

	if (refund.status === "rejected") {
		return (
			<Row
				bg="bg-[#FFF5F5]"
				label="Decisão"
				text={refund.rejectionReason ?? "Solicitação recusada."}
				variant={variant}
			/>
		);
	}

	// requested / under_review / approved
	const text =
		refund.status === "approved"
			? "Aprovada · estorno em processamento"
			: "Em andamento";
	return <Row bg="bg-white" label="Devolução" text={text} variant={variant} />;
}

function Row({
	label,
	text,
	bg,
	variant,
}: {
	bg: string;
	label: string;
	text: React.ReactNode;
	variant: "card" | "page";
}) {
	const padding = variant === "page" ? "px-[18px] py-4" : "px-[18px] py-3";
	return (
		<div
			className={cn(
				"flex flex-wrap items-baseline gap-x-6 gap-y-1 border-border border-t",
				bg,
				padding
			)}
		>
			<span className="font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
				{label}
			</span>
			<span className="text-[13px] text-gray-60 leading-relaxed">{text}</span>
		</div>
	);
}
```

- [ ] **Step 2: Criar a sheet de devolução**

`apps/web/src/app/dashboard/pedidos/[id]/_components/refund-sheet.tsx`:

```tsx
"use client";

import type { RefundReason } from "@emach/db/schema/orders";
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@emach/ui/components/sheet";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmachButton } from "@/components/emach-button";
import { fmtNumericBRL } from "@/lib/format";
import {
	REFUND_REASON_LABEL,
	REFUND_REASON_OPTIONS,
} from "@/lib/refunds/status";
import { requestRefundAction } from "../../_actions/refunds";

export function RefundSheet({
	open,
	onOpenChange,
	orderId,
	orderNumber,
	totalAmount,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	orderId: string;
	orderNumber: string;
	totalAmount: string;
}) {
	const [reason, setReason] = useState<RefundReason>("defeito");
	const [text, setText] = useState("");
	const [pending, startTransition] = useTransition();

	function reset() {
		setReason("defeito");
		setText("");
	}

	function handleOpenChange(next: boolean) {
		if (!next) {
			reset();
		}
		onOpenChange(next);
	}

	function submit() {
		startTransition(async () => {
			const res = await requestRefundAction({
				orderId,
				reasonCategory: reason,
				reasonText: text,
			});
			if (res.ok) {
				toast.success("Solicitação de devolução enviada");
				handleOpenChange(false);
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<Sheet onOpenChange={handleOpenChange} open={open}>
			<SheetContent className="flex flex-col gap-0" side="right">
				<SheetHeader>
					<SheetTitle className="font-display">Solicitar devolução</SheetTitle>
				</SheetHeader>
				<div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
					<div className="text-[13px] text-gray-60">
						Pedido{" "}
						<span className="font-semibold text-near-black">
							#{orderNumber}
						</span>{" "}
						· devolução do pedido inteiro
					</div>
					<label className="block">
						<span className="mb-1.5 block font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
							Motivo
						</span>
						<select
							className="h-10 w-full border border-border bg-white px-3 text-[14px] outline-none focus:border-near-black"
							onChange={(e) => setReason(e.target.value as RefundReason)}
							value={reason}
						>
							{REFUND_REASON_OPTIONS.map((r) => (
								<option key={r} value={r}>
									{REFUND_REASON_LABEL[r]}
								</option>
							))}
						</select>
					</label>
					<label className="block">
						<span className="mb-1.5 block font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
							Detalhes (opcional)
						</span>
						<textarea
							className="min-h-[120px] w-full border border-border p-3 text-[14px] outline-none focus:border-near-black"
							maxLength={2000}
							onChange={(e) => setText(e.target.value)}
							placeholder="Descreva o que aconteceu (opcional)"
							value={text}
						/>
					</label>
					<div className="flex items-baseline justify-between border-border border-t pt-4">
						<span className="font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
							Valor a reembolsar
						</span>
						<span className="font-bold text-[18px] text-near-black">
							{fmtNumericBRL(totalAmount)}
						</span>
					</div>
				</div>
				<SheetFooter className="flex-row gap-2">
					<EmachButton
						onClick={() => handleOpenChange(false)}
						size="md"
						variant="ghost"
					>
						Cancelar
					</EmachButton>
					<EmachButton
						disabled={pending}
						onClick={submit}
						size="md"
						variant="primary"
					>
						{pending ? "Enviando..." : "Solicitar devolução"}
					</EmachButton>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
```

- [ ] **Step 3: Criar o botão que abre a sheet**

`apps/web/src/app/dashboard/pedidos/[id]/_components/request-refund-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { EmachButton } from "@/components/emach-button";
import { RefundSheet } from "./refund-sheet";

export function RequestRefundButton({
	orderId,
	orderNumber,
	totalAmount,
}: {
	orderId: string;
	orderNumber: string;
	totalAmount: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<EmachButton onClick={() => setOpen(true)} size="sm" variant="outline">
				Solicitar devolução
			</EmachButton>
			<RefundSheet
				onOpenChange={setOpen}
				open={open}
				orderId={orderId}
				orderNumber={orderNumber}
				totalAmount={totalAmount}
			/>
		</>
	);
}
```

- [ ] **Step 4: Integrar no detalhe (`page.tsx`)**

Modificar `apps/web/src/app/dashboard/pedidos/[id]/page.tsx`. Adicionar imports no topo (junto aos demais):

```tsx
import { getRefundForOrder, hasActiveRefund, isRefundEligibleStatus } from "@/lib/refunds/queries";
import { OrderRefundBlock } from "./_components/order-refund-block";
import { RequestRefundButton } from "./_components/request-refund-button";
```

Dentro de `OrderDetailPage`, após obter `detail` e desestruturar (`const { order, items, history, reviewedToolIds } = detail;`), buscar a devolução:

```tsx
	const refund = await getRefundForOrder(session.user.id, order.id);
	const canRequestRefund =
		isRefundEligibleStatus(order.status) && !hasActiveRefund(refund);
```

No JSX, logo após `<OrderTracking ... />` e antes de `<OrderActions ... />`, inserir o bloco de status quando houver devolução, e o botão quando elegível:

```tsx
				{refund ? (
					<div className="mt-6 border border-border bg-white">
						<div className="flex items-center gap-x-3.5 border-border border-b bg-gray-10 px-[18px] py-3">
							<span className="font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
								Devolução
							</span>
							<span className="font-semibold text-[12px] text-near-black">
								#{refund.id.slice(0, 8)}
							</span>
						</div>
						<OrderRefundBlock
							refund={{
								status: refund.status,
								rejectionReason: refund.rejectionReason,
								resolvedAt: refund.resolvedAt,
							}}
							variant="page"
						/>
					</div>
				) : null}
				{canRequestRefund ? (
					<div className="mt-6 flex justify-end">
						<RequestRefundButton
							orderId={order.id}
							orderNumber={order.number}
							totalAmount={order.totalAmount}
						/>
					</div>
				) : null}
```

- [ ] **Step 5: check-types**

Run: `bun check-types`
Expected: 6/6 successful.

- [ ] **Step 6: Smoke manual (anotar no PR, não bloqueia commit)**

Com `bun dev:web` rodando, num pedido `shipped`/`delivered` sem devolução: o botão "Solicitar devolução" aparece; abrir a sheet, escolher motivo, enviar → toast de sucesso, botão some, bloco "Devolução" aparece. Reenviar → erro "já existe solicitação aberta".

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/dashboard/pedidos/[id]/_components/refund-sheet.tsx" \
  "apps/web/src/app/dashboard/pedidos/[id]/_components/request-refund-button.tsx" \
  "apps/web/src/app/dashboard/pedidos/[id]/_components/order-refund-block.tsx" \
  "apps/web/src/app/dashboard/pedidos/[id]/page.tsx"
git commit -m "feat: solicitar devolução no detalhe do pedido"
```

---

## Task 5: Lista real de devoluções (`/dashboard/reembolso`) + remoção dos mocks

**Files:**
- Modify: `apps/web/src/app/dashboard/reembolso/_components/refund-status-badge.tsx`
- Modify: `apps/web/src/app/dashboard/reembolso/_components/refund-card.tsx`
- Modify: `apps/web/src/app/dashboard/reembolso/_components/refunds-tabs.tsx`
- Modify: `apps/web/src/app/dashboard/reembolso/page.tsx`
- Modify: `apps/web/src/app/dashboard/_lib/types.ts`
- Delete: `apps/web/src/app/dashboard/_lib/mock-refunds.ts`

- [ ] **Step 1: Reescrever `refund-status-badge.tsx`**

Substituir o conteúdo inteiro:

```tsx
import type { RefundStatus } from "@emach/db/schema/orders";
import { cn } from "@emach/ui/lib/utils";
import {
	REFUND_BADGE_TONE_CLASS,
	REFUND_STATUS_BADGE,
} from "@/lib/refunds/status";

interface RefundStatusBadgeProps {
	className?: string;
	status: RefundStatus;
}

export function RefundStatusBadge({
	status,
	className,
}: RefundStatusBadgeProps) {
	const { label, tone } = REFUND_STATUS_BADGE[status];
	return (
		<span
			className={cn(
				"inline-flex items-center border px-2.5 py-1 font-display font-semibold text-[10px] uppercase tracking-[0.14em]",
				REFUND_BADGE_TONE_CLASS[tone],
				className
			)}
		>
			{label}
		</span>
	);
}
```

- [ ] **Step 2: Reescrever `refund-card.tsx` com tipos reais**

Substituir o conteúdo inteiro:

```tsx
import { cn } from "@emach/ui/lib/utils";
import { Package } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { emachButtonVariants } from "@/components/emach-button";
import { fmtNumericBRL } from "@/lib/format";
import type { RefundListItem } from "@/lib/refunds/queries";
import { REFUND_REASON_LABEL } from "@/lib/refunds/status";
import { OrderRefundBlock } from "../../pedidos/[id]/_components/order-refund-block";
import { RefundStatusBadge } from "./refund-status-badge";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

function MetaPair({ label, value }: { label: string; value: string }) {
	return (
		<>
			<span className="font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
				{label}
			</span>
			<span className="font-semibold text-[12px] text-near-black">{value}</span>
		</>
	);
}

function ItemThumb({ url, alt }: { url: string | null; alt: string }) {
	if (!url) {
		return (
			<div className="emach-bg-placeholder flex h-16 w-16 shrink-0 items-center justify-center">
				<Package
					className="h-8 w-8 text-cinema-2 opacity-80"
					strokeWidth={1.2}
				/>
			</div>
		);
	}
	return (
		<Image
			alt={alt}
			className="h-16 w-16 shrink-0 object-cover"
			height={64}
			src={url}
			width={64}
		/>
	);
}

export function RefundCard({ refund }: { refund: RefundListItem }) {
	const detailsHref = `/dashboard/pedidos/${refund.orderId}` as Route;
	const isRefunded = refund.status === "refunded";
	const isRejected = refund.status === "rejected";

	const totalLabel = isRejected ? "Valor solicitado" : "A reembolsar";
	const totalClass = cn(
		"font-bold text-[18px]",
		isRefunded && "text-success",
		isRejected && "text-gray-60 line-through"
	);
	const reasonText =
		refund.reasonText || REFUND_REASON_LABEL[refund.reasonCategory];

	return (
		<article
			className={cn(
				"mb-3.5 border border-border bg-white",
				isRejected && "opacity-85"
			)}
		>
			<header className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-border border-b bg-gray-10 px-[18px] py-3">
				<MetaPair label="Devolução" value={`#${refund.id.slice(0, 8)}`} />
				<MetaPair label="Pedido" value={`#${refund.orderNumber}`} />
				<MetaPair
					label="Solicitada em"
					value={DATE_FMT.format(refund.requestedAt)}
				/>
				<div className="flex-1" />
				<RefundStatusBadge status={refund.status} />
			</header>

			<div>
				{refund.preview.map((item, idx) => (
					<div
						className={cn(
							"flex items-center gap-3.5 px-[18px] py-3.5",
							idx > 0 && "border-border/50 border-t"
						)}
						key={item.id}
					>
						<ItemThumb alt={item.name} url={item.imageUrl} />
						<div className="min-w-0 flex-1">
							<div className="truncate font-semibold text-[13px] text-near-black">
								{item.name}
							</div>
							{item.voltage ? (
								<div className="text-[11px] text-gray-60">{item.voltage}</div>
							) : null}
							<div className="mt-0.5 text-[11px] text-gray-50">
								Quantidade: {item.quantity}
							</div>
						</div>
						<div className="min-w-[90px] text-right font-semibold text-[13px] text-near-black">
							{fmtNumericBRL(item.unitPrice)}
						</div>
					</div>
				))}
			</div>

			<div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-border border-t bg-white px-[18px] py-3">
				<span className="font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
					Motivo
				</span>
				<span className="text-[13px] text-gray-60 leading-relaxed">
					{reasonText}
				</span>
			</div>

			<OrderRefundBlock
				refund={{
					status: refund.status,
					rejectionReason: refund.rejectionReason,
					resolvedAt: refund.resolvedAt,
				}}
				variant="card"
			/>

			<div className="flex items-center justify-between border-border border-t bg-[#fafafa] px-[18px] py-3.5">
				<span className="font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
					{totalLabel}
				</span>
				<span className={totalClass}>{fmtNumericBRL(refund.amount)}</span>
			</div>

			<footer className="flex justify-end gap-2 border-border border-t bg-white px-[18px] py-2.5">
				<Link
					className={emachButtonVariants({ variant: "outline", size: "sm" })}
					href={detailsHref}
				>
					Ver pedido
				</Link>
			</footer>
		</article>
	);
}
```

- [ ] **Step 3: Reescrever `refunds-tabs.tsx` para receber dados por props**

Substituir o conteúdo inteiro:

```tsx
"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@emach/ui/components/tabs";
import type { RefundListItem } from "@/lib/refunds/queries";
import {
	countRefundsByTab,
	REFUND_TAB_LABEL,
	REFUND_TABS,
	type RefundTab,
	statusToRefundTab,
} from "@/lib/refunds/status";
import { RefundCard } from "./refund-card";
import { RefundsEmptyState } from "./refunds-empty-state";

export function RefundsTabs({ refunds }: { refunds: RefundListItem[] }) {
	const counts = countRefundsByTab(refunds.map((r) => r.status));

	return (
		<Tabs defaultValue="em_andamento">
			<TabsList variant="line">
				{REFUND_TABS.map((tab) => (
					<TabsTrigger
						className="h-auto flex-1 border-none px-0 py-3.5 font-semibold text-[13px]/[14px] data-active:text-near-black"
						key={tab}
						value={tab}
					>
						<span>{REFUND_TAB_LABEL[tab]}</span>
						<span className="ml-1.5 font-normal text-gray-50">
							{counts[tab]}
						</span>
					</TabsTrigger>
				))}
			</TabsList>

			{REFUND_TABS.map((tab) => (
				<TabsContent className="mt-6" key={tab} value={tab}>
					<RefundsList refunds={refunds} tab={tab} />
				</TabsContent>
			))}
		</Tabs>
	);
}

function RefundsList({
	refunds,
	tab,
}: {
	refunds: RefundListItem[];
	tab: RefundTab;
}) {
	const filtered = refunds.filter((r) => statusToRefundTab(r.status) === tab);
	if (filtered.length === 0) {
		return <RefundsEmptyState tabLabel={REFUND_TAB_LABEL[tab]} />;
	}
	return (
		<div>
			{filtered.map((refund) => (
				<RefundCard key={refund.id} refund={refund} />
			))}
		</div>
	);
}
```

- [ ] **Step 4: Reescrever `reembolso/page.tsx` como RSC com dados reais**

Substituir o conteúdo inteiro:

```tsx
import { SectionLabel } from "@/components/section-label";
import { listClientRefunds } from "@/lib/refunds/queries";
import { requireCurrentClient } from "@/lib/session";
import { RefundsTabs } from "./_components/refunds-tabs";

export default async function ReembolsoPage() {
	const session = await requireCurrentClient();
	const refunds = await listClientRefunds(session.user.id);

	return (
		<section>
			<SectionLabel>Minha conta</SectionLabel>
			<h1 className="mt-2 mb-7 font-display font-medium text-[36px] leading-none">
				Devoluções e reembolso
			</h1>
			<RefundsTabs refunds={refunds} />
		</section>
	);
}
```

- [ ] **Step 5: Limpar tipos mock e deletar `mock-refunds.ts`**

Substituir o conteúdo inteiro de `apps/web/src/app/dashboard/_lib/types.ts` por (mantém só o que ainda for usado fora de refund; os tipos de refund agora vivem em `@/lib/refunds/*`):

```ts
// Tipos mock deste subsistema migraram para dados reais:
// - pedidos → @/lib/orders/*
// - devolução → @/lib/refunds/*
// Arquivo mantido vazio intencionalmente; remover quando nenhum import restar.
export {};
```

Deletar o mock:

```bash
git rm apps/web/src/app/dashboard/_lib/mock-refunds.ts
```

- [ ] **Step 6: Verificar que nada mais importa os mocks**

Run: `cd apps/web && ugrep -rln "mock-refunds|_lib/types" src/ || echo "OK: sem imports órfãos"`
Expected: `OK: sem imports órfãos` (ou nenhuma linha). Se algum arquivo ainda importar, corrigir o import antes de seguir.

- [ ] **Step 7: check-types**

Run: `bun check-types`
Expected: 6/6 successful.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/reembolso apps/web/src/app/dashboard/_lib/types.ts
git commit -m "feat: lista de devoluções com dados reais"
```

---

## Notas de execução

- **Smoke compartilhado:** o detalhe e a lista dependem de dados reais. Para o smoke visual, semear um `refund_request` de teste (marcado, ex. `reasonText='SMOKE_TEST'`) e **apagar depois** — banco é compartilhado com o dashboard, exige consentimento explícito antes de semear/apagar.
- **Fora de escopo (confirmado no spec):** UI staff de aprovar/recusar (vive no dashboard), estorno real Asaas (webhook/`asaasRefundRef`), devolução parcial por item, cancelar solicitação pelo cliente.
- **Não tocar** em `packages/db/src/schema/*` nem `queries/*` — são sincronizados do dashboard (ADR-0009).
