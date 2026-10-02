"use client";

import { Minus, Plus } from "lucide-react";

interface QtyStepperProps {
	max?: number;
	onChange: (next: number) => void;
	value: number;
}

const stepClass =
	"grid h-full w-11 cursor-pointer place-items-center hover:bg-canteiro disabled:cursor-not-allowed disabled:opacity-35";

/** Quantidade da compra (página de produto e "Ver rápido"), 52px de altura. */
export function QtyStepper({ max = 20, onChange, value }: QtyStepperProps) {
	return (
		<fieldset className="flex h-[52px] shrink-0 items-center rounded-[3px] border-[1.5px] border-line-strong bg-paper">
			<legend className="sr-only">Quantidade</legend>
			<button
				aria-label="Diminuir quantidade"
				className={stepClass}
				disabled={value <= 1}
				onClick={() => onChange(Math.max(1, value - 1))}
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
				className={stepClass}
				disabled={value >= max}
				onClick={() => onChange(Math.min(max, value + 1))}
				type="button"
			>
				<Plus aria-hidden="true" className="size-4" />
			</button>
		</fieldset>
	);
}
