import type { RefundStatus } from "@emach/db/schema/orders";
import { cn } from "@emach/ui/lib/utils";
import { CircleAlert } from "lucide-react";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
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
				label="Reembolso"
				text={
					<>
						Estornado em{" "}
						<strong className="font-semibold text-ink tabular-nums">
							{date}
						</strong>
					</>
				}
				variant={variant}
			/>
		);
	}

	if (refund.status === "rejected") {
		return (
			<Row
				label="Decisão"
				text={refund.rejectionReason ?? "Solicitação recusada."}
				tone="danger"
				variant={variant}
			/>
		);
	}

	// requested / under_review / approved
	const text =
		refund.status === "approved"
			? "Aprovada · estorno em processamento"
			: "Em andamento";
	return <Row label="Devolução" text={text} variant={variant} />;
}

function Row({
	label,
	text,
	variant,
	tone = "default",
}: {
	label: string;
	text: React.ReactNode;
	tone?: "default" | "danger";
	variant: "card" | "page";
}) {
	const danger = tone === "danger";
	return (
		<div
			className={cn(
				"flex flex-wrap items-baseline gap-x-6 gap-y-1 border-line border-t text-[14px]",
				variant === "page" ? "px-5 py-4 md:px-6" : "px-[18px] py-3"
			)}
		>
			<span
				className={cn(
					"inline-flex items-center gap-1.5 font-bold",
					danger ? "text-error-text" : "text-ink"
				)}
			>
				{danger ? (
					<CircleAlert aria-hidden="true" className="size-4 self-center" />
				) : null}
				{label}
			</span>
			<span
				className={cn(
					"leading-relaxed",
					danger ? "text-error-text" : "text-ink-2"
				)}
			>
				{text}
			</span>
		</div>
	);
}
