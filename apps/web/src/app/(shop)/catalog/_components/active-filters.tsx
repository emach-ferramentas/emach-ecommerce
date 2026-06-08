"use client";

import { X } from "lucide-react";
import type { ActiveFilter, FilterUpdate } from "../_lib/catalog-filters";

interface ActiveFiltersProps {
	filters: ActiveFilter[];
	onClearAll: () => void;
	onRemove: (update: FilterUpdate) => void;
}

export function ActiveFilters({
	filters,
	onRemove,
	onClearAll,
}: ActiveFiltersProps) {
	if (filters.length === 0) {
		return null;
	}

	return (
		<div className="mb-4 flex flex-wrap items-center gap-2">
			<span className="mr-0.5 font-bold font-display text-[11px] text-gray-50 uppercase tracking-[0.12em]">
				Filtros
			</span>
			{filters.map((f) => (
				<span
					className="inline-flex items-center gap-2 rounded-[2px] border border-border bg-white py-1 pr-1.5 pl-2.5 text-[12.5px] text-near-black"
					key={f.id}
				>
					{f.kind && (
						<span className="font-display text-[10px] text-gray-50 uppercase tracking-[0.1em]">
							{f.kind}
						</span>
					)}
					<span>{f.value}</span>
					<button
						aria-label={`Remover filtro ${f.kind || f.value}`}
						className="flex size-4 items-center justify-center text-gray-50 transition-colors hover:text-near-black"
						onClick={() => onRemove(f.remove)}
						type="button"
					>
						<X className="size-3" />
					</button>
				</span>
			))}
			<button
				className="ml-1 font-display text-[11px] text-emach-red-deep uppercase tracking-[0.08em] hover:text-emach-red"
				onClick={onClearAll}
				type="button"
			>
				Limpar tudo
			</button>
		</div>
	);
}
