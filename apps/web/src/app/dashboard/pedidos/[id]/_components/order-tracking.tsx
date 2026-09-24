"use client";

import type { OrderStatus } from "@emach/db/schema/orders";
import { cn } from "@emach/ui/lib/utils";
import { ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccountSection } from "@/app/dashboard/_components/account-section";
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
		<div className="grid grid-cols-1 gap-4 border border-white/10 bg-near-black px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
			<div>
				{method ? (
					<div className="mb-1 font-display font-semibold text-[12px] text-white/65 uppercase tracking-[0.12em]">
						{method}
					</div>
				) : null}
				<div className="font-mono font-semibold text-[18px] text-white tracking-[0.04em]">
					{code}
				</div>
			</div>
			<button
				aria-label="Copiar código de rastreio"
				className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 border border-white/30 bg-transparent px-4 font-sans font-semibold text-[13px] text-white tracking-[0.04em] transition-all duration-180 hover:bg-white/10 hover:text-white"
				onClick={handleCopy}
				type="button"
			>
				<Copy className="h-4 w-4" strokeWidth={1.8} />
				Copiar código
			</button>
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
		<div className="border border-white/10 border-dashed bg-near-black px-4 py-3.5 text-[13px] text-white/65">
			{placeholderMessage(status)}
		</div>
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
			<p className="text-[13px] text-gray-50">Sem histórico registrado.</p>
		);
	}
	return (
		<ol className="space-y-3.5">
			{history.map((h) => (
				<li className="flex gap-3 text-[13px]" key={h.id}>
					<div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emach-red" />
					<div>
						<div className="font-semibold text-white">
							{ORDER_STATUS_BADGE[h.toStatus].label}
						</div>
						<div className="text-[12px] text-gray-50">
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
		<AccountSection id="rastreio" title="Rastreio do envio">
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
					"inline-flex items-center gap-1.5 font-semibold text-[13px] text-white/65 hover:text-white",
					negative ? "" : "mt-5"
				)}
				onClick={() => setOpen((v) => !v)}
				type="button"
			>
				<ChevronDown
					className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
					strokeWidth={1.8}
				/>
				{open ? "Ocultar histórico" : "Ver histórico completo"}
			</button>
			{open ? (
				<div
					className="mt-3.5 border-white/10 border-t pt-4"
					id="order-history"
				>
					<HistoryTimeline history={history} />
				</div>
			) : null}
		</AccountSection>
	);
}
