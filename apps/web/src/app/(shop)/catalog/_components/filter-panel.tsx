"use client";

import type { CategoryNode } from "@emach/db/queries/categories";
import { Checkbox } from "@emach/ui/components/checkbox";
import type { VoltageKey } from "../_lib/catalog-filters";
import { CategoryTree } from "./category-tree";

const VOLTAGE_OPTIONS: VoltageKey[] = ["127V", "220V", "Bivolt", "380V"];

interface FilterPanelProps {
	activeSlug: string | null;
	/** Prefixo de id p/ evitar colisão entre instâncias (desktop × drawer). */
	idPrefix: string;
	onApplyPrice: () => void;
	onlyPromo: boolean;
	onPmaxChange: (value: string) => void;
	onPminChange: (value: string) => void;
	onSelectCategory: (slug: string | null) => void;
	onTogglePromo: (value: boolean) => void;
	onToggleVoltage: (value: VoltageKey) => void;
	pmaxValue: string;
	pminValue: string;
	tree: CategoryNode[];
	voltages: VoltageKey[];
}

/**
 * Corpo dos filtros do catálogo, compartilhado entre a sidebar desktop
 * (`hidden lg:block`) e o drawer mobile (`Sheet`). `idPrefix` mantém os
 * `htmlFor`/`id` únicos quando ambas as instâncias coexistem no DOM.
 */
export function FilterPanel({
	idPrefix,
	tree,
	activeSlug,
	onSelectCategory,
	pminValue,
	pmaxValue,
	onPminChange,
	onPmaxChange,
	onApplyPrice,
	onlyPromo,
	onTogglePromo,
	voltages,
	onToggleVoltage,
}: FilterPanelProps) {
	const promoId = `${idPrefix}-filter-promo`;

	return (
		<div>
			<div className="mb-6">
				<CategoryTree
					activeSlug={activeSlug}
					onSelect={onSelectCategory}
					tree={tree}
				/>
			</div>

			<div className="mb-6">
				<div className="mb-2.5 font-semibold text-[13px]">Faixa de preço</div>
				<div className="flex items-center gap-2">
					<input
						aria-label="Preço mínimo"
						className="emach-input emach-input--sm w-full"
						inputMode="numeric"
						onBlur={onApplyPrice}
						onChange={(e) => onPminChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								onApplyPrice();
							}
						}}
						placeholder="Mín"
						type="number"
						value={pminValue}
					/>
					<span className="text-[13px] text-gray-60">—</span>
					<input
						aria-label="Preço máximo"
						className="emach-input emach-input--sm w-full"
						inputMode="numeric"
						onBlur={onApplyPrice}
						onChange={(e) => onPmaxChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								onApplyPrice();
							}
						}}
						placeholder="Máx"
						type="number"
						value={pmaxValue}
					/>
				</div>
				<div className="mt-1.5 text-[11px] text-gray-60">Em reais</div>
			</div>

			<div className="mb-6">
				<label
					className="flex cursor-pointer items-center gap-2"
					htmlFor={promoId}
				>
					<Checkbox
						checked={onlyPromo}
						id={promoId}
						onCheckedChange={(v) => onTogglePromo(v === true)}
					/>
					Apenas em promoção
				</label>
			</div>

			<div className="mb-6 flex flex-col gap-1">
				<div className="mb-2.5 font-semibold text-[13px]">Voltagem</div>
				{VOLTAGE_OPTIONS.map((v) => {
					const id = `${idPrefix}-filter-voltage-${v}`;
					return (
						<label
							className="flex cursor-pointer items-center gap-2"
							htmlFor={id}
							key={v}
						>
							<Checkbox
								checked={voltages.includes(v)}
								id={id}
								onCheckedChange={() => onToggleVoltage(v)}
							/>
							{v}
						</label>
					);
				})}
			</div>
		</div>
	);
}
