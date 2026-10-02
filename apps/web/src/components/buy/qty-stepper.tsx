"use client";

import { cn } from "@emach/ui/lib/utils";
import { Minus, Plus } from "lucide-react";

interface QtyStepperProps {
	label?: string;
	max?: number;
	min?: number;
	onChange: (next: number) => void;
	size?: "lg" | "md";
	value: number;
}

export function stepQty(
	value: number,
	delta: -1 | 1,
	min: number,
	max: number
): number {
	return Math.min(max, Math.max(min, value + delta));
}

const SIZE_CLASS = {
	lg: { box: "h-[52px]", step: "h-full w-11" },
	md: { box: "", step: "size-11" },
} as const;

const stepClass =
	"grid cursor-pointer place-items-center hover:bg-canteiro disabled:cursor-not-allowed disabled:opacity-35";

export function QtyStepper({
	label = "Quantidade",
	max = 20,
	min = 1,
	onChange,
	size = "lg",
	value,
}: QtyStepperProps) {
	const sizeClass = SIZE_CLASS[size];
	return (
		<fieldset
			className={cn(
				"flex shrink-0 items-center rounded-[3px] border-[1.5px] border-line-strong bg-paper",
				sizeClass.box
			)}
		>
			<legend className="sr-only">{label}</legend>
			<button
				aria-label="Diminuir quantidade"
				className={cn(stepClass, sizeClass.step)}
				disabled={value <= min}
				onClick={() => onChange(stepQty(value, -1, min, max))}
				type="button"
			>
				<Minus aria-hidden="true" className="size-4" />
			</button>
			<output
				aria-live="polite"
				className="min-w-[34px] text-center font-extrabold tabular-nums"
			>
				{value}
			</output>
			<button
				aria-label="Aumentar quantidade"
				className={cn(stepClass, sizeClass.step)}
				disabled={value >= max}
				onClick={() => onChange(stepQty(value, 1, min, max))}
				type="button"
			>
				<Plus aria-hidden="true" className="size-4" />
			</button>
		</fieldset>
	);
}
