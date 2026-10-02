import { cn } from "@emach/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StepState = "done" | "current" | "upcoming" | "ok";

export interface StepperStep {
	Icon: LucideIcon;
	key: string;
	label: string;
	state: StepState;
}

const NODE_CLASS: Record<StepState, string> = {
	ok: "border-ok bg-ok text-white",
	current: "border-ink bg-ink text-white",
	done: "border-ink bg-paper text-ink",
	upcoming: "border-line-strong bg-paper text-ink-muted",
};

const LABEL_CLASS: Record<StepState, string> = {
	ok: "font-bold text-ok",
	current: "font-bold text-ink",
	done: "text-ink-2",
	upcoming: "text-ink-muted",
};

export function StatusStepper({ steps }: { steps: StepperStep[] }) {
	return (
		<div className="flex items-start border-line border-t px-3 pt-5 pb-4 sm:px-[18px]">
			{steps.map((step, idx) => (
				<div className="contents" key={step.key}>
					{idx > 0 && (
						<div
							className={cn(
								"mt-[18px] h-[2px] min-w-1 flex-1",
								isFilled(steps[idx - 1].state) ? "bg-ink" : "bg-line-strong"
							)}
						/>
					)}
					<div className="flex min-w-0 basis-[88px] flex-col items-center">
						<span
							className={cn(
								"flex h-[38px] w-[38px] items-center justify-center rounded-full border-[1.5px]",
								NODE_CLASS[step.state]
							)}
						>
							<step.Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
						</span>
						<span
							className={cn(
								"mt-[9px] text-center text-[12px] leading-tight sm:text-[13px]",
								LABEL_CLASS[step.state]
							)}
						>
							{step.label}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

function isFilled(state: StepState): boolean {
	return state === "done" || state === "ok";
}
