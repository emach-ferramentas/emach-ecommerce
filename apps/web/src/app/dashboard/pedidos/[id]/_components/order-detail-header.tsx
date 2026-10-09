import type { OrderStatus } from "@emach/db/schema/orders";
import { Ban } from "lucide-react";
import { StatusStepper } from "@/app/dashboard/_components/status-stepper";
import { PageHead } from "@/components/page-head";
import { Panel } from "@/components/panel";
import { isTerminalNegative, ORDER_STATUS_BADGE } from "@/lib/orders/status";
import { OrderStatusBadge } from "../../_components/order-status-badge";
import { buildOrderSteps } from "../../_components/order-steps";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

export function OrderDetailHeader({
	createdAt,
	number,
	status,
	negativeAt,
}: {
	createdAt: Date;
	negativeAt: Date | null;
	number: string;
	status: OrderStatus;
}) {
	return (
		<>
			<PageHead
				aside={<OrderStatusBadge status={status} />}
				title={`Pedido #${number}`}
			>
				Realizado em{" "}
				<strong className="font-semibold text-ink">
					{DATE_FMT.format(createdAt)}
				</strong>
			</PageHead>
			{isTerminalNegative(status) ? (
				<Panel title="Andamento">
					<NegativeNotice at={negativeAt} status={status} />
				</Panel>
			) : (
				<Panel flush title="Andamento">
					<StatusStepper steps={buildOrderSteps(status)} />
				</Panel>
			)}
		</>
	);
}

function NegativeNotice({
	status,
	at,
}: {
	at: Date | null;
	status: OrderStatus;
}) {
	const { label } = ORDER_STATUS_BADGE[status];
	return (
		<div className="flex items-center gap-3.5">
			<span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line-strong text-off">
				<Ban aria-hidden="true" className="size-5" strokeWidth={1.8} />
			</span>
			<div>
				<div className="font-bold text-[15px] text-off">{label}</div>
				{at ? (
					<div className="text-[13.5px] text-ink-muted tabular-nums">
						{DATETIME_FMT.format(at)}
					</div>
				) : null}
			</div>
		</div>
	);
}
