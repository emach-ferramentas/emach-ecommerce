"use client";

import type { OrderStatus } from "@emach/db/schema/orders";
import { cn } from "@emach/ui/lib/utils";
import { ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmachButton } from "@/components/emach-button";
import { Panel } from "@/components/panel";
import type { OrderHistoryEntry } from "@/lib/orders/queries";
import { isTerminalNegative, ORDER_STATUS_BADGE } from "@/lib/orders/status";

const DATETIME_FMT = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
	day: "2-digit",
	month: "2-digit",
	year: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

function TrackingCode({
	code,
	method,
}: {
	code: string;
	method: string | null;
}) {
	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			toast.success("Código copiado");
		} catch {
			toast.error("Não foi possível copiar");
		}
	};
	return (
		<div className="grid grid-cols-1 gap-4 rounded-[3px] border border-line bg-canteiro px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
			<div>
				{method ? (
					<div className="mb-1 text-[13.5px] text-ink-2">{method}</div>
				) : null}
				<div className="break-all font-mono font-semibold text-[18px] text-ink">
					{code}
				</div>
			</div>
			<EmachButton
				aria-label="Copiar código de rastreio"
				icon={<Copy aria-hidden="true" className="size-4" strokeWidth={1.8} />}
				onClick={handleCopy}
				variant="line"
			>
				Copiar código
			</EmachButton>
		</div>
	);
}

function TrackingBody({
	negative,
	trackingCode,
	method,
	status,
}: {
	method: string | null;
	negative: boolean;
	status: OrderStatus;
	trackingCode: string | null;
}) {
	if (negative) {
		return null;
	}
	if (trackingCode) {
		return <TrackingCode code={trackingCode} method={method} />;
	}
	return (
		<p className="rounded-[3px] border border-line bg-canteiro px-4 py-3.5 text-[14px] text-ink-2">
			{placeholderMessage(status)}
		</p>
	);
}

function placeholderMessage(status: OrderStatus): string {
	if (status === "pending_payment" || status === "payment_failed") {
		return "Aguardando confirmação de pagamento. O código de rastreio aparece aqui quando o pedido for enviado.";
	}
	return "Pedido em preparação. O código de rastreio aparece aqui assim que sair para entrega.";
}

function HistoryTimeline({ history }: { history: OrderHistoryEntry[] }) {
	if (history.length === 0) {
		return (
			<p className="text-[14px] text-ink-muted">Sem histórico registrado.</p>
		);
	}
	return (
		<ol className="space-y-3.5">
			{history.map((h) => (
				<li className="flex gap-3 text-[14px]" key={h.id}>
					<div
						aria-hidden="true"
						className="mt-1.5 size-2.5 shrink-0 rounded-full bg-ink"
					/>
					<div>
						<div className="font-semibold text-ink">
							{ORDER_STATUS_BADGE[h.toStatus].label}
						</div>
						<div className="text-[13px] text-ink-muted tabular-nums">
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
	history,
	shippingMethod,
	status,
	trackingCode,
}: {
	history: OrderHistoryEntry[];
	shippingMethod: string | null;
	status: OrderStatus;
	trackingCode: string | null;
}) {
	const [open, setOpen] = useState(false);
	const negative = isTerminalNegative(status);

	return (
		<Panel id="rastreio" title="Rastreio do envio">
			<TrackingBody
				method={shippingMethod}
				negative={negative}
				status={status}
				trackingCode={trackingCode}
			/>

			<button
				{...(open ? { "aria-controls": "order-history" } : {})}
				aria-expanded={open}
				className={cn(
					"inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-[14px] text-ink-2 underline underline-offset-[3px] hover:text-ink",
					negative ? "" : "mt-3"
				)}
				onClick={() => setOpen((v) => !v)}
				type="button"
			>
				<ChevronDown
					aria-hidden="true"
					className={cn("size-4 transition-transform", open && "rotate-180")}
					strokeWidth={1.8}
				/>
				{open ? "Ocultar histórico" : "Ver histórico completo"}
			</button>
			{open ? (
				<div className="mt-2 border-line border-t pt-4" id="order-history">
					<HistoryTimeline history={history} />
				</div>
			) : null}
		</Panel>
	);
}
