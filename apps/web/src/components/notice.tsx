import { cn } from "@emach/ui/lib/utils";
import { CircleAlert, Info } from "lucide-react";
import type { ReactNode } from "react";

const TONE = {
	info: {
		box: "border-line bg-canteiro text-ink-2",
		Icon: Info,
		icon: "text-ink-2",
	},
	error: {
		box: "border-error-text bg-paper text-error-text",
		Icon: CircleAlert,
		icon: "text-error-text",
	},
} as const;

export function Notice({
	action,
	children,
	tone = "info",
}: {
	action?: ReactNode;
	children: ReactNode;
	tone?: keyof typeof TONE;
}) {
	const { box, Icon, icon } = TONE[tone];
	return (
		<div
			className={cn(
				"flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[5px] border px-4 py-3 text-[14px] leading-snug",
				box
			)}
			role={tone === "error" ? "alert" : undefined}
		>
			<Icon
				aria-hidden="true"
				className={cn("mt-px size-[18px] shrink-0", icon)}
			/>
			<div className="min-w-[16ch] flex-1">{children}</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	);
}
