import type { RefundReason, RefundStatus } from "@emach/db/schema/orders";
import { ACTIVE_REFUND_STATUSES } from "@emach/db/schema/orders";

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
// Fonte única em @emach/db (issue #96); sincronizado por CI — consumidores
// importam ACTIVE_REFUND_STATUSES direto de @emach/db/schema/orders.
export function isActiveRefund(status: RefundStatus): boolean {
	return (ACTIVE_REFUND_STATUSES as readonly RefundStatus[]).includes(status);
}

// Fases do stepper de reembolso (espelham os 4 status não-recusados, em ordem).
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
		return -1; // terminal-negativo: o card pula o stepper e mostra a recusa
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
		return "upcoming";
	}
	if (rank > phaseRank) {
		return "done";
	}
	if (rank === phaseRank) {
		return phase === "refunded" ? "ok" : "current";
	}
	return "upcoming";
}
