"use client";

import { useState } from "react";
import { EmachButton } from "@/components/emach-button";
import { RefundSheet } from "./refund-sheet";

export function RequestRefundButton({
	orderId,
	orderNumber,
	totalAmount,
}: {
	orderId: string;
	orderNumber: string;
	totalAmount: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<EmachButton onClick={() => setOpen(true)} size="md" variant="line">
				Solicitar devolução
			</EmachButton>
			<RefundSheet
				onOpenChange={setOpen}
				open={open}
				orderId={orderId}
				orderNumber={orderNumber}
				totalAmount={totalAmount}
			/>
		</>
	);
}
