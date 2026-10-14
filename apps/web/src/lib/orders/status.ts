import type { OrderStatus } from "@emach/db/schema/orders";

export type BadgeTone =
	| "neutral"
	| "danger"
	| "info"
	| "progress"
	| "transit"
	| "success"
	| "muted"
	| "warning";

export const ORDER_STATUS_BADGE: Record<
	OrderStatus,
	{ label: string; tone: BadgeTone }
> = {
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
	"all",
	"a_pagar",
	"em_preparacao",
	"a_caminho",
	"concluidos",
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

export function statusToTab(
	status: OrderStatus
): Exclude<OrderTab, "all"> | null {
	return STATUS_TO_TAB[status];
}

export function countByTab(statuses: OrderStatus[]): Record<OrderTab, number> {
	const counts: Record<OrderTab, number> = {
		all: statuses.length,
		a_pagar: 0,
		em_preparacao: 0,
		a_caminho: 0,
		concluidos: 0,
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
export const STEPPER_PHASES = [
	"paid",
	"preparing",
	"shipped",
	"delivered",
] as const;

export type StepperPhase = (typeof STEPPER_PHASES)[number];

export type StepState = "done" | "current" | "upcoming";

// Rank da fase do pedido. Derivado de STEPPER_PHASES para não dessincronizar
// se a ordem das fases mudar (paid=1 … delivered=4). Antes de qualquer fase:
// pending_payment/payment_failed = 0. Terminal negativo = -1.
function statusRank(status: OrderStatus): number {
	if (isTerminalNegative(status)) {
		return -1;
	}

	if (status === "pending_payment" || status === "payment_failed") {
		return 0;
	}

	const phases: readonly OrderStatus[] = STEPPER_PHASES;

	return phases.indexOf(status) + 1;
}

export function stepStateFor(
	status: OrderStatus,
	phase: StepperPhase
): StepState {
	const rank = statusRank(status);
	const phaseRank = STEPPER_PHASES.indexOf(phase) + 1;

	// rank < 0 = terminal negativo; rank = 0 = aguardando pagamento.
	// Ambos renderizam todas as fases como "upcoming".
	if (rank > phaseRank) {
		return "done";
	}

	if (rank === phaseRank) {
		return "current";
	}

	return "upcoming";
}

// Default seguro: status terminal-negativo desconhecido retorna false.
export function isTerminalNegative(status: OrderStatus): boolean {
	return (
		status === "canceled" || status === "refunded" || status === "returned"
	);
}

// Estado de exibição do stepper na conta. Difere de `stepStateFor` apenas em
// pending_payment/payment_failed: a fase "Pagamento" (paid) é mostrada como
// `current` (aguardando), não `upcoming`. Não altera `statusRank` — outros
// consumidores dependem dele. A conversão "delivered → ok (verde)" fica na
// camada de apresentação (buildOrderSteps), não aqui.
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
