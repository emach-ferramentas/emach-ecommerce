import { cn } from "@emach/ui/lib/utils";

/** Contagem ao lado do título de seção (prateleira, ofertas), como etiqueta. */
export function CountChip({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<p
			className={cn(
				"inline-flex min-h-[26px] items-center rounded-[3px] border border-line bg-paper px-2.5 font-semibold text-[13.5px] text-ink-2 tabular-nums",
				className
			)}
		>
			{children}
		</p>
	);
}
