"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { EmachButton } from "@/components/emach-button";
import { useCartActions } from "@/lib/cart-context";
import { rebuyAction } from "../../_actions/orders";

export function RebuyButton({
	orderId,
	variant = "outline",
}: {
	orderId: string;
	variant?: "outline" | "outline-light" | "primary" | "ghost";
}) {
	const { add } = useCartActions();
	const [pending, start] = useTransition();
	const router = useRouter();

	function onClick() {
		start(async () => {
			const res = await rebuyAction({ orderId });
			if (!res.ok) {
				toast.error(res.error);
				return;
			}
			for (const item of res.data.items) {
				const { quantity, ...snapshot } = item;
				add(snapshot, quantity);
			}
			const { items, skipped } = res.data;
			toast.success(
				skipped > 0
					? `${items.length} adicionado(s); ${skipped} indisponível(is)`
					: "Itens adicionados ao carrinho"
			);
			router.push("/cart");
		});
	}

	return (
		<EmachButton
			isLoading={pending}
			onClick={onClick}
			size="sm"
			variant={variant}
		>
			{pending ? "Adicionando" : "Comprar novamente"}
		</EmachButton>
	);
}
