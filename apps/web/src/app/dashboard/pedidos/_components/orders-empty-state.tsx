import { PackageOpen } from "lucide-react";
import { EmachLinkButton } from "@/components/emach-button";

interface OrdersEmptyStateProps {
	statusLabel: string;
}

export function OrdersEmptyState({ statusLabel }: OrdersEmptyStateProps) {
	const text =
		statusLabel === "Todos"
			? "Você ainda não tem pedidos."
			: `Você ainda não tem pedidos em "${statusLabel}".`;

	return (
		<div className="flex flex-col items-center rounded-[5px] border border-line bg-paper px-6 py-14 text-center">
			<PackageOpen
				aria-hidden="true"
				className="mb-4 size-10 text-ink-muted"
				strokeWidth={1.4}
			/>
			<p className="mb-6 text-[15.5px] text-ink-2">{text}</p>
			<EmachLinkButton href="/catalog" variant="dark">
				Ir ao catálogo
			</EmachLinkButton>
		</div>
	);
}
