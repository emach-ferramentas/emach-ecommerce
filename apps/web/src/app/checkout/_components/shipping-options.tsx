"use client";

import { RadioGroup, RadioGroupItem } from "@emach/ui/components/radio-group";

import { EmachButton } from "@/components/emach-button";
import { Notice } from "@/components/notice";
import { fmtBRL } from "@/lib/format";
import type { ShippingOption } from "@/lib/shipping/types";

export type ShippingStatus =
	| "idle"
	| "loading"
	| "error"
	| "ready"
	| "negotiate";

interface ShippingOptionsProps {
	onRetry: () => void;
	onSelect: (carrierId: string) => void;
	options: ShippingOption[];
	selectedId: string | null;
	status: ShippingStatus;
}

export function ShippingOptions({
	status,
	options,
	selectedId,
	onSelect,
	onRetry,
}: ShippingOptionsProps) {
	if (status === "idle") {
		return (
			<p className="text-[15px] text-ink-muted">
				Informe o CEP para calcular o frete.
			</p>
		);
	}
	if (status === "loading") {
		return <p className="text-[15px] text-ink-muted">Calculando frete…</p>;
	}
	if (status === "negotiate") {
		return (
			<Notice>
				Este pedido contém item de transporte especial. O frete será combinado
				diretamente — entre em contato para concluir a compra.
			</Notice>
		);
	}
	if (status === "error") {
		return (
			<Notice
				action={
					<EmachButton onClick={onRetry} variant="line">
						Tentar novamente
					</EmachButton>
				}
				tone="error"
			>
				Não foi possível calcular o frete.
			</Notice>
		);
	}
	if (options.length === 0) {
		return (
			<p className="text-[15px] text-ink-muted">
				Nenhuma opção de frete para este CEP.
			</p>
		);
	}
	return (
		<RadioGroup
			className="gap-2"
			onValueChange={(value) => onSelect(value)}
			value={selectedId ?? undefined}
		>
			{options.map((opt) => (
				<label
					className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-[3px] border-[1.5px] border-line px-4 py-3 text-[15px] transition-colors hover:border-line-strong has-[[data-checked]]:border-ink"
					htmlFor={`ship-${opt.carrierId}`}
					key={opt.carrierId}
				>
					<span className="flex items-center gap-3">
						<RadioGroupItem
							id={`ship-${opt.carrierId}`}
							value={opt.carrierId}
						/>
						<span>
							<span className="font-bold text-ink">{opt.name}</span>
							<span className="block text-[13.5px] text-ink-muted">
								{opt.deliveryDays > 0
									? `${opt.deliveryDays} dia(s)`
									: "Prazo a confirmar"}
							</span>
						</span>
					</span>
					<span className="font-bold text-ink tabular-nums">
						{fmtBRL(opt.priceCents)}
					</span>
				</label>
			))}
		</RadioGroup>
	);
}
