"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmachButton } from "@/components/emach-button";
import { cancelOrderAction } from "../../_actions/orders";

export function CancelOrderButton({
	orderId,
	variant = "ghost",
}: {
	orderId: string;
	variant?: "outline" | "outline-light" | "ghost";
}) {
	const [confirming, setConfirming] = useState(false);
	const [pending, start] = useTransition();
	const router = useRouter();

	function onClick() {
		if (!confirming) {
			setConfirming(true);
			return;
		}
		start(async () => {
			const res = await cancelOrderAction({ orderId });
			if (res.ok) {
				toast.success("Pedido cancelado");
				router.refresh();
			} else {
				toast.error(res.error);
				setConfirming(false);
			}
		});
	}

	function label() {
		if (pending) {
			return "Cancelando";
		}
		return confirming ? "Confirmar cancelamento?" : "Cancelar pedido";
	}

	return (
		<>
			<EmachButton
				isLoading={pending}
				onBlur={() => setConfirming(false)}
				onClick={onClick}
				size="sm"
				variant={variant}
			>
				{label()}
			</EmachButton>
			{/* O rótulo troca no lugar; sem isso o leitor de tela não anuncia
			    que o botão virou uma confirmação. */}
			<span aria-live="polite" className="sr-only" role="status">
				{confirming && !pending ? "Confirme para cancelar o pedido" : undefined}
			</span>
		</>
	);
}
