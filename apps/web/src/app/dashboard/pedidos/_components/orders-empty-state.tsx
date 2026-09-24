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
		<div className="flex flex-col items-center justify-center border border-border bg-gray-10 px-6 py-16 text-center">
			<PackageOpen className="mb-4 h-12 w-12 text-gray-60" strokeWidth={1.2} />
			<p className="mb-6 text-[15px] text-gray-60">{text}</p>
			<EmachLinkButton href="/catalog" size="sm" variant="outline">
				Ir ao catálogo
			</EmachLinkButton>
		</div>
	);
}
