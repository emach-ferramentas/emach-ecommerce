"use client";

import { Button } from "@emach/ui/components/button";
import { cn } from "@emach/ui/lib/utils";
import { MinusIcon, PlusIcon } from "lucide-react";

interface QuantityPickerProps {
	className?: string;
	max?: number;
	min?: number;
	onChange: (next: number) => void;
	value: number;
}

export const QuantityPicker = ({
	value,
	onChange,
	min = 1,
	max = 99,
	className,
}: QuantityPickerProps) => {
	const decrement = () => onChange(Math.max(min, value - 1));
	const increment = () => onChange(Math.min(max, value + 1));

	return (
		<div className={cn("flex items-center", className)}>
			<Button
				aria-label="Diminuir quantidade"
				className="h-10 w-8"
				disabled={value <= min}
				onClick={decrement}
				size="sm"
				variant="outline"
			>
				<MinusIcon />
			</Button>
			<div
				aria-live="polite"
				className="flex h-10 w-8 items-center justify-center border-y"
			>
				{value}
			</div>
			<Button
				aria-label="Aumentar quantidade"
				className="h-10 bg-emach-red hover:bg-emach-red-hover"
				disabled={value >= max}
				onClick={increment}
				size="sm"
				variant="outline"
			>
				<PlusIcon className="text-white" />
			</Button>
		</div>
	);
};
