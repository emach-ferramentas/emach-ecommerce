# Dashboard de Pedidos — Camada de Leitura (Plano 1) Implementation Plan

> **Status em 2026-09-28:** implementado (PR #36, commit `a3d62d2`). O módulo de status, as queries e as telas de lista, detalhe e rastreio existem em `apps/web/src/lib/orders/status.ts`, `apps/web/src/lib/orders/queries.ts` e `apps/web/src/app/dashboard/pedidos/`; os mocks de pedido foram removidos. `listClientOrders` continua sem paginação, como a dívida do fim do plano previa.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os dados mockados de `/dashboard/pedidos` (lista + detalhe + rastreio) pelos dados reais das tabelas `order`, `orderItem` e `orderStatusHistory`, preservando a UI existente.

**Architecture:** Server Components leem via `db` + drizzle (mesmo padrão de `dashboard/dados-pessoais/page.tsx` e `pedidos/[number]/page.tsx`), passam dados tipados aos componentes client já existentes. Um novo módulo puro (`lib/orders/status.ts`) centraliza o mapa dos 9 status reais → badge/tab/stepper. Sem server actions neste plano (botões de ação ficam ocultos até o Plano 2).

_Nota 2026-09-28: a página de referência `pedidos/[number]/page.tsx` mora hoje em `apps/web/src/app/(shop)/pedidos/[number]/page.tsx`. O stepper do detalhe usa `orderStepDisplayState` (que delega a `stepStateFor`) por meio de `pedidos/_components/order-steps.ts`._

**Tech Stack:** Next 16 (RSC + typedRoutes), Drizzle ORM, Postgres (Supabase), Vitest (lógica pura), Tailwind, shadcn (Base UI), `next/image`.

**Spec:** `docs/superpowers/specs/2026-05-28-dashboard-pedidos-design.md` (§3, §5, §7).

---

## File Structure

**Criar:**
- `apps/web/src/lib/orders/status.ts` — mapa puro 9 status → badge/tab + agrupamento + derivação de stepper. Única responsabilidade: tradução de status.
- `apps/web/src/lib/orders/status.test.ts` — testes unitários do módulo acima.
- `apps/web/src/lib/orders/queries.ts` — queries de leitura de pedidos do cliente (lista + detalhe). Inline em apps/web (decisão §10 do spec).

**Modificar:**
- `apps/web/src/app/dashboard/pedidos/page.tsx` — RSC busca dados reais, passa ao `OrdersTabs`.
- `apps/web/src/app/dashboard/pedidos/_components/orders-tabs.tsx` — recebe dados por props em vez de mock.
- `apps/web/src/app/dashboard/pedidos/_components/order-card.tsx` — tipo real, thumbnail por imagem, ações ocultas (Plano 2).
- `apps/web/src/app/dashboard/pedidos/_components/order-status-badge.tsx` — usa o novo módulo de status.
- `apps/web/src/app/dashboard/pedidos/[id]/page.tsx` — RSC detalhe real.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/order-detail-header.tsx` — status real.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/order-items.tsx` — thumbnail por imagem real.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/order-totals.tsx` — breakdown real.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/buyer-info.tsx` — comprador do `client`.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/shipping-address.tsx` — snapshot real.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/order-tracking.tsx` — stepper híbrido + timeline de `orderStatusHistory`.
- `apps/web/src/app/dashboard/pedidos/[id]/_components/order-actions.tsx` — esconder ações (Plano 2).

**Remover (no fim, após migração):**
- `apps/web/src/app/dashboard/_lib/mock-orders.ts`, `mock-order-detail.ts`, `mock-refunds.ts` — só após nenhum import restante. **`types.ts` permanece** (refunds usam até o Plano 3); os tipos de Order migram pro novo módulo.

---

## Tipos compartilhados (referência — definidos na Task 2)

```ts
// apps/web/src/lib/orders/queries.ts
import type { OrderStatus } from "@emach/db/schema/orders";

export interface OrderListItem {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: Date;
  totalAmount: string;          // numeric do banco, ex "1037.70"
  itemCount: number;            // soma de quantidades
  preview: Array<{ id: string; name: string; voltage: string | null; quantity: number; unitPrice: string; imageUrl: string | null }>;
}

export interface OrderDetailData {
  order: typeof order.$inferSelect;
  items: Array<typeof orderItem.$inferSelect & { imageUrl: string | null; slug: string | null }>;
  history: Array<typeof orderStatusHistory.$inferSelect>;
}
```

---

## Task 1: Módulo de status (puro, TDD)

**Files:**
- Create: `apps/web/src/lib/orders/status.ts`
- Test: `apps/web/src/lib/orders/status.test.ts`

Referência de teste: `apps/web/src/app/checkout/_lib/place-order.test.ts` (Vitest já roda em apps/web).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/src/lib/orders/status.test.ts
import { describe, expect, it } from "vitest";
import {
  ORDER_STATUS_BADGE,
  ORDER_TABS,
  countByTab,
  statusToTab,
} from "./status";

describe("statusToTab", () => {
  it("agrupa pagamento pendente e falho em 'a_pagar'", () => {
    expect(statusToTab("pending_payment")).toBe("a_pagar");
    expect(statusToTab("payment_failed")).toBe("a_pagar");
  });
  it("agrupa paid e preparing em 'em_preparacao'", () => {
    expect(statusToTab("paid")).toBe("em_preparacao");
    expect(statusToTab("preparing")).toBe("em_preparacao");
  });
  it("shipped -> a_caminho, delivered -> concluidos", () => {
    expect(statusToTab("shipped")).toBe("a_caminho");
    expect(statusToTab("delivered")).toBe("concluidos");
  });
  it("cancelados/devolvidos não têm tab própria (só 'all')", () => {
    expect(statusToTab("canceled")).toBe(null);
    expect(statusToTab("refunded")).toBe(null);
    expect(statusToTab("returned")).toBe(null);
  });
});

describe("ORDER_STATUS_BADGE", () => {
  it("cobre os 9 status com label e tone", () => {
    for (const s of [
      "pending_payment","paid","preparing","shipped","delivered",
      "canceled","refunded","payment_failed","returned",
    ] as const) {
      expect(ORDER_STATUS_BADGE[s].label).toBeTruthy();
      expect(ORDER_STATUS_BADGE[s].tone).toBeTruthy();
    }
  });
  it("payment_failed usa tone 'danger'", () => {
    expect(ORDER_STATUS_BADGE.payment_failed.tone).toBe("danger");
  });
});

describe("countByTab", () => {
  it("conta 'all' como total e agrupa por tab", () => {
    const counts = countByTab([
      "pending_payment", "paid", "shipped", "delivered", "canceled",
    ]);
    expect(counts.all).toBe(5);
    expect(counts.a_pagar).toBe(1);
    expect(counts.em_preparacao).toBe(1);
    expect(counts.a_caminho).toBe(1);
    expect(counts.concluidos).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd apps/web && bunx vitest run src/lib/orders/status.test.ts`
Expected: FAIL — "Cannot find module './status'".

- [ ] **Step 3: Implementar o módulo**

```ts
// apps/web/src/lib/orders/status.ts
import type { OrderStatus } from "@emach/db/schema/orders";

export type BadgeTone =
  | "neutral" | "danger" | "info" | "progress" | "transit" | "success" | "muted" | "warning";

export const ORDER_STATUS_BADGE: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  pending_payment: { label: "Aguardando pagamento", tone: "neutral" },
  payment_failed: { label: "Pagamento falhou", tone: "danger" },
  paid: { label: "Pagamento confirmado", tone: "info" },
  preparing: { label: "Em preparação", tone: "progress" },
  shipped: { label: "A caminho", tone: "transit" },
  delivered: { label: "Entregue", tone: "success" },
  canceled: { label: "Cancelado", tone: "muted" },
  refunded: { label: "Reembolsado", tone: "warning" },
  returned: { label: "Devolvido", tone: "warning" },
};

export const ORDER_TABS = [
  "all", "a_pagar", "em_preparacao", "a_caminho", "concluidos",
] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

export const ORDER_TAB_LABEL: Record<OrderTab, string> = {
  all: "Todos",
  a_pagar: "A pagar",
  em_preparacao: "Em preparação",
  a_caminho: "A caminho",
  concluidos: "Concluídos",
};

const STATUS_TO_TAB: Record<OrderStatus, Exclude<OrderTab, "all"> | null> = {
  pending_payment: "a_pagar",
  payment_failed: "a_pagar",
  paid: "em_preparacao",
  preparing: "em_preparacao",
  shipped: "a_caminho",
  delivered: "concluidos",
  canceled: null,
  refunded: null,
  returned: null,
};

export function statusToTab(status: OrderStatus): Exclude<OrderTab, "all"> | null {
  return STATUS_TO_TAB[status];
}

export function countByTab(statuses: OrderStatus[]): Record<OrderTab, number> {
  const counts: Record<OrderTab, number> = {
    all: statuses.length, a_pagar: 0, em_preparacao: 0, a_caminho: 0, concluidos: 0,
  };
  for (const s of statuses) {
    const tab = STATUS_TO_TAB[s];
    if (tab) {
      counts[tab] += 1;
    }
  }
  return counts;
}

// Stepper híbrido: 4 fases visíveis no topo.
export const STEPPER_PHASES = ["paid", "preparing", "shipped", "delivered"] as const;
export type StepperPhase = (typeof STEPPER_PHASES)[number];
export type StepState = "done" | "current" | "upcoming";

const PHASE_RANK: Record<OrderStatus, number> = {
  pending_payment: 0, payment_failed: 0,
  paid: 1, preparing: 2, shipped: 3, delivered: 4,
  canceled: -1, refunded: -1, returned: -1,
};

export function stepStateFor(status: OrderStatus, phase: StepperPhase): StepState {
  const rank = PHASE_RANK[status];
  if (rank < 0) {
    return "upcoming"; // cancelado/devolvido: stepper substituído por aviso
  }
  const phaseRank = STEPPER_PHASES.indexOf(phase) + 1;
  if (rank > phaseRank) {
    return "done";
  }
  if (rank === phaseRank) {
    return "current";
  }
  return "upcoming";
}

export function isTerminalNegative(status: OrderStatus): boolean {
  return status === "canceled" || status === "refunded" || status === "returned";
}

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "text-gray-60 border-border",
  danger: "text-emach-red border-emach-red",
  info: "text-info border-info",
  progress: "text-near-black border-near-black",
  transit: "text-near-black border-near-black",
  success: "text-success border-success",
  muted: "text-gray-50 border-border bg-gray-10",
  warning: "text-warning border-warning",
};
```

> Nota: confirmar que os tokens `text-info`/`border-info` existem no tema; se não, usar `text-near-black`. Verificar em `packages/ui` / globals antes (grep `--info`). Caso ausente, trocar `info` → classes de azul equivalentes inline.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd apps/web && bunx vitest run src/lib/orders/status.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/orders/status.ts apps/web/src/lib/orders/status.test.ts
git commit -m "feat: módulo de status de pedido (9 status reais)"
```

---

## Task 2: Queries de leitura de pedidos

**Files:**
- Create: `apps/web/src/lib/orders/queries.ts`

Sem teste unitário (acesso a DB; smoke test no fim). Padrão de import igual a `pedidos/[number]/page.tsx`.

- [ ] **Step 1: Implementar as queries**

```ts
// apps/web/src/lib/orders/queries.ts
import "server-only";
import { db } from "@emach/db";
import { order, orderItem, orderStatusHistory } from "@emach/db/schema/orders";
import { toolImage } from "@emach/db/schema/tools";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { OrderStatus } from "@emach/db/schema/orders";

export interface OrderPreviewItem {
  id: string;
  name: string;
  voltage: string | null;
  quantity: number;
  unitPrice: string;
  imageUrl: string | null;
}

export interface OrderListItem {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: Date;
  totalAmount: string;
  subtotalAmount: string;
  shippingAmount: string;
  itemCount: number;
  preview: OrderPreviewItem[];
}

export interface OrderDetailData {
  order: typeof order.$inferSelect;
  items: Array<
    typeof orderItem.$inferSelect & { imageUrl: string | null }
  >;
  history: Array<typeof orderStatusHistory.$inferSelect>;
}

/** Mapa toolId -> URL da imagem primária (menor sortOrder). */
async function primaryImageByToolId(
  toolIds: string[]
): Promise<Map<string, string>> {
  if (toolIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({ toolId: toolImage.toolId, url: toolImage.url, sortOrder: toolImage.sortOrder })
    .from(toolImage)
    .where(inArray(toolImage.toolId, toolIds))
    .orderBy(asc(toolImage.toolId), asc(toolImage.sortOrder));
  const map = new Map<string, string>();
  for (const r of rows) {
    if (!map.has(r.toolId)) {
      map.set(r.toolId, r.url); // primeira = menor sortOrder
    }
  }
  return map;
}

export async function listClientOrders(clientId: string): Promise<OrderListItem[]> {
  const orders = await db
    .select()
    .from(order)
    .where(eq(order.clientId, clientId))
    .orderBy(desc(order.createdAt));

  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((o) => o.id);
  const items = await db
    .select()
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

  return orders.map((o) => {
    const its = itemsByOrder.get(o.id) ?? [];
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      createdAt: o.createdAt,
      totalAmount: o.totalAmount,
      subtotalAmount: o.subtotalAmount,
      shippingAmount: o.shippingAmount,
      itemCount: its.reduce((s, i) => s + i.quantity, 0),
      preview: its.map((i) => ({
        id: i.id,
        name: i.name,
        voltage: i.voltage,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        imageUrl: imageByTool.get(i.toolId) ?? null,
      })),
    };
  });
}

export async function getClientOrderDetail(
  clientId: string,
  orderId: string
): Promise<OrderDetailData | null> {
  const [orderRow] = await db
    .select()
    .from(order)
    .where(and(eq(order.id, orderId), eq(order.clientId, clientId)))
    .limit(1);

  if (!orderRow) {
    return null;
  }

  const items = await db
    .select()
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId));

  const imageByTool = await primaryImageByToolId(
    Array.from(new Set(items.map((i) => i.toolId)))
  );

  const history = await db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(desc(orderStatusHistory.createdAt));

  return {
    order: orderRow,
    items: items.map((i) => ({ ...i, imageUrl: imageByTool.get(i.toolId) ?? null })),
    history,
  };
}
```

> `import "server-only"` garante que essas queries nunca vazem pro bundle client. Confirmar que o pacote `server-only` está disponível (Next 16 traz). Se faltar, remover a linha.

- [ ] **Step 2: Type-check**

Run: `bun check-types`
Expected: sem erros novos em `apps/web/src/lib/orders/queries.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/orders/queries.ts
git commit -m "feat: queries de leitura de pedidos do cliente"
```

---

## Task 3: Lista de pedidos real

**Files:**
- Modify: `apps/web/src/app/dashboard/pedidos/page.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/_components/orders-tabs.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/_components/order-status-badge.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/_components/order-card.tsx`

- [ ] **Step 1: Reescrever a página (RSC) pra buscar dados reais**

```tsx
// apps/web/src/app/dashboard/pedidos/page.tsx
import { SectionLabel } from "@/components/section-label";
import { listClientOrders } from "@/lib/orders/queries";
import { requireCurrentClient } from "@/lib/session";
import { OrdersTabs } from "./_components/orders-tabs";

export default async function PedidosPage() {
  const session = await requireCurrentClient();
  const orders = await listClientOrders(session.user.id);

  return (
    <section>
      <SectionLabel>Minha conta</SectionLabel>
      <h1 className="mt-2 mb-7 font-display font-medium text-[36px] leading-none">
        Pedidos
      </h1>
      <OrdersTabs orders={orders} />
    </section>
  );
}
```

- [ ] **Step 2: Reescrever `orders-tabs.tsx` pra receber dados por props**

```tsx
// apps/web/src/app/dashboard/pedidos/_components/orders-tabs.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@emach/ui/components/tabs";
import { ORDER_TAB_LABEL, ORDER_TABS, type OrderTab, statusToTab } from "@/lib/orders/status";
import type { OrderListItem } from "@/lib/orders/queries";
import { OrderCard } from "./order-card";
import { OrdersEmptyState } from "./orders-empty-state";

function filterByTab(orders: OrderListItem[], tab: OrderTab): OrderListItem[] {
  if (tab === "all") {
    return orders;
  }
  return orders.filter((o) => statusToTab(o.status) === tab);
}

export function OrdersTabs({ orders }: { orders: OrderListItem[] }) {
  const counts: Record<OrderTab, number> = {
    all: orders.length, a_pagar: 0, em_preparacao: 0, a_caminho: 0, concluidos: 0,
  };
  for (const o of orders) {
    const tab = statusToTab(o.status);
    if (tab) {
      counts[tab] += 1;
    }
  }

  return (
    <Tabs defaultValue="all">
      <TabsList variant="line">
        {ORDER_TABS.map((tab) => (
          <TabsTrigger
            className="h-auto flex-1 border-none px-0 py-3.5 font-semibold text-[13px]/[14px] data-active:text-near-black"
            key={tab}
            value={tab}
          >
            <span>{ORDER_TAB_LABEL[tab]}</span>
            <span className="ml-1.5 font-normal text-gray-50">{counts[tab]}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {ORDER_TABS.map((tab) => {
        const list = filterByTab(orders, tab);
        return (
          <TabsContent className="mt-6" key={tab} value={tab}>
            {list.length === 0 ? (
              <OrdersEmptyState statusLabel={ORDER_TAB_LABEL[tab]} />
            ) : (
              <div>
                {list.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
```

- [ ] **Step 3: Reescrever `order-status-badge.tsx` pra usar o módulo novo**

```tsx
// apps/web/src/app/dashboard/pedidos/_components/order-status-badge.tsx
import type { OrderStatus } from "@emach/db/schema/orders";
import { cn } from "@emach/ui/lib/utils";
import { BADGE_TONE_CLASS, ORDER_STATUS_BADGE } from "@/lib/orders/status";

export function OrderStatusBadge({
  status,
  className,
}: {
  className?: string;
  status: OrderStatus;
}) {
  const { label, tone } = ORDER_STATUS_BADGE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2.5 py-1 font-display font-semibold text-[10px] uppercase tracking-[0.14em]",
        BADGE_TONE_CLASS[tone],
        tone === "muted" && "line-through",
        className
      )}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Reescrever `order-card.tsx` (tipo real, thumbnail por imagem, ações ocultas)**

```tsx
// apps/web/src/app/dashboard/pedidos/_components/order-card.tsx
import { cn } from "@emach/ui/lib/utils";
import { Package } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { emachButtonVariants } from "@/components/emach-button";
import { fmtNumericBRL } from "@/lib/format";
import { isTerminalNegative } from "@/lib/orders/status";
import type { OrderListItem } from "@/lib/orders/queries";
import { OrderStatusBadge } from "./order-status-badge";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
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
        <Package className="h-8 w-8 text-cinema-2 opacity-80" strokeWidth={1.2} />
      </div>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: usando next/image
    <Image
      alt={alt}
      className="h-16 w-16 shrink-0 object-cover"
      height={64}
      src={url}
      width={64}
    />
  );
}

export function OrderCard({ order }: { order: OrderListItem }) {
  const detailsHref = `/dashboard/pedidos/${order.id}` as Route;

  return (
    <article
      className={cn(
        "mb-3.5 border border-border bg-white",
        isTerminalNegative(order.status) && "opacity-80"
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-border border-b bg-gray-10 px-[18px] py-3">
        <MetaPair label="Pedido" value={`#${order.number}`} />
        <MetaPair label="Realizado em" value={DATE_FMT.format(order.createdAt)} />
        <div className="flex-1" />
        <OrderStatusBadge status={order.status} />
      </header>

      <div>
        {order.preview.map((item, idx) => (
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

      <div className="flex items-center justify-between border-border border-t bg-[#fafafa] px-[18px] py-3.5">
        <span className="font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
          {order.itemCount} {order.itemCount === 1 ? "item" : "itens"}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
            Total
          </span>
          <span className="font-bold text-[18px] text-near-black">
            {fmtNumericBRL(order.totalAmount)}
          </span>
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-border border-t bg-white px-[18px] py-2.5">
        <Link
          className={emachButtonVariants({ variant: "outline", size: "sm" })}
          href={detailsHref}
        >
          Ver detalhes
        </Link>
      </footer>
    </article>
  );
}
```

> O componente deixa de ser `"use client"` (não há mais `onClick`/`toast`). Ações por status voltam no Plano 2.
> Whitelist do host Supabase em `next.config.ts > images.remotePatterns` já deve existir (imagens de produto no catálogo). Confirmar; se não, adicionar.

- [ ] **Step 5: Type-check + smoke**

Run: `bun check-types`
Expected: sem erros. Se acusar `unitPriceCents`/`categorySlug` em algum lugar, é import remanescente do mock — corrigir.

Run: `bun dev:web`, logar com um client que tenha pedidos, visitar `/dashboard/pedidos`.
Expected: lista real, tabs com contadores corretos, thumbnails (imagem ou placeholder), total formatado `R$ ...`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/pedidos/page.tsx apps/web/src/app/dashboard/pedidos/_components/orders-tabs.tsx apps/web/src/app/dashboard/pedidos/_components/order-status-badge.tsx apps/web/src/app/dashboard/pedidos/_components/order-card.tsx
git commit -m "feat: lista de pedidos com dados reais"
```

---

## Task 4: Detalhe do pedido real (sem rastreio ainda)

**Files:**
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/page.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/order-detail-header.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/order-items.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/order-totals.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/buyer-info.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/shipping-address.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/order-actions.tsx`

- [ ] **Step 1: Reescrever a página de detalhe (RSC)**

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/page.tsx
import { notFound } from "next/navigation";
import { getClientOrderDetail } from "@/lib/orders/queries";
import { requireCurrentClient } from "@/lib/session";
import { BuyerInfo } from "./_components/buyer-info";
import { OrderDetailHeader } from "./_components/order-detail-header";
import { OrderItems } from "./_components/order-items";
import { OrderTotals } from "./_components/order-totals";
import { OrderTracking } from "./_components/order-tracking";
import { ShippingAddress } from "./_components/shipping-address";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireCurrentClient();
  const detail = await getClientOrderDetail(session.user.id, id);

  if (!detail) {
    notFound();
  }

  const { order, items, history } = detail;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const buyer = {
    name: session.user.name,
    email: session.user.email,
    phone: (session.user as { phone?: string | null }).phone ?? null,
    document: (session.user as { document?: string | null }).document ?? null,
  };

  return (
    <div className="mx-auto max-w-[920px]">
      <OrderDetailHeader
        createdAt={order.createdAt}
        number={order.number}
        status={order.status}
      />
      <BuyerInfo buyer={buyer} />
      <ShippingAddress address={order.shippingAddress} />
      <OrderTotals
        discountAmount={order.discountAmount}
        itemCount={itemCount}
        paymentMethod={order.paymentMethod}
        shippingAmount={order.shippingAmount}
        shippingMethod={order.shippingMethod}
        subtotalAmount={order.subtotalAmount}
        totalAmount={order.totalAmount}
      />
      <OrderItems items={items} />
      <OrderTracking order={order} history={history} />
    </div>
  );
}
```

- [ ] **Step 2: `order-detail-header.tsx` — status real + número**

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/_components/order-detail-header.tsx
import type { OrderStatus } from "@emach/db/schema/orders";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SectionLabel } from "@/components/section-label";
import { ORDER_STATUS_BADGE } from "@/lib/orders/status";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
});

const TONE_BG: Record<string, string> = {
  neutral: "bg-warning text-white",
  danger: "bg-emach-red text-white",
  info: "bg-info text-white",
  progress: "bg-near-black text-white",
  transit: "bg-near-black text-white",
  success: "bg-success text-white",
  muted: "bg-gray-50 text-white",
  warning: "bg-warning text-white",
};

export function OrderDetailHeader({
  createdAt,
  number,
  status,
}: {
  createdAt: Date;
  number: string;
  status: OrderStatus;
}) {
  const { label, tone } = ORDER_STATUS_BADGE[status];
  return (
    <header className="mb-7">
      <Link
        className="mb-6 inline-flex items-center gap-1.5 font-semibold text-[12px] text-gray-60 tracking-[0.04em] hover:text-near-black"
        href="/dashboard/pedidos"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
        Voltar para Pedidos
      </Link>
      <SectionLabel>Pedido</SectionLabel>
      <h1 className="mt-1.5 mb-1.5 break-all font-display font-medium text-[36px] leading-none">
        #{number}
      </h1>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[12px] text-gray-60">
        <span>
          Realizado em{" "}
          <strong className="font-semibold text-near-black">
            {DATE_FMT.format(createdAt)}
          </strong>
        </span>
        <span aria-hidden="true">·</span>
        <span
          className={`inline-flex h-[22px] items-center gap-1.5 px-2.5 font-display font-semibold text-[11px] uppercase tracking-[0.12em] ${TONE_BG[tone]}`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          {label}
        </span>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: `order-items.tsx` — thumbnail por imagem real**

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/_components/order-items.tsx
import { cn } from "@emach/ui/lib/utils";
import { Package } from "lucide-react";
import Image from "next/image";
import { fmtNumericBRL } from "@/lib/format";
import type { OrderDetailData } from "@/lib/orders/queries";
import { SectionBlock } from "./section-block";

type Item = OrderDetailData["items"][number];

function ItemThumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div className="emach-bg-placeholder flex h-16 w-16 shrink-0 items-center justify-center">
        <Package className="h-8 w-8 text-cinema-2 opacity-80" strokeWidth={1.2} />
      </div>
    );
  }
  return (
    <Image alt={alt} className="h-16 w-16 shrink-0 object-cover" height={64} src={url} width={64} />
  );
}

export function OrderItems({ items }: { items: Item[] }) {
  return (
    <SectionBlock title="Itens do pedido">
      <div>
        {items.map((item, idx) => (
          <div
            className={cn(
              "flex items-center gap-3.5 py-3.5",
              idx > 0 && "border-border border-t",
              idx === 0 && "pt-0",
              idx === items.length - 1 && "pb-0"
            )}
            key={item.id}
          >
            <ItemThumb alt={item.name} url={item.imageUrl} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[13px] text-near-black">{item.name}</div>
              {item.voltage ? (
                <div className="text-[11px] text-gray-60">{item.voltage}</div>
              ) : null}
              <div className="mt-0.5 text-[11px] text-gray-50">
                Quantidade: {item.quantity}
              </div>
            </div>
            <div className="min-w-[100px] text-right font-semibold text-[13px] text-near-black">
              {fmtNumericBRL(item.lineTotal)}
            </div>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
}
```

- [ ] **Step 4: `order-totals.tsx` — breakdown real (numeric strings)**

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/_components/order-totals.tsx
import { fmtNumericBRL } from "@/lib/format";
import { SectionBlock } from "./section-block";

interface OrderTotalsProps {
  discountAmount: string;
  itemCount: number;
  paymentMethod: string | null;
  shippingAmount: string;
  shippingMethod: string | null;
  subtotalAmount: string;
  totalAmount: string;
}

const PAYMENT_LABEL: Record<string, string> = {
  pix: "Pago via Pix",
  boleto: "Boleto bancário",
  credit_card: "Cartão de crédito",
};

function PriceRow({ emphasis, label, value }: { emphasis?: "discount"; label: string; value: string }) {
  const tone = emphasis === "discount" ? "text-emach-red" : "text-near-black";
  return (
    <div className="flex items-center justify-between border-border border-b border-dashed py-2 text-[13px] last:border-b-0">
      <span className={tone}>{label}</span>
      <span className={tone}>{value}</span>
    </div>
  );
}

export function OrderTotals({
  discountAmount, itemCount, paymentMethod, shippingAmount, shippingMethod, subtotalAmount, totalAmount,
}: OrderTotalsProps) {
  const hasDiscount = Number(discountAmount) > 0;
  const shippingFree = Number(shippingAmount) === 0;
  return (
    <SectionBlock title="Valores">
      <PriceRow
        label={`Subtotal (${itemCount} ${itemCount === 1 ? "item" : "itens"})`}
        value={fmtNumericBRL(subtotalAmount)}
      />
      <PriceRow
        label={`Frete${shippingMethod ? ` (${shippingMethod})` : ""}`}
        value={shippingFree ? "Grátis" : fmtNumericBRL(shippingAmount)}
      />
      {hasDiscount ? (
        <PriceRow emphasis="discount" label="Desconto" value={`−${fmtNumericBRL(discountAmount)}`} />
      ) : null}

      <div className="mt-2 flex items-center justify-between border-near-black border-t pt-3.5">
        <span className="font-display font-semibold text-[12px] text-near-black uppercase tracking-[0.16em]">
          Total
        </span>
        <span className="font-bold text-[22px] text-near-black">{fmtNumericBRL(totalAmount)}</span>
      </div>

      {paymentMethod ? (
        <div className="mt-3.5 flex items-center gap-2.5 border border-border-strong border-dashed bg-gray-10 px-3 py-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-near-black font-bold font-display text-[10px] tracking-[0.06em]">
            {paymentMethod === "pix" ? "PIX" : paymentMethod === "boleto" ? "BOL" : "CRD"}
          </div>
          <div className="text-[12px] leading-tight">
            <strong className="block text-[13px] text-near-black">
              {PAYMENT_LABEL[paymentMethod] ?? paymentMethod}
            </strong>
          </div>
        </div>
      ) : null}
    </SectionBlock>
  );
}
```

- [ ] **Step 5: `buyer-info.tsx` — comprador do client com documento mascarado**

Ler o arquivo atual primeiro (estrutura visual). Trocar a fonte do tipo: aceitar `{ name; email; phone: string | null; document: string | null }` e mascarar o documento. Manter o JSX/estilo existente. Função de máscara:

```tsx
// adicionar no topo do componente
function maskDocument(doc: string | null): string {
  if (!doc) {
    return "—";
  }
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) {
    return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `**.***.***/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return doc;
}
```
Props passam a ser `{ buyer: { name: string; email: string; phone: string | null; document: string | null } }`. Telefone exibe `buyer.phone ?? "—"`.

- [ ] **Step 6: `shipping-address.tsx` — snapshot JSON real**

Ler o arquivo atual. O snapshot do banco (`order.shippingAddress`) é JSON com: `recipient, street, number, complement, neighborhood, city, state, country, zipCode`. Tipar a prop como:

```tsx
interface AddressSnapshot {
  recipient?: string;
  street?: string;
  number?: string;
  complement?: string | null;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}
export function ShippingAddress({ address }: { address: unknown }) {
  const a = (address ?? {}) as AddressSnapshot;
  // ...renderizar a.recipient, `${a.street}, ${a.number}`, a.complement, a.neighborhood,
  //    `${a.city} / ${a.state}`, a.zipCode — seguindo o layout existente do mock.
}
```
Manter o JSX/estilo do mock (campos via `SectionBlock`), só trocando a origem dos dados e os nomes de campo (`zip` → `zipCode`).

- [ ] **Step 7: `order-actions.tsx` — esconder ações (Plano 2)**

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/_components/order-actions.tsx
// Placeholder até o Plano 2. Mantém o arquivo pra reintroduzir ações.
export function OrderActions() {
  return null;
}
```
Remover o import/uso de `<OrderActions>` da página OU deixar `<OrderActions />` sem props (a página já não o importa — confira o Step 1: não está mais lá). Remover o arquivo de import órfão se necessário. **Também remover** o bloco de `detail.refund` da página antiga (refunds vêm no Plano 3).

- [ ] **Step 8: Type-check + smoke**

Run: `bun check-types`
Expected: sem erros.

Run: `bun dev:web`, visitar `/dashboard/pedidos/<id-real>`.
Expected: header com número/status real, comprador (doc mascarado), endereço do snapshot, totais corretos, itens com imagem. (Rastreio pode quebrar — corrigido na Task 5.)

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/dashboard/pedidos/[id]/page.tsx apps/web/src/app/dashboard/pedidos/[id]/_components/
git commit -m "feat: detalhe do pedido com dados reais"
```

---

## Task 5: Rastreio híbrido (stepper + timeline real)

**Files:**
- Modify: `apps/web/src/app/dashboard/pedidos/[id]/_components/order-tracking.tsx`

- [ ] **Step 1: Reescrever `order-tracking.tsx`**

Stepper de 4 fases (paid/preparing/shipped/delivered) usando `stepStateFor`, datas dos timestamps do `order`, bloco de código de rastreio (`shippingTrackingCode` + `shippingMethod`) com botão copiar, aviso quando `isTerminalNegative`, e seção expansível com a timeline real de `orderStatusHistory`.

```tsx
// apps/web/src/app/dashboard/pedidos/[id]/_components/order-tracking.tsx
"use client";

import type { OrderStatus } from "@emach/db/schema/orders";
import { cn } from "@emach/ui/lib/utils";
import { Check, ChevronDown, Copy, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  isTerminalNegative,
  ORDER_STATUS_BADGE,
  STEPPER_PHASES,
  type StepperPhase,
  stepStateFor,
} from "@/lib/orders/status";
import type { OrderDetailData } from "@/lib/orders/queries";
import { SectionBlock } from "./section-block";

const DATETIME_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

const PHASE_LABEL: Record<StepperPhase, string> = {
  paid: "Pago", preparing: "Preparação", shipped: "A caminho", delivered: "Recebido",
};

function phaseDate(order: OrderDetailData["order"], phase: StepperPhase): string {
  const ts =
    phase === "paid" ? order.paidAt :
    phase === "preparing" ? order.preparingAt :
    phase === "shipped" ? order.shippedAt :
    order.deliveredAt;
  return ts ? DATETIME_FMT.format(ts) : "—";
}

function StepDot({ index, state }: { index: number; state: "done" | "current" | "upcoming" }) {
  const base = "relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 font-display font-bold text-[12px]";
  if (state === "done") {
    return <div className={cn(base, "border-near-black bg-near-black text-white")}><Check className="h-4 w-4" strokeWidth={2.5} /></div>;
  }
  if (state === "current") {
    return <div className={cn(base, "border-emach-red bg-emach-red text-white shadow-[0_0_0_4px_rgba(218,41,28,0.18)]")}>{index + 1}</div>;
  }
  return <div className={cn(base, "border-border-strong bg-white text-gray-50")}>{index + 1}</div>;
}

function Stepper({ order }: { order: OrderDetailData["order"] }) {
  return (
    <ol aria-label="Etapas do envio" className="relative grid grid-cols-4 gap-2">
      {STEPPER_PHASES.map((phase, idx) => {
        const state = stepStateFor(order.status, phase);
        const isLast = idx === STEPPER_PHASES.length - 1;
        return (
          <li
            aria-current={state === "current" ? "step" : undefined}
            className="flex flex-col items-center gap-2"
            key={phase}
          >
            <div className="relative flex w-full items-center justify-center">
              <StepDot index={idx} state={state} />
              {isLast ? null : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-[17px] left-[calc(50%+18px)] z-0 h-[2px] w-[calc(100%-18px)]",
                    state === "done" ? "bg-near-black" : "bg-border-strong"
                  )}
                />
              )}
            </div>
            <div className={cn("text-center font-display font-semibold text-[11px] uppercase leading-tight tracking-[0.12em]", state === "upcoming" ? "text-gray-50" : "text-near-black")}>
              {PHASE_LABEL[phase]}
            </div>
            <div className="-mt-1 text-[10px] text-gray-50">{phaseDate(order, phase)}</div>
          </li>
        );
      })}
    </ol>
  );
}

function NegativeNotice({ status, at }: { status: OrderStatus; at: Date | null }) {
  const { label } = ORDER_STATUS_BADGE[status];
  return (
    <div className="flex items-center gap-3 border border-warning bg-warning/5 px-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-warning bg-warning text-white">
        <X className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <div>
        <div className="font-display font-semibold text-[12px] text-warning uppercase tracking-[0.14em]">
          {label}
        </div>
        {at ? <div className="text-[12px] text-gray-60">{DATETIME_FMT.format(at)}</div> : null}
      </div>
    </div>
  );
}

function TrackingCode({ code, method }: { code: string; method: string | null }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 border border-border bg-gray-10 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        {method ? (
          <div className="mb-1 font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">{method}</div>
        ) : null}
        <div className="font-mono font-semibold text-[16px] text-near-black tracking-[0.04em]">{code}</div>
      </div>
      <button
        aria-label="Copiar código de rastreio"
        className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 border border-near-black bg-white px-3.5 font-sans font-semibold text-[12px] text-near-black tracking-[0.04em] transition-all duration-180 hover:bg-near-black hover:text-white"
        onClick={handleCopy}
        type="button"
      >
        <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
        Copiar código
      </button>
    </div>
  );
}

function HistoryTimeline({ history }: { history: OrderDetailData["history"] }) {
  if (history.length === 0) {
    return <p className="text-[12px] text-gray-50">Sem histórico registrado.</p>;
  }
  return (
    <ol className="space-y-3">
      {history.map((h) => (
        <li className="flex gap-3 text-[12px]" key={h.id}>
          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-near-black" />
          <div>
            <div className="font-semibold text-near-black">
              {ORDER_STATUS_BADGE[h.toStatus].label}
            </div>
            <div className="text-gray-50">
              {DATETIME_FMT.format(h.createdAt)}
              {h.reason ? ` · ${h.reason}` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function OrderTracking({
  order,
  history,
}: {
  history: OrderDetailData["history"];
  order: OrderDetailData["order"];
}) {
  const [open, setOpen] = useState(false);
  const negative = isTerminalNegative(order.status);
  const negativeAt = order.canceledAt ?? order.refundedAt ?? order.returnedAt ?? null;

  return (
    <SectionBlock id="rastreio" title="Rastreio do envio">
      {negative ? (
        <NegativeNotice at={negativeAt} status={order.status} />
      ) : (
        <>
          <Stepper order={order} />
          {order.shippingTrackingCode ? (
            <TrackingCode code={order.shippingTrackingCode} method={order.shippingMethod} />
          ) : (
            <div className="mt-6 border border-border border-dashed bg-gray-10 px-4 py-3.5 text-[12px] text-gray-60">
              {order.status === "pending_payment" || order.status === "payment_failed"
                ? "Aguardando confirmação de pagamento. O código de rastreio aparece aqui quando o pedido for enviado."
                : "Pedido em preparação. O código de rastreio aparece aqui assim que sair para entrega."}
            </div>
          )}
        </>
      )}

      <button
        className="mt-5 inline-flex items-center gap-1.5 font-semibold text-[12px] text-gray-60 hover:text-near-black"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} strokeWidth={1.8} />
        {open ? "Ocultar histórico" : "Ver histórico completo"}
      </button>
      {open ? <div className="mt-3 border-border border-t pt-4"><HistoryTimeline history={history} /></div> : null}
    </SectionBlock>
  );
}
```

> Animação opcional (motion) fica pro polimento — neste plano o expand é CSS/condicional simples. Se o `motion` for adotado, animar a altura do bloco de histórico depois.

- [ ] **Step 2: Type-check + smoke**

Run: `bun check-types`
Expected: sem erros.

Run: `bun dev:web`, visitar detalhes de pedidos em status variados (pendente, enviado, entregue, cancelado).
Expected: stepper coerente, código de rastreio quando houver, aviso pra cancelado, "ver histórico completo" expande a timeline real.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/pedidos/[id]/_components/order-tracking.tsx
git commit -m "feat: rastreio híbrido com histórico real"
```

---

## Task 6: Limpeza dos mocks de pedido

**Files:**
- Delete: `apps/web/src/app/dashboard/_lib/mock-orders.ts`
- Delete: `apps/web/src/app/dashboard/_lib/mock-order-detail.ts`
- Modify: `apps/web/src/app/dashboard/_lib/types.ts` (remover tipos de Order/OrderDetail/OrderStatus mock; **manter** os de Refund usados por `/reembolso` até o Plano 3)

- [ ] **Step 1: Confirmar que não há mais imports dos mocks de pedido**

Run: `ugrep -rn "mock-orders\|mock-order-detail\|_lib/types" apps/web/src/app/dashboard/pedidos apps/web/src/app/dashboard/pedidos/\[id\]`
Expected: nenhum resultado (todos migrados para `@/lib/orders/*`).

Run: `ugrep -rn "mock-orders\|mock-order-detail" apps/web/src`
Expected: nenhum resultado fora de `/reembolso` (que não os usa).

- [ ] **Step 2: Remover os arquivos e os tipos de pedido do `types.ts`**

Apagar `mock-orders.ts` e `mock-order-detail.ts`. Em `types.ts`, remover `OrderStatus`, `OrderTab`, `CategorySlug`, `OrderItem`, `Order`, `OrderDetail`, `ORDER_STATUS_LABEL`, `ORDER_TAB_LABEL`, `ORDER_TABS`, e tipos só usados por order detail (`BuyerSnapshot`, `ShippingAddress`, `OrderBreakdown`, `PaymentInfo`, `OrderTracking`, `PaymentMethodKind`, `PAYMENT_METHOD_LABEL`). **Manter** tudo de `Refund*` (usado por `/reembolso`). `mock-order-detail.ts` importa `mockRefunds` — após removê-lo, confirmar que `mock-refunds.ts` continua válido sozinho.

```bash
rm apps/web/src/app/dashboard/_lib/mock-orders.ts apps/web/src/app/dashboard/_lib/mock-order-detail.ts
```

- [ ] **Step 3: Type-check**

Run: `bun check-types`
Expected: sem erros. Se algum tipo de Refund quebrar por ter perdido `OrderItem`, reintroduzir um `RefundOrderItem` local em `types.ts` (o Refund mock usa `items: OrderItem[]`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/_lib/
git commit -m "chore: remover mocks de pedido após migração"
```

_Nota 2026-09-28: `types.ts` só ficou até o Plano 3. O PR #39 apagou `types.ts` e `mock-refunds.ts`, e a pasta `apps/web/src/app/dashboard/_lib/` não existe mais._

---

## Self-Review (executado ao escrever o plano)

**Cobertura do spec (read layer):**
- §3.2 tabs (5) → Task 1 (`ORDER_TABS`) + Task 3 (`orders-tabs`). ✓
- §3.3 mapa de status → badge → Task 1 (`ORDER_STATUS_BADGE`/`BADGE_TONE_CLASS`) + Tasks 3/4. ✓
- §3.4 rastreio híbrido (stepper + timeline real) → Task 5. ✓
- §7 lista/detalhe reais → Tasks 3/4. ✓
- §9 comprador ao vivo + doc mascarado → Task 4 Step 5. ✓
- §9 desconto 0 / só mostra se >0 → Task 4 Step 4. ✓
- §9 rastreio só code+method → Task 5. ✓
- §9 NF-e (`nfeUrl`) → **adiar pro Plano 2** junto das ações (botão de download). Anotado.
- Ações (cancel/pagar/avaliar/rebuy) → **Plano 2** (fora deste plano por design). ✓
- Devolução → **Plano 3** (bloqueado no PR do dashboard). ✓

**Placeholders:** Steps 5/6 da Task 4 (`buyer-info`/`shipping-address`) pedem "ler o arquivo atual e manter o JSX" em vez de reescrever o componente inteiro — justificado porque só a fonte de dados muda e o JSX é puramente visual; o código novo essencial (máscara, tipos de prop, nomes de campo) está explícito. Aceitável.

**Consistência de tipos:** `OrderListItem`/`OrderDetailData` definidos na Task 2 e usados consistentemente nas Tasks 3-5. `fmtNumericBRL` (string numeric) usado no lugar de `fmtBRL` (cents) — coerente com o banco. `statusToTab`/`ORDER_STATUS_BADGE`/`stepStateFor`/`isTerminalNegative` batem entre Task 1 e consumidores.

**Riscos a verificar durante execução:**
- Tokens de tema `info`/`border-info`/`bg-info` podem não existir → fallback documentado na Task 1 Step 3.
- `next.config.ts > images.remotePatterns` precisa do host Supabase pras imagens → confirmar na Task 3.
- `server-only` disponível → confirmar na Task 2. (Resolvido: não instalado, import removido.)

**Dívida conhecida (Task 2):** `listClientOrders` não tem paginação — carrega todos os pedidos do cliente em memória. Aceitável agora (volume por cliente é limitado), mas adicionar `limit`/cursor depois será breaking na assinatura. Tratar quando houver cliente com muitos pedidos.
