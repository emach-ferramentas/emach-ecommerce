# Redesign da conta do cliente — Implementation Plan

> **Status em 2026-09-28:** implementado (PR #74). Os componentes, a Overview, os helpers de fase (`lib/orders/status.ts`, `lib/refunds/status.ts`), o token `--amber` e a nav mobile existem no código. Os checkboxes abaixo não foram marcados.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer a linguagem visual da home (chiaroscuro Ferrari) às 4 telas da conta do cliente — Overview (nova), Pedidos, Reembolso, Dados Pessoais — e ativar a verificação de e-mail leve.

**Architecture:** Componentes compartilhados novos (`AccountHero`, `AccountBadge`, `StatusStepper`) renderizados como Server Components; lógica de fase/badge isolada e testável em `lib/orders/status.ts` e `lib/refunds/status.ts`; re-estilização dos cards existentes; nova page real em `/dashboard`; ativação da verificação de e-mail via config de auth (sem schema).

**Tech Stack:** Next 16 (App Router, RSC), Tailwind v4 (tokens em `globals.css`), Barlow/Barlow Condensed, lucide-react, Better Auth (client), vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-redesign-conta-cliente-design.md`
**Mockups de referência:** `.superpowers/brainstorm/162081-1781008315/content/*.html` _(Nota 2026-09-28: pasta não versionada, não existe no repo)_ (pedidos-b-refino-v2, telas-conjunto, overview-dados-v2, dados-v3).

**Convenções do projeto (CLAUDE.md):** sem `console.*` (usar `log` do evlog); sem `: any`/`as any`; sem barrel files em `apps/web/src`; `next/image`; sem `forwardRef` (React 19); sem `useMemo`/`useCallback` (React Compiler); IDs estáveis em `.map()`; superfície clara só `--gray-10`. Ler cada arquivo antes de editar. Rodar `bun check-types` antes de cada commit.

**Verificação por task:** lógica → vitest; visual → `bun dev:web` + visitar a rota logado (smoke). Telas afetadas: `/dashboard`, `/dashboard/pedidos`, `/dashboard/reembolso`, `/dashboard/dados-pessoais`.

---

## Task 1: Token `--amber` no design system

**Files:**
- Modify: `packages/ui/src/styles/globals.css:21-24` (bloco `:root`) e `:608-611` (`@theme inline`)

- [ ] **Step 1: Adicionar a variável em `:root`**

Em `packages/ui/src/styles/globals.css`, no bloco `:root`, logo após `--info: #4c98b9;` (linha ~23), adicionar:

```css
	--amber: #d97706;
	--amber-text: #b45309;
```

- [ ] **Step 2: Registrar no `@theme inline`**

No bloco `@theme inline` (linha ~598), após `--color-info: var(--info);` (linha ~610), adicionar:

```css
	--color-amber: var(--amber);
	--color-amber-text: var(--amber-text);
```

- [ ] **Step 3: Verificar build de tokens**

Run: `bun check-types`
Expected: PASS (CSS não é typecheckado, mas garante que nada quebrou). Confirmar que `bg-amber`, `text-amber`, `text-amber-text`, `border-amber` passam a existir como utilitários Tailwind ao usar na Task 3.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "feat: token --amber para status semântico da conta"
```

---

## Task 2: Componente `AccountBadge`

Badge com fill suave + dot, por família semântica, com variante para fundo escuro. Substitui o badge outline-only nos cards.

**Files:**
- Create: `apps/web/src/app/dashboard/_components/account-badge.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import { cn } from "@emach/ui/lib/utils";

export type BadgeFamily = "amber" | "blue" | "green" | "red" | "gray";

const FAMILY_LIGHT: Record<BadgeFamily, string> = {
	amber: "text-amber-text border-amber/45 bg-amber/10",
	blue: "text-info border-info/45 bg-info/10",
	green: "text-success border-success/45 bg-success/10",
	red: "text-emach-red border-emach-red/50 bg-emach-red/8",
	gray: "text-gray-60 border-border bg-white",
};

const FAMILY_DARK: Record<BadgeFamily, string> = {
	amber: "text-[#F9C77E] border-[#F9C77E]/40 bg-amber/20",
	blue: "text-[#8FD0E8] border-[#8FD0E8]/35 bg-info/25",
	green: "text-[#7FDFA0] border-[#7FDFA0]/35 bg-success/20",
	red: "text-[#F39B92] border-[#F39B92]/40 bg-emach-red/20",
	gray: "text-gray-50 border-white/25 bg-white/5",
};

const DOT: Record<BadgeFamily, string> = {
	amber: "bg-amber",
	blue: "bg-info",
	green: "bg-success",
	red: "bg-emach-red",
	gray: "bg-gray-50",
};

export function AccountBadge({
	family,
	tone = "light",
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
	family: BadgeFamily;
	tone?: "light" | "dark";
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 border px-2.5 py-1 font-display font-semibold text-[12px] uppercase tracking-[0.08em]",
				tone === "dark" ? FAMILY_DARK[family] : FAMILY_LIGHT[family],
				className
			)}
		>
			<span className={cn("h-[6px] w-[6px] rounded-full", DOT[family])} />
			{children}
		</span>
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `bun check-types`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_components/account-badge.tsx
git commit -m "feat: AccountBadge (paleta de status por família semântica)"
```

---

## Task 3: Componente `StatusStepper`

Stepper genérico com ícones, usado por pedido e reembolso. Apresentação pura (Server Component).

**Files:**
- Create: `apps/web/src/app/dashboard/_components/status-stepper.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import { cn } from "@emach/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StepState = "done" | "current" | "upcoming" | "ok";

export interface StepperStep {
	Icon: LucideIcon;
	key: string;
	label: string;
	state: StepState;
}

export function StatusStepper({
	steps,
	tone = "light",
}: {
	steps: StepperStep[];
	tone?: "light" | "dark";
}) {
	const dark = tone === "dark";
	return (
		<div
			className={cn(
				"flex items-start border-t px-[18px] pt-5 pb-4",
				dark ? "border-white/12 bg-white/[0.035]" : "border-border bg-[#fafafa]"
			)}
		>
			{steps.map((step, idx) => (
				<div className="contents" key={step.key}>
					{idx > 0 && (
						<div
							className={cn(
								"mt-[18px] h-[2px] flex-1",
								segClass(steps[idx - 1].state, dark)
							)}
						/>
					)}
					<div className="flex w-[88px] shrink-0 flex-col items-center">
						<span
							className={cn(
								"flex h-[38px] w-[38px] items-center justify-center rounded-full border",
								nodeClass(step.state, dark)
							)}
						>
							<step.Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
						</span>
						<span
							className={cn(
								"mt-[9px] text-center font-display font-semibold text-[12px] uppercase leading-tight tracking-[0.06em]",
								labelClass(step.state, dark)
							)}
						>
							{step.label}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

function nodeClass(state: StepState, dark: boolean): string {
	if (state === "ok") {
		return "border-success bg-success text-white";
	}
	if (state === "current") {
		return dark
			? "border-2 border-emach-red bg-near-black text-white shadow-[0_0_0_5px_rgba(218,41,28,0.28)]"
			: "border-2 border-emach-red bg-white text-emach-red shadow-[0_0_0_5px_rgba(218,41,28,0.16)]";
	}
	if (state === "done") {
		return dark
			? "border-white bg-white text-near-black"
			: "border-near-black bg-near-black text-white";
	}
	return dark
		? "border-white/20 bg-white/[0.06] text-[#888]"
		: "border-border bg-white text-gray-50";
}

function labelClass(state: StepState, dark: boolean): string {
	if (state === "ok") {
		return "text-success";
	}
	if (state === "current") {
		return dark ? "text-white" : "text-emach-red";
	}
	if (state === "done") {
		return dark ? "text-white" : "text-near-black";
	}
	return dark ? "text-[#888]" : "text-gray-50";
}

function segClass(prevState: StepState, dark: boolean): string {
	const filled = prevState === "done" || prevState === "ok";
	if (filled) {
		return dark ? "bg-white" : "bg-near-black";
	}
	return dark ? "bg-white/20" : "bg-border";
}
```

- [ ] **Step 2: Typecheck**

Run: `bun check-types`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_components/status-stepper.tsx
git commit -m "feat: StatusStepper (stepper com ícones para pedido/reembolso)"
```

---

## Task 4: Componente `AccountHero`

Hero escuro cinematográfico reutilizável (page-turn da home).

**Files:**
- Create: `apps/web/src/app/dashboard/_components/account-hero.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
export function AccountHero({
	kicker = "Minha conta",
	title,
	subtitle,
	children,
}: {
	children?: React.ReactNode;
	kicker?: string;
	subtitle?: string;
	title: string;
}) {
	return (
		<header className="emach-bg-diagonal border-emach-red border-b-[3px] bg-near-black px-6 py-8 text-white md:px-10">
			<div className="font-display font-semibold text-[13px] text-gray-50 uppercase tracking-[0.18em]">
				{kicker}
			</div>
			<h1 className="mt-2 font-display font-medium text-[44px] leading-[0.95]">
				{title}
			</h1>
			{subtitle ? (
				<p className="mt-2.5 max-w-[480px] text-[15px] text-white/70">
					{subtitle}
				</p>
			) : null}
			{children}
		</header>
	);
}
```

> `.emach-bg-diagonal` já existe em globals.css (overlay de listras editorial). Se o contraste ficar forte demais sobre `bg-near-black`, trocar por `.emach-bg-stats` no smoke da Task 8.

- [ ] **Step 2: Typecheck**

Run: `bun check-types`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_components/account-hero.tsx
git commit -m "feat: AccountHero (header escuro reutilizável da conta)"
```

---

## Task 5: Lógica de fase do pedido + paleta de badge (TDD)

Adiciona a função de apresentação do stepper (trata `pending_payment` como fase "Pagamento" atual) e atualiza a paleta de badge para famílias semânticas.

**Files:**
- Modify: `apps/web/src/lib/orders/status.ts`
- Test: `apps/web/src/lib/orders/status.test.ts` (criar)

- [ ] **Step 1: Escrever o teste falhando**

Criar `apps/web/src/lib/orders/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { orderStepDisplayState } from "./status";

describe("orderStepDisplayState", () => {
	it("pending_payment marca a fase 'paid' (Pagamento) como current", () => {
		expect(orderStepDisplayState("pending_payment", "paid")).toBe("current");
		expect(orderStepDisplayState("pending_payment", "preparing")).toBe(
			"upcoming"
		);
	});

	it("payment_failed também marca 'paid' como current", () => {
		expect(orderStepDisplayState("payment_failed", "paid")).toBe("current");
	});

	it("shipped: paid+preparing done, shipped current, delivered upcoming", () => {
		expect(orderStepDisplayState("shipped", "paid")).toBe("done");
		expect(orderStepDisplayState("shipped", "preparing")).toBe("done");
		expect(orderStepDisplayState("shipped", "shipped")).toBe("current");
		expect(orderStepDisplayState("shipped", "delivered")).toBe("upcoming");
	});

	it("delivered: todas done", () => {
		expect(orderStepDisplayState("delivered", "delivered")).toBe("done");
	});
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd apps/web && bun run test src/lib/orders/status.test.ts`
Expected: FAIL — `orderStepDisplayState is not a function` / not exported.

- [ ] **Step 3: Implementar `orderStepDisplayState`**

Em `apps/web/src/lib/orders/status.ts`, ao final do arquivo, adicionar:

```ts
// Estado de exibição do stepper na conta. Difere de `stepStateFor` apenas em
// pending_payment/payment_failed: a fase "Pagamento" (paid) é mostrada como
// `current` (aguardando), não `upcoming`. Não altera `statusRank` — outros
// consumidores dependem dele.
export function orderStepDisplayState(
	status: OrderStatus,
	phase: StepperPhase
): StepState {
	if (
		(status === "pending_payment" || status === "payment_failed") &&
		phase === "paid"
	) {
		return "current";
	}
	return stepStateFor(status, phase);
}
```

- [ ] **Step 4: Atualizar `BADGE_TONE_CLASS` para fill+família**

Substituir o objeto `BADGE_TONE_CLASS` (final do arquivo) por:

```ts
// Paleta de status por família semântica (fill suave + cor). `bg-*/N` exige os
// tokens registrados em globals.css (--amber adicionado na Task 1).
export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
	neutral: "text-amber-text border-amber/45 bg-amber/10",
	danger: "text-emach-red border-emach-red/50 bg-emach-red/8",
	info: "text-info border-info/45 bg-info/10",
	progress: "text-info border-info/45 bg-info/10",
	transit: "text-info border-info/45 bg-info/10",
	success: "text-success border-success/45 bg-success/10",
	muted: "text-gray-60 border-border bg-white",
	warning: "text-amber-text border-amber/45 bg-amber/10",
};
```

> `pending_payment` é tone `neutral` → âmbar (aguardando). `paid/preparing/shipped` (info/progress/transit) → azul (em processamento). `delivered` → verde. Mapeamento confere com `ORDER_STATUS_BADGE`.

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `cd apps/web && bun run test src/lib/orders/status.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/orders/status.ts apps/web/src/lib/orders/status.test.ts
git commit -m "feat: orderStepDisplayState + paleta de badge por família"
```

---

## Task 6: Stepper do reembolso (TDD)

**Files:**
- Modify: `apps/web/src/lib/refunds/status.ts`
- Test: `apps/web/src/lib/refunds/status.test.ts` (criar)

- [ ] **Step 1: Escrever o teste falhando**

Criar `apps/web/src/lib/refunds/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { REFUND_STEPPER_PHASES, refundStepDisplayState } from "./status";

describe("refundStepDisplayState", () => {
	it("under_review: solicitado done, em análise current", () => {
		expect(refundStepDisplayState("under_review", "requested")).toBe("done");
		expect(refundStepDisplayState("under_review", "under_review")).toBe(
			"current"
		);
		expect(refundStepDisplayState("under_review", "approved")).toBe("upcoming");
	});

	it("refunded: fase final é 'ok' (verde), as anteriores done", () => {
		expect(refundStepDisplayState("refunded", "approved")).toBe("done");
		expect(refundStepDisplayState("refunded", "refunded")).toBe("ok");
	});

	it("rejected é terminal-negativo: tudo upcoming (card não mostra stepper)", () => {
		for (const phase of REFUND_STEPPER_PHASES) {
			expect(refundStepDisplayState("rejected", phase)).toBe("upcoming");
		}
	});
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd apps/web && bun run test src/lib/refunds/status.test.ts`
Expected: FAIL — `refundStepDisplayState is not a function`.

- [ ] **Step 3: Implementar**

Em `apps/web/src/lib/refunds/status.ts`, ao final, adicionar. (`StepState` é importado do componente para um tipo único — mas para evitar acoplar lib→componente, redeclarar o tipo aqui.)

```ts
export const REFUND_STEPPER_PHASES = [
	"requested",
	"under_review",
	"approved",
	"refunded",
] as const;
export type RefundStepperPhase = (typeof REFUND_STEPPER_PHASES)[number];

export type RefundStepState = "done" | "current" | "upcoming" | "ok";

function refundRank(status: RefundStatus): number {
	if (status === "rejected") {
		return -1;
	}
	return (REFUND_STEPPER_PHASES as readonly RefundStatus[]).indexOf(status) + 1;
}

export function refundStepDisplayState(
	status: RefundStatus,
	phase: RefundStepperPhase
): RefundStepState {
	const rank = refundRank(status);
	const phaseRank = REFUND_STEPPER_PHASES.indexOf(phase) + 1;
	if (rank < 0) {
		return "upcoming"; // rejected: card pula o stepper
	}
	if (rank > phaseRank) {
		return "done";
	}
	if (rank === phaseRank) {
		return phase === "refunded" ? "ok" : "current";
	}
	return "upcoming";
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `cd apps/web && bun run test src/lib/refunds/status.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/refunds/status.ts apps/web/src/lib/refunds/status.test.ts
git commit -m "feat: stepper de fases do reembolso (refundStepDisplayState)"
```

---

## Task 7: Ativar verificação de e-mail leve (auth)

**Files:**
- Modify: `packages/auth/src/ecommerce.ts:50-75` _(Nota 2026-09-28: os números de linha mudaram; hoje `databaseHooks` existe de novo, mas para normalizar `document` e `phone` (#92, #100), não para forçar `emailVerified`.)_

- [ ] **Step 1: Remover o hook que força emailVerified e ligar sendOnSignUp**

Em `packages/auth/src/ecommerce.ts`: (a) no bloco `emailVerification`, trocar `sendOnSignUp: false` por `sendOnSignUp: true`; (b) **remover** o bloco `databaseHooks` inteiro (linhas ~67-75):

```ts
	databaseHooks: {
		user: {
			create: {
				before: async (user) => ({
					data: { ...user, emailVerified: true },
				}),
			},
		},
	},
```

`requireEmailVerification: false` permanece (verificação leve — login não bloqueia).

- [ ] **Step 2: Typecheck**

Run: `bun check-types`
Expected: PASS

- [ ] **Step 3: Smoke de signup (manual, run-time)**

Run: `bun dev:web` e, em aba anônima, criar uma conta nova em `/login` (signup).
Expected: cadastro conclui, `autoSignIn` loga, e chega um e-mail "Confirme seu e-mail — EMACH" (ou aparece no log de envio do Resend em dev). O novo cliente fica `emailVerified: false`. **Clientes antigos seguem verificados.**

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/ecommerce.ts
git commit -m "feat: ativar verificação de e-mail leve no signup (ecommerce)"
```

---

## Task 8: Redesenhar Pedidos (`OrderCard` + empty + hero)

**Files:**
- Modify: `apps/web/src/app/dashboard/pedidos/page.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/_components/order-card.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/_components/order-status-badge.tsx`
- Modify: `apps/web/src/app/dashboard/pedidos/_components/orders-empty-state.tsx`
- Create: `apps/web/src/app/dashboard/pedidos/_components/order-steps.ts`

- [ ] **Step 1: Mapa de fases→ícone do pedido**

Criar `order-steps.ts`:

```ts
import type { OrderStatus } from "@emach/db/schema/orders";
import { CreditCard, Home, Package, Truck } from "lucide-react";
import type { StepperStep } from "@/app/dashboard/_components/status-stepper";
import {
	orderStepDisplayState,
	STEPPER_PHASES,
	type StepperPhase,
} from "@/lib/orders/status";

const PHASE_META: Record<
	StepperPhase,
	{ Icon: StepperStep["Icon"]; label: string }
> = {
	paid: { Icon: CreditCard, label: "Pagamento" },
	preparing: { Icon: Package, label: "Preparação" },
	shipped: { Icon: Truck, label: "A caminho" },
	delivered: { Icon: Home, label: "Entregue" },
};

export function buildOrderSteps(status: OrderStatus): StepperStep[] {
	return STEPPER_PHASES.map((phase) => ({
		key: phase,
		label: PHASE_META[phase].label,
		Icon: PHASE_META[phase].Icon,
		state: orderStepDisplayState(status, phase),
	}));
}
```

- [ ] **Step 2: Atualizar `OrderStatusBadge` para usar `AccountBadge`**

Substituir o conteúdo de `order-status-badge.tsx`:

```tsx
import type { OrderStatus } from "@emach/db/schema/orders";
import { AccountBadge, type BadgeFamily } from "@/app/dashboard/_components/account-badge";
import { ORDER_STATUS_BADGE } from "@/lib/orders/status";
import type { BadgeTone } from "@/lib/orders/status";

const TONE_TO_FAMILY: Record<BadgeTone, BadgeFamily> = {
	neutral: "amber",
	danger: "red",
	info: "blue",
	progress: "blue",
	transit: "blue",
	success: "green",
	muted: "gray",
	warning: "amber",
};

export function OrderStatusBadge({
	status,
	tone = "light",
}: {
	status: OrderStatus;
	tone?: "light" | "dark";
}) {
	const { label, tone: badgeTone } = ORDER_STATUS_BADGE[status];
	return (
		<AccountBadge family={TONE_TO_FAMILY[badgeTone]} tone={tone}>
			{label}
		</AccountBadge>
	);
}
```

> Remove o uso de `BADGE_TONE_CLASS` direto aqui; ele segue exportado para retrocompat de outros consumidores (ex.: detalhe do pedido). A prop `className` antiga sai — checar se algum caller a passava (`order-card`, `refund-card`).

- [ ] **Step 3: Redesenhar `OrderCard`**

Reescrever `order-card.tsx`. Pontos-chave: card escuro quando pendente; `AccountBadge`/`OrderStatusBadge tone="dark"` no card escuro; `StatusStepper` exceto terminal-negativo; escala de fonte maior; footer inalterado. Estrutura:

```tsx
import { cn } from "@emach/ui/lib/utils";
import { Package } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { StatusStepper } from "@/app/dashboard/_components/status-stepper";
import { emachButtonVariants } from "@/components/emach-button";
import { fmtNumericBRL } from "@/lib/format";
import type { OrderListItem } from "@/lib/orders/queries";
import { isTerminalNegative } from "@/lib/orders/status";
import { CancelOrderButton } from "../[id]/_components/cancel-order-button";
import { RebuyButton } from "../[id]/_components/rebuy-button";
import { buildOrderSteps } from "./order-steps";
import { OrderStatusBadge } from "./order-status-badge";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

export function OrderCard({ order }: { order: OrderListItem }) {
	const detailsHref = `/dashboard/pedidos/${order.id}` as Route;
	const pagarHref = `/dashboard/pedidos/${order.id}/pagar` as Route;
	const isPending =
		order.status === "pending_payment" || order.status === "payment_failed";
	const terminalNeg = isTerminalNegative(order.status);
	const canRebuy = order.status === "delivered" || terminalNeg;
	const dark = isPending;

	return (
		<article
			className={cn(
				"mb-3.5 border",
				dark
					? "emach-bg-diagonal border-black bg-near-black text-white"
					: "border-border bg-gray-10",
				terminalNeg && "opacity-80"
			)}
		>
			<header
				className={cn(
					"flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b px-[18px] py-3.5",
					dark ? "border-white/12" : "border-border"
				)}
			>
				<MetaPair dark={dark} label="Pedido" value={`#${order.number}`} />
				<MetaPair
					dark={dark}
					label="Realizado em"
					value={DATE_FMT.format(order.createdAt)}
				/>
				<div className="flex-1" />
				<OrderStatusBadge status={order.status} tone={dark ? "dark" : "light"} />
			</header>

			{order.preview.map((item, idx) => (
				<div
					className={cn(
						"flex items-center gap-3.5 px-[18px] py-3.5",
						idx > 0 && (dark ? "border-white/10 border-t" : "border-border/50 border-t")
					)}
					key={item.id}
				>
					<ItemThumb alt={item.name} url={item.imageUrl} />
					<div className="min-w-0 flex-1">
						<div className={cn("truncate font-semibold text-[15px]", dark ? "text-white" : "text-near-black")}>
							{item.name}
						</div>
						<div className={cn("mt-1 text-[13px]", dark ? "text-white/55" : "text-gray-50")}>
							{[item.voltage, `Qtd: ${item.quantity}`].filter(Boolean).join(" · ")}
						</div>
					</div>
					<div className={cn("min-w-[90px] text-right font-semibold text-[15px]", dark ? "text-white" : "text-near-black")}>
						{fmtNumericBRL(item.unitPrice)}
					</div>
				</div>
			))}

			{terminalNeg ? null : (
				<StatusStepper steps={buildOrderSteps(order.status)} tone={dark ? "dark" : "light"} />
			)}

			<div
				className={cn(
					"flex items-center justify-between border-t px-[18px] py-3.5",
					dark ? "border-white/12" : "border-border"
				)}
			>
				<span className={cn("font-display font-semibold text-[12px] uppercase tracking-[0.12em]", dark ? "text-white/55" : "text-gray-60")}>
					{order.itemCount} {order.itemCount === 1 ? "item" : "itens"}
				</span>
				<div className="flex items-baseline gap-2">
					<span className={cn("font-display font-semibold text-[12px] uppercase tracking-[0.12em]", dark ? "text-white/55" : "text-gray-60")}>
						Total
					</span>
					<span className={cn("font-bold text-[20px]", dark ? "text-white" : "text-near-black")}>
						{fmtNumericBRL(order.totalAmount)}
					</span>
				</div>
			</div>

			<footer
				className={cn(
					"flex flex-wrap justify-end gap-2 border-t px-[18px] py-2.5",
					dark ? "border-white/12" : "border-border"
				)}
			>
				{isPending ? <CancelOrderButton orderId={order.id} /> : null}
				<Link className={emachButtonVariants({ variant: dark ? "outline-light" : "outline", size: "sm" })} href={detailsHref}>
					Ver detalhes
				</Link>
				{isPending ? (
					<Link className={emachButtonVariants({ variant: "primary", size: "sm" })} href={pagarHref}>
						Pagar agora
					</Link>
				) : null}
				{canRebuy ? <RebuyButton orderId={order.id} /> : null}
			</footer>
		</article>
	);
}

function MetaPair({ dark, label, value }: { dark: boolean; label: string; value: string }) {
	return (
		<>
			<span className={cn("font-display font-semibold text-[12px] uppercase tracking-[0.12em]", dark ? "text-gray-50" : "text-gray-60")}>
				{label}
			</span>
			<span className={cn("font-semibold text-[13px]", dark ? "text-white" : "text-near-black")}>
				{value}
			</span>
		</>
	);
}

function ItemThumb({ url, alt }: { url: string | null; alt: string }) {
	if (!url) {
		return (
			<div className="emach-bg-placeholder flex h-[54px] w-[54px] shrink-0 items-center justify-center">
				<Package className="h-7 w-7 text-cinema-2 opacity-80" strokeWidth={1.2} />
			</div>
		);
	}
	return <Image alt={alt} className="h-[54px] w-[54px] shrink-0 object-cover" height={54} src={url} width={54} />;
}
```

> Verificar `CancelOrderButton`/`RebuyButton`: se forem botões claros, garantir legibilidade no card escuro (testar no smoke; se preciso, aceitar prop de tone numa task de polish).

- [ ] **Step 4: Empty state com escala maior**

Em `orders-empty-state.tsx`, subir `text-[14px]→text-[15px]` no `<p>` e manter ícone/CTA. (Edição mínima — manter a estrutura.)

- [ ] **Step 5: Hero na page de Pedidos**

Substituir o header de `pedidos/page.tsx`:

```tsx
import { AccountHero } from "@/app/dashboard/_components/account-hero";
import { listClientOrders } from "@/lib/orders/queries";
import { requireCurrentClient } from "@/lib/session";
import { OrdersTabs } from "./_components/orders-tabs";

export default async function PedidosPage() {
	const session = await requireCurrentClient();
	const orders = await listClientOrders(session.user.id);

	return (
		<>
			<AccountHero title="Pedidos" />
			<div className="px-6 py-8 md:px-10">
				<OrdersTabs orders={orders} />
			</div>
		</>
	);
}
```

> **Atenção layout:** hoje `dashboard/layout.tsx` aplica `px-6 py-10 md:px-10` no container do conteúdo. Para o hero ser full-bleed (encostar nas bordas), o padding precisa sair do layout e ir para cada página (ver Task 12). Até a Task 12, o hero ficará com padding lateral — aceitável; a Task 12 corrige o shell.

- [ ] **Step 6: check-types + smoke**

Run: `bun check-types`
Then: `bun dev:web` → `/dashboard/pedidos` logado. Conferir: hero escuro, card do pedido pendente escuro com badge âmbar + stepper (Pagamento current/vermelho), total e ações legíveis.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/pedidos
git commit -m "feat: redesign da tela de Pedidos (hero, card escuro, stepper)"
```

---

## Task 9: Redesenhar Reembolso (`RefundCard` + empty + hero)

**Files:**
- Modify: `apps/web/src/app/dashboard/reembolso/page.tsx`
- Modify: `apps/web/src/app/dashboard/reembolso/_components/refund-card.tsx`
- Modify: `apps/web/src/app/dashboard/reembolso/_components/refund-status-badge.tsx`
- Modify: `apps/web/src/app/dashboard/reembolso/_components/refunds-empty-state.tsx`
- Create: `apps/web/src/app/dashboard/reembolso/_components/refund-steps.ts`

- [ ] **Step 1: Mapa de fases→ícone do reembolso**

Criar `refund-steps.ts`:

```ts
import type { RefundStatus } from "@emach/db/schema/orders";
import { Banknote, CircleCheck, FileText, Search } from "lucide-react";
import type { StepperStep } from "@/app/dashboard/_components/status-stepper";
import {
	REFUND_STEPPER_PHASES,
	type RefundStepperPhase,
	refundStepDisplayState,
} from "@/lib/refunds/status";

const PHASE_META: Record<
	RefundStepperPhase,
	{ Icon: StepperStep["Icon"]; label: string }
> = {
	requested: { Icon: FileText, label: "Solicitado" },
	under_review: { Icon: Search, label: "Em análise" },
	approved: { Icon: CircleCheck, label: "Aprovado" },
	refunded: { Icon: Banknote, label: "Reembolsado" },
};

export function buildRefundSteps(status: RefundStatus): StepperStep[] {
	return REFUND_STEPPER_PHASES.map((phase) => ({
		key: phase,
		label: PHASE_META[phase].label,
		Icon: PHASE_META[phase].Icon,
		state: refundStepDisplayState(status, phase),
	}));
}
```

- [ ] **Step 2: `RefundStatusBadge` via `AccountBadge`**

Reescrever `refund-status-badge.tsx` mapeando `REFUND_STATUS_BADGE[status].tone` (`info|warning|progress|success|muted`) → família (`blue|amber|blue|green|gray`), com prop `tone` light/dark — análogo à Task 8 Step 2.

- [ ] **Step 3: Redesenhar `RefundCard`**

Reescrever `refund-card.tsx` na linguagem do `OrderCard`: card escuro quando ativo (`isActiveRefund(status)` e não `rejected`); `StatusStepper` com `buildRefundSteps` **exceto** quando `rejected` (aí mantém o `OrderRefundBlock` de recusa); badge `tone` conforme; motivo (`reasonText`/`REFUND_REASON_LABEL`) e barra de valor (label "A reembolsar"/"Reembolsado" verde/"Valor solicitado" riscado). Reusar `MetaPair`/`ItemThumb` — extrair para um módulo compartilhado `dashboard/_components/order-meta.tsx` se a duplicação incomodar; caso contrário, replicar localmente (cards podem divergir).

- [ ] **Step 4: Empty state — escala maior** (edição mínima, como Task 8 Step 4).

- [ ] **Step 5: Hero na page de Reembolso**

```tsx
import { AccountHero } from "@/app/dashboard/_components/account-hero";
import { listClientRefunds } from "@/lib/refunds/queries";
import { requireCurrentClient } from "@/lib/session";
import { RefundsTabs } from "./_components/refunds-tabs";

export default async function ReembolsoPage() {
	const session = await requireCurrentClient();
	const refunds = await listClientRefunds(session.user.id);
	return (
		<>
			<AccountHero title="Devoluções e reembolso" />
			<div className="px-6 py-8 md:px-10">
				<RefundsTabs refunds={refunds} />
			</div>
		</>
	);
}
```

- [ ] **Step 6: check-types + smoke**

Run: `bun check-types` → `bun dev:web` → `/dashboard/reembolso`. Conferir os 3 estados (em análise = escuro + stepper; reembolsado = claro + verde; recusado = bloco de recusa, sem stepper). Se não houver dados de reembolso na conta de teste, validar pelo menos o empty state e o hero.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/reembolso
git commit -m "feat: redesign da tela de Reembolso (hero, stepper próprio, badges)"
```

---

## Task 10: Redesenhar Dados Pessoais (perfil + e-mail acionável)

**Files:**
- Modify: `apps/web/src/app/dashboard/dados-pessoais/page.tsx`
- Create: `apps/web/src/app/dashboard/dados-pessoais/_components/profile-header.tsx`
- Modify: `apps/web/src/app/dashboard/dados-pessoais/_components/personal-data-form.tsx`
- Modify: `apps/web/src/app/dashboard/dados-pessoais/_components/addresses-section.tsx`

- [ ] **Step 1: `ProfileHeader` (server)**

Criar `profile-header.tsx` — hero escuro com avatar de iniciais, kicker + nome. **Sem e-mail/badge no header.**

```tsx
function initials(name: string): string {
	const parts = name.trim().split(/\s+/);
	const first = parts[0]?.[0] ?? "";
	const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
	return (first + last).toUpperCase() || "?";
}

export function ProfileHeader({ name }: { name: string }) {
	return (
		<header className="emach-bg-diagonal flex items-center gap-[18px] border-emach-red border-b-[3px] bg-near-black px-6 py-8 text-white md:px-10">
			<div className="flex h-[58px] w-[58px] items-center justify-center bg-emach-red font-display font-semibold text-[25px] text-white">
				{initials(name)}
			</div>
			<div>
				<div className="font-display font-semibold text-[13px] text-gray-50 uppercase tracking-[0.18em]">
					Minha conta
				</div>
				<h1 className="mt-1.5 font-display font-medium text-[34px] leading-[0.95]">
					{name}
				</h1>
			</div>
		</header>
	);
}
```

- [ ] **Step 2: E-mail card com verificação acionável**

Em `personal-data-form.tsx`, substituir `EmailCard` por uma versão com badge de status (`AccountBadge` verde/âmbar) e, quando **não** verificado, a ação de reenvio. A ação usa `authClient.sendVerificationEmail` (o componente já é `"use client"` e importa `authClient`):

```tsx
function EmailCard({ email, verified }: { email: string; verified: boolean }) {
	const [sending, setSending] = useState(false);

	const handleVerify = async () => {
		setSending(true);
		await authClient.sendVerificationEmail(
			{ email, callbackURL: "/dashboard/dados-pessoais" },
			{
				onSuccess: () => toast.success("E-mail de verificação enviado"),
				onError: (err) =>
					toast.error(err.error.message || "Não foi possível enviar."),
			}
		);
		setSending(false);
	};

	return (
		<CardShell>
			<div className="min-w-0 flex-1">
				<div className="flex items-center justify-between gap-2">
					<FieldLabel>E-mail</FieldLabel>
					<AccountBadge family={verified ? "green" : "amber"}>
						{verified ? "Verificado" : "Não verificado"}
					</AccountBadge>
				</div>
				<div className="mt-2 truncate text-[17px] text-near-black">{email}</div>
				{verified ? (
					<div className="mt-1 text-[12px] text-gray-50">Somente leitura</div>
				) : (
					<div className="mt-3 flex items-center justify-between gap-3 border-border border-t border-dashed pt-3">
						<span className="text-[13px] text-gray-60">
							Confirme seu e-mail para receber atualizações de pedido.
						</span>
						<Button
							className="shrink-0 rounded-none border-amber-text text-amber-text"
							disabled={sending}
							onClick={handleVerify}
							type="button"
							variant="outline"
						>
							{sending ? "Enviando..." : "Verificar e-mail"}
						</Button>
					</div>
				)}
			</div>
		</CardShell>
	);
}
```

Adicionar os imports no topo: `AccountBadge` de `@/app/dashboard/_components/account-badge`. `useState`, `Button`, `toast`, `authClient` já estão importados.

- [ ] **Step 3: Escala de fonte maior nos cards e CPF sem faixa**

Nos demais cards (`NameCard`, `PhoneCard`, `DocumentCard`): subir leitura para `text-[17px]`, labels mantêm `text-[11px]→text-[12px]`. O `DocumentCard` mantém o `accent="danger"` (borda vermelha) quando vazio — adicionar a nota `Você também informa na finalização da compra, ao emitir a nota fiscal` no estado vazio (substituindo "Necessário para emitir nota fiscal" ou somando). **Não** adicionar faixa de alerta no topo.

- [ ] **Step 4: Page com `ProfileHeader`**

Reescrever `dados-pessoais/page.tsx` para renderizar `<ProfileHeader name={user.name} />` no topo (full-bleed) e o conteúdo (form + endereços) num container `px-6 py-8 md:px-10`. Remover o header `border-b-2` interno de `PersonalDataForm` e `AddressesSection` (o título da seção vira o hero + tags de seção).

```tsx
return (
	<>
		<ProfileHeader name={user.name} />
		<div className="space-y-14 px-6 py-8 md:px-10">
			<PersonalDataForm initialData={{ /* ...igual ao atual... */ }} />
			<AddressesSection addresses={addresses} />
		</div>
	</>
);
```

> Em `PersonalDataForm` e `AddressesSection`, trocar o `<header className="...border-b-2...">` por um `<div className="tag">`-equivalente ("Seus dados" / "Endereço de entrega") em Barlow Condensed uppercase — sem o título h1/h2 grande (o hero já tem o nome). Manter a lógica interna intacta.

- [ ] **Step 5: check-types + smoke**

Run: `bun check-types` → `bun dev:web` → `/dashboard/dados-pessoais`. Conferir: perfil escuro com iniciais; cards maiores; card de e-mail mostra "Verificado" (cliente atual). Para testar o estado não-verificado e o botão, usar a conta nova criada na Task 7 (smoke) e clicar "Verificar e-mail" → toast de envio + e-mail chega.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/dados-pessoais
git commit -m "feat: redesign de Dados Pessoais (perfil escuro, e-mail acionável)"
```

---

## Task 11: Overview `/dashboard` (nova page)

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx` (de redirect → page real)
- Create: `apps/web/src/app/dashboard/_components/quick-action-card.tsx`

- [ ] **Step 1: `QuickActionCard`**

```tsx
import { cn } from "@emach/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

export function QuickActionCard({
	href,
	Icon,
	title,
	description,
	flag,
}: {
	Icon: LucideIcon;
	description: string;
	flag?: React.ReactNode;
	href: Route;
	title: string;
}) {
	return (
		<Link
			className="flex flex-col gap-2.5 border border-border bg-gray-10 p-5 transition-colors hover:border-near-black"
			href={href}
		>
			<span className="flex h-[42px] w-[42px] items-center justify-center border border-near-black">
				<Icon className="h-5 w-5 text-near-black" strokeWidth={1.6} />
			</span>
			<span className="font-display font-semibold text-[19px] text-near-black">
				{title}
			</span>
			<span className="text-[13px] text-gray-50">{description}</span>
			{flag ? <span className="mt-1">{flag}</span> : null}
		</Link>
	);
}
```

- [ ] **Step 2: Page real**

Reescrever `dashboard/page.tsx` (Server Component). Busca pedidos do cliente, deriva o pedido pendente mais recente e a contagem "a pagar". Hero + "Continuar de onde parou" (reusa `OrderCard` se houver pendente) + atalhos.

```tsx
import { Package, RotateCcw, UserRound } from "lucide-react";
import { AccountBadge } from "./_components/account-badge";
import { AccountHero } from "./_components/account-hero";
import { QuickActionCard } from "./_components/quick-action-card";
import { OrderCard } from "./pedidos/_components/order-card";
import { listClientOrders } from "@/lib/orders/queries";
import { requireCurrentClient } from "@/lib/session";

export default async function DashboardPage() {
	const session = await requireCurrentClient();
	const orders = await listClientOrders(session.user.id);
	const firstName = session.user.name.trim().split(/\s+/)[0] ?? "";
	const toPay = orders.filter(
		(o) => o.status === "pending_payment" || o.status === "payment_failed"
	);
	const highlight = toPay[0] ?? orders[0] ?? null;

	return (
		<>
			<AccountHero
				subtitle="Acompanhe seus pedidos, devoluções e dados de cadastro num só lugar."
				title={`Olá, ${firstName}`}
			/>
			<div className="space-y-8 px-6 py-8 md:px-10">
				{highlight ? (
					<section>
						<div className="mb-2.5 font-display font-semibold text-[12px] text-gray-50 uppercase tracking-[0.16em]">
							{toPay.length > 0 ? "Precisa da sua atenção" : "Seu último pedido"}
						</div>
						<OrderCard order={highlight} />
					</section>
				) : null}

				<section>
					<div className="mb-2.5 font-display font-semibold text-[12px] text-gray-50 uppercase tracking-[0.16em]">
						Sua conta
					</div>
					<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
						<QuickActionCard
							description="Acompanhe e pague seus pedidos."
							flag={
								toPay.length > 0 ? (
									<AccountBadge family="amber">
										{toPay.length} a pagar
									</AccountBadge>
								) : null
							}
							href="/dashboard/pedidos"
							Icon={Package}
							title="Pedidos"
						/>
						<QuickActionCard
							description="Solicite e acompanhe reembolsos."
							href="/dashboard/reembolso"
							Icon={RotateCcw}
							title="Devoluções"
						/>
						<QuickActionCard
							description="Endereços e dados de cadastro."
							href="/dashboard/dados-pessoais"
							Icon={UserRound}
							title="Meus dados"
						/>
					</div>
				</section>
			</div>
		</>
	);
}
```

> `OrderCard` é Server-safe (sem hooks próprios; `CancelOrderButton`/`RebuyButton`/`quick-add` internos são client). Confirmar no smoke que renderiza dentro de RSC sem erro.

- [ ] **Step 3: check-types + smoke**

Run: `bun check-types` → `bun dev:web` → `/dashboard` (entrar direto). Conferir hero, card de destaque (pendente escuro), 3 atalhos com selo "N a pagar". Sem placar de métricas.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx apps/web/src/app/dashboard/_components/quick-action-card.tsx
git commit -m "feat: Overview /dashboard (hero, destaque do pedido, atalhos)"
```

---

## Task 12: Shell do layout + sidebar + mobile

**Files:**
- Modify: `apps/web/src/app/dashboard/layout.tsx`
- Modify: `apps/web/src/app/dashboard/_components/dashboard-sidebar.tsx`

_Nota 2026-09-28: o shell foi movido para `dashboard/_components/dashboard-chrome.tsx` (guarda P0 sob Suspense, #98), e o `layout.tsx` só monta `SiteHeader` e o chrome._

- [ ] **Step 1: Tirar o padding do container do layout**

Para os heros serem full-bleed, o padding sai do layout (cada página já aplica `px-6 py-8`). Em `layout.tsx`, trocar `<div className="min-w-0 overflow-y-auto px-6 py-10 md:px-10">` por `<div className="min-w-0 overflow-y-auto">`.

- [ ] **Step 2: Item "Início" + refino da sidebar**

Em `dashboard-sidebar.tsx`, adicionar como primeiro item do `NAV_ITEMS`:

```tsx
{ kind: "link", label: "Início", href: "/dashboard" },
```

> `usePathname()` já marca ativo por igualdade exata — `/dashboard` ativa só na overview; as demais rotas seguem corretas. Sem mudança na lógica.

- [ ] **Step 3: Navegação mobile**

Hoje a sidebar é `md:` (some no mobile). Adicionar uma navegação mobile: uma faixa horizontal scrollável de links no topo do conteúdo, visível só em `< md`. Implementar como um componente client `dashboard-nav-mobile.tsx` (reusa `NAV_ITEMS`) renderizado no `layout.tsx` acima de `{children}`, com `className="md:hidden"`. Estrutura mínima: `<nav class="flex gap-1 overflow-x-auto border-b bg-near-black px-4 ...">` com os mesmos links e a barra vermelha no ativo.

> Extrair `NAV_ITEMS` para um módulo compartilhado `dashboard/_components/nav-items.ts` para a sidebar e a nav mobile consumirem (evita duplicar a lista). Não é barrel — é um módulo de dados.

- [ ] **Step 4: check-types + smoke (desktop + mobile)**

Run: `bun check-types` → `bun dev:web`. Desktop: heros full-bleed, item "Início" ativo na overview. Mobile (DevTools responsive ~375px): sidebar some, nav mobile aparece, as 4 telas navegáveis e legíveis.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/layout.tsx apps/web/src/app/dashboard/_components/dashboard-sidebar.tsx apps/web/src/app/dashboard/_components/dashboard-nav-mobile.tsx apps/web/src/app/dashboard/_components/nav-items.ts
git commit -m "feat: shell full-bleed, item Início e navegação mobile da conta"
```

---

## Task 13: Verificação final e code review

- [ ] **Step 1: Typecheck + testes completos**

Run: `bun check-types` e `cd apps/web && bun run test`
Expected: tudo PASS.

- [ ] **Step 2: Smoke das 4 telas + estados**

`bun dev:web` logado: `/dashboard`, `/dashboard/pedidos`, `/dashboard/reembolso`, `/dashboard/dados-pessoais`. Conferir contra os mockups em `.superpowers/brainstorm/162081-1781008315/content/`. Estados: pedido pendente (escuro+stepper), em trânsito, entregue; e-mail verificado vs não-verificado (conta nova); CPF vazio (card vermelho, sem faixa). Mobile.

- [ ] **Step 3: `/code-review`** do diff do branch e aplicar ajustes pontuais.

- [ ] **Step 4: Commit final** (se o review gerar mudanças).

---

## Self-review (cobertura do spec)

- §3.1 Overview → Task 11. §3.2 Pedidos → Task 8. §3.3 Reembolso → Task 9. §3.4 Dados Pessoais → Task 10.
- §4.1 verificação de e-mail → Task 7 (config) + Task 10 Step 2 (ação no card).
- §4 componentes: AccountHero/AccountBadge/StatusStepper → Tasks 2-4; status helpers → Tasks 5-6; sidebar/layout/mobile → Task 12; token --amber → Task 1.
- §6 mobile → Task 12 Step 3. RSC vs client respeitado (heros/steppers/cards server; PersonalDataForm/tabs client).
- §7 verificação → Task 13.

Sem placeholders; tipos consistentes (`StepState`/`StepperStep` definidos na Task 3 e usados nas Tasks 8-9; `BadgeFamily` na Task 2 usado em 8-9; `orderStepDisplayState`/`refundStepDisplayState` definidos em 5-6 e consumidos em 8-9).
