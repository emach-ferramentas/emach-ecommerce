import { cn } from "@emach/ui/lib/utils";
import type { Route } from "next";
import {
	MetaPair,
	PreviewItems,
} from "@/app/dashboard/_components/order-preview";
import { StatusStepper } from "@/app/dashboard/_components/status-stepper";
import { EmachLinkButton } from "@/components/emach-button";
import { fmtNumericBRL } from "@/lib/format";
import type { RefundListItem } from "@/lib/refunds/queries";
import { REFUND_REASON_LABEL } from "@/lib/refunds/status";
import { OrderRefundBlock } from "../../pedidos/[id]/_components/order-refund-block";
import { RefundStatusBadge } from "./refund-status-badge";
import { buildRefundSteps } from "./refund-steps";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

function totalLabelFor(isRejected: boolean, isRefunded: boolean): string {
	if (isRejected) {
		return "Valor solicitado";
	}
	if (isRefunded) {
		return "Reembolsado";
	}
	return "A reembolsar";
}

export function RefundCard({ refund }: { refund: RefundListItem }) {
	const detailsHref = `/dashboard/pedidos/${refund.orderId}` as Route;
	const isRefunded = refund.status === "refunded";
	const isRejected = refund.status === "rejected";

	const totalLabel = totalLabelFor(isRejected, isRefunded);
	const reasonText =
		refund.reasonText || REFUND_REASON_LABEL[refund.reasonCategory];

	return (
		<article className="rounded-[5px] border border-line bg-paper">
			<header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-line border-b px-5 py-4">
				<MetaPair label="Devolução" value={`#${refund.id.slice(0, 8)}`} />
				<MetaPair label="Pedido" value={`#${refund.orderNumber}`} />
				<MetaPair
					label="Solicitada em"
					value={DATE_FMT.format(refund.requestedAt)}
				/>
				<div className="sm:ml-auto">
					<RefundStatusBadge status={refund.status} />
				</div>
			</header>

			<PreviewItems items={refund.preview} />

			<p className="border-line border-t px-5 py-4 text-[15px] text-ink-2 leading-relaxed">
				<span className="mr-2 font-bold text-ink">Motivo</span>
				{reasonText}
			</p>

			{isRejected ? (
				<OrderRefundBlock
					refund={{
						status: refund.status,
						rejectionReason: refund.rejectionReason,
						resolvedAt: refund.resolvedAt,
					}}
					variant="card"
				/>
			) : (
				<StatusStepper steps={buildRefundSteps(refund.status)} />
			)}

			<div className="flex items-baseline justify-between gap-4 border-line border-t px-5 py-4">
				<span className="font-bold text-[15px] text-ink">{totalLabel}</span>
				<span
					className={cn(
						"font-extrabold text-[21px] tabular-nums",
						isRefunded && "text-ok",
						isRejected && "text-ink-muted line-through",
						!(isRefunded || isRejected) && "text-ink"
					)}
				>
					{fmtNumericBRL(refund.amount)}
				</span>
			</div>

			<footer className="flex justify-end border-line border-t px-5 py-3">
				<EmachLinkButton href={detailsHref} variant="line">
					Ver pedido
				</EmachLinkButton>
			</footer>
		</article>
	);
}
