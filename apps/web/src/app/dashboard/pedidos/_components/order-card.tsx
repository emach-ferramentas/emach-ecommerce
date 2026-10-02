import type { Route } from "next";
import {
	MetaPair,
	PreviewItems,
} from "@/app/dashboard/_components/order-preview";
import { StatusStepper } from "@/app/dashboard/_components/status-stepper";
import { EmachLinkButton } from "@/components/emach-button";
import { fmtNumericBRL } from "@/lib/format";
import type { OrderListItem } from "@/lib/orders/queries";
import { isTerminalNegative } from "@/lib/orders/status";
import { CancelOrderButton } from "../[id]/_components/cancel-order-button";
import { RebuyButton } from "../[id]/_components/rebuy-button";
import { OrderStatusBadge } from "./order-status-badge";
import { buildOrderSteps } from "./order-steps";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
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

	return (
		<article className="rounded-[5px] border border-line bg-paper">
			<header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-line border-b px-5 py-4">
				<MetaPair label="Pedido" value={`#${order.number}`} />
				<MetaPair
					label="Realizado em"
					value={DATE_FMT.format(order.createdAt)}
				/>
				<div className="sm:ml-auto">
					<OrderStatusBadge status={order.status} />
				</div>
			</header>

			<PreviewItems items={order.preview} />

			{terminalNeg ? null : (
				<StatusStepper steps={buildOrderSteps(order.status)} />
			)}

			<div className="flex items-baseline justify-between gap-4 border-line border-t px-5 py-4">
				<span className="text-[14px] text-ink-2">
					{order.itemCount} {order.itemCount === 1 ? "item" : "itens"}
				</span>
				<div className="flex items-baseline gap-2">
					<span className="font-bold text-[15px] text-ink">Total</span>
					<span className="font-extrabold text-[21px] text-ink tabular-nums">
						{fmtNumericBRL(order.totalAmount)}
					</span>
				</div>
			</div>

			<footer className="flex flex-wrap items-center gap-2 border-line border-t px-5 py-3">
				{isPending ? (
					<CancelOrderButton orderId={order.id} variant="link" />
				) : null}
				<div className="ml-auto flex flex-wrap justify-end gap-2">
					{canRebuy ? <RebuyButton orderId={order.id} variant="line" /> : null}
					<EmachLinkButton href={detailsHref} variant="line">
						Ver detalhes
					</EmachLinkButton>
					{isPending ? (
						<EmachLinkButton href={pagarHref} variant="dark">
							Pagar agora
						</EmachLinkButton>
					) : null}
				</div>
			</footer>
		</article>
	);
}
