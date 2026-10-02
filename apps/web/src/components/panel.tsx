import { cn } from "@emach/ui/lib/utils";
import type { ReactNode } from "react";

const TONE_CLASS = {
	paper: "bg-paper",
	canteiro: "bg-canteiro",
} as const;

interface PanelProps {
	actions?: ReactNode;
	as?: "section" | "aside";
	children: ReactNode;
	className?: string;
	flush?: boolean;
	id?: string;
	title: string;
	tone?: keyof typeof TONE_CLASS;
}

export function Panel({
	actions,
	as: Tag = "section",
	children,
	className,
	flush = false,
	id,
	title,
	tone = "paper",
}: PanelProps) {
	return (
		<Tag
			className={cn(
				"scroll-mt-20 rounded-[5px] border border-line",
				TONE_CLASS[tone],
				className
			)}
			id={id}
		>
			<div className="flex items-center justify-between gap-4 px-5 pt-5 md:px-6 md:pt-6">
				<h2 className="font-extrabold text-[17px] text-ink">{title}</h2>
				{actions}
			</div>
			<div className={flush ? "mt-4" : "px-5 pt-4 pb-5 md:px-6 md:pb-6"}>
				{children}
			</div>
		</Tag>
	);
}

const VALUE_TONE_CLASS = {
	muted: "text-ink-muted",
	discount: "text-ok",
} as const;

export function SummaryRow({
	children,
	label,
	tone,
	total = false,
}: {
	children: ReactNode;
	label: string;
	tone?: keyof typeof VALUE_TONE_CLASS;
	total?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex items-baseline justify-between gap-4 text-[15px]",
				total ? "mt-3 border-line border-t pt-3" : "py-1"
			)}
		>
			<span className={total ? "font-bold text-ink" : "text-ink-2"}>
				{label}
			</span>
			<span
				className={cn(
					"text-right tabular-nums",
					tone ? VALUE_TONE_CLASS[tone] : "text-ink",
					total && "font-extrabold text-[25px]"
				)}
			>
				{children}
			</span>
		</div>
	);
}
