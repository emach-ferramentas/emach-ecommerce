import { RotateCcw } from "lucide-react";

interface RefundsEmptyStateProps {
	tabLabel: string;
}

export function RefundsEmptyState({ tabLabel }: RefundsEmptyStateProps) {
	const text = `Você não tem devoluções em "${tabLabel}".`;
	return (
		<div className="flex flex-col items-center rounded-[5px] border border-line bg-paper px-6 py-14 text-center">
			<RotateCcw
				aria-hidden="true"
				className="mb-4 size-10 text-ink-muted"
				strokeWidth={1.4}
			/>
			<p className="mb-2 text-[15.5px] text-ink">{text}</p>
			<p className="max-w-[46ch] text-[14px] text-ink-2">
				Para solicitar, abra o pedido em "Pedidos" e clique em "Solicitar
				devolução".
			</p>
		</div>
	);
}
