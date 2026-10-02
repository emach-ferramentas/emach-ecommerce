"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { EmachButton } from "@/components/emach-button";
import { ReviewSheet } from "./review-sheet";

export function ReviewItemButton({
	orderId,
	toolId,
	productName,
	reviewed,
}: {
	orderId: string;
	productName: string;
	reviewed: boolean;
	toolId: string;
}) {
	const [open, setOpen] = useState(false);
	if (reviewed) {
		return (
			<span className="inline-flex items-center gap-1 font-semibold text-[13.5px] text-ok">
				<Check aria-hidden="true" className="size-4" />
				Avaliado
			</span>
		);
	}
	return (
		<>
			<EmachButton onClick={() => setOpen(true)} size="md" variant="line">
				Avaliar
			</EmachButton>
			<ReviewSheet
				onOpenChange={setOpen}
				open={open}
				orderId={orderId}
				productName={productName}
				toolId={toolId}
			/>
		</>
	);
}
