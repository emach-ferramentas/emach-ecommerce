"use client";

import type { Voltage } from "@emach/db/schema/tools";
import { cn } from "@emach/ui/lib/utils";
import { useId } from "react";

import { voltageLabel } from "@/lib/purchase";

export interface VoltageOption {
	id: string;
	inStock: boolean;
	/** Preço da opção quando as voltagens custam diferente; senão `null`. */
	priceLabel: string | null;
	voltage: Voltage | null;
}

interface VoltagePickerProps {
	error: boolean;
	onChange: (id: string) => void;
	options: VoltageOption[];
	value: string | null;
}

/**
 * Escolha de voltagem em botões grandes. São rádios nativos (setas do teclado
 * andam entre as opções); a opção esgotada fica visível e desabilitada.
 */
export function VoltagePicker({
	error,
	onChange,
	options,
	value,
}: VoltagePickerProps) {
	const name = useId();

	return (
		<fieldset className="mt-[22px] min-w-0">
			<legend className="font-bold text-[15px]">
				Voltagem{" "}
				<span className="font-medium text-ink-muted">
					· escolha a da tomada da obra
				</span>
			</legend>
			<div className="mt-2.5 grid grid-cols-2 gap-2.5">
				{options.map((option) => {
					const checked = option.id === value;
					const label = voltageLabel(option.voltage);
					return (
						<label
							className={cn(
								"relative grid min-h-14 cursor-pointer place-items-center content-center rounded-[3px] border-[1.5px] border-line-strong bg-paper p-1.5 text-center font-extrabold text-[18px] text-ink tabular-nums leading-tight hover:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink has-[:focus-visible]:outline-offset-2",
								checked &&
									"border-2 border-ink bg-canteiro shadow-[inset_0_-3px_0_var(--grafite)]",
								!option.inStock &&
									"cursor-not-allowed border-dashed opacity-45 hover:border-line-strong",
								error && option.inStock && "border-error-text"
							)}
							key={option.id}
						>
							<input
								checked={checked}
								className="sr-only"
								disabled={!option.inStock}
								name={name}
								onChange={() => onChange(option.id)}
								type="radio"
								value={option.id}
							/>
							{label.name}
							<small className="mt-0.5 block font-medium text-[12px] text-ink-muted">
								{option.inStock
									? (option.priceLabel ?? label.hint ?? "")
									: "Esgotado"}
							</small>
						</label>
					);
				})}
			</div>
			{error && (
				<p
					className="mt-2 font-semibold text-[14px] text-error-text"
					role="alert"
				>
					Escolha a voltagem para adicionar ao carrinho.
				</p>
			)}
		</fieldset>
	);
}
