import { cn } from "@emach/ui/lib/utils";

/** "Em estoque" em verde ou "Esgotado" em cinza, com o ponto de status. */
export function StockLine({
	className,
	inStock,
}: {
	className?: string;
	inStock: boolean;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 font-bold text-[13px]",
				inStock ? "text-ok" : "text-off",
				className
			)}
		>
			<span
				aria-hidden="true"
				className={cn("size-[7px] rounded-full", inStock ? "bg-ok" : "bg-off")}
			/>
			{inStock ? "Em estoque" : "Esgotado"}
		</span>
	);
}
