import { cn } from "@emach/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const TONE_CLASS = {
	ok: "text-ok",
	off: "text-off",
	alert: "text-error-text",
	neutral: "text-ink",
} as const;

export type ChipTone = keyof typeof TONE_CLASS;

export function StatusChip({
	children,
	icon: Icon,
	struck = false,
	tone,
}: {
	children: ReactNode;
	icon: LucideIcon;
	struck?: boolean;
	tone: ChipTone;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 font-bold text-[14px]",
				TONE_CLASS[tone]
			)}
		>
			<Icon aria-hidden="true" className="size-4 shrink-0" />
			<span className={struck ? "line-through" : undefined}>{children}</span>
		</span>
	);
}
