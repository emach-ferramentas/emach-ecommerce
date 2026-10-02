"use client";

import type { RefundReason } from "@emach/db/schema/orders";
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@emach/ui/components/sheet";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmachButton } from "@/components/emach-button";
import { fmtNumericBRL } from "@/lib/format";
import {
	REFUND_REASON_LABEL,
	REFUND_REASON_OPTIONS,
} from "@/lib/refunds/status";
import { requestRefundAction } from "../../_actions/refunds";

export function RefundSheet({
	open,
	onOpenChange,
	orderId,
	orderNumber,
	totalAmount,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	orderId: string;
	orderNumber: string;
	totalAmount: string;
}) {
	const [reason, setReason] = useState<RefundReason>("defeito");
	const [text, setText] = useState("");
	const [pending, startTransition] = useTransition();

	function reset() {
		setReason("defeito");
		setText("");
	}

	function handleOpenChange(next: boolean) {
		if (!next) {
			reset();
		}
		onOpenChange(next);
	}

	function submit() {
		startTransition(async () => {
			const res = await requestRefundAction({
				orderId,
				reasonCategory: reason,
				reasonText: text,
			});
			if (res.ok) {
				toast.success("Solicitação de devolução enviada");
				handleOpenChange(false);
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<Sheet onOpenChange={handleOpenChange} open={open}>
			<SheetContent className="flex flex-col gap-0" side="right">
				<SheetHeader>
					<SheetTitle>Solicitar devolução</SheetTitle>
				</SheetHeader>
				<div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
					<div className="text-[14px] text-ink-2">
						Pedido{" "}
						<span className="font-semibold text-ink">#{orderNumber}</span> ·
						devolução do pedido inteiro
					</div>
					<label className="emach-field">
						<span className="emach-field__label">Motivo</span>
						<select
							className="emach-select"
							disabled={pending}
							onChange={(e) => setReason(e.target.value as RefundReason)}
							value={reason}
						>
							{REFUND_REASON_OPTIONS.map((r) => (
								<option key={r} value={r}>
									{REFUND_REASON_LABEL[r]}
								</option>
							))}
						</select>
					</label>
					<label className="emach-field">
						<span className="emach-field__label">Detalhes (opcional)</span>
						<textarea
							className="emach-textarea"
							disabled={pending}
							maxLength={2000}
							onChange={(e) => setText(e.target.value)}
							placeholder="Descreva o que aconteceu (opcional)"
							value={text}
						/>
					</label>
					<div className="flex items-baseline justify-between border-line border-t pt-4">
						<span className="font-semibold text-[15px] text-ink">
							Valor a reembolsar
						</span>
						<span className="font-extrabold text-[20px] text-ink tabular-nums">
							{fmtNumericBRL(totalAmount)}
						</span>
					</div>
				</div>
				<SheetFooter className="flex-row items-center justify-end gap-4 border-line border-t bg-canteiro px-5">
					<EmachButton
						onClick={() => handleOpenChange(false)}
						size="md"
						variant="link"
					>
						Cancelar
					</EmachButton>
					<EmachButton
						disabled={pending}
						onClick={submit}
						size="md"
						variant="dark"
					>
						{pending ? "Enviando..." : "Solicitar devolução"}
					</EmachButton>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
