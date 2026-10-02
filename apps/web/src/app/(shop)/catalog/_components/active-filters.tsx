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
		<div className="-mx-4 mb-[18px] flex items-center gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&>*]:shrink-0">
			{filters.map((f) => (
				<button
					aria-label={`Remover filtro ${f.kind ? `${f.kind} ` : ""}${f.value}`}
					className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-grafite bg-grafite py-0 pr-2 pl-3.5 font-semibold text-[14.5px] text-on-dark hover:bg-black"
					key={f.id}
					onClick={() => onRemove(f.remove)}
					type="button"
				>
					{f.kind && <span className="text-on-dark-muted">{f.kind}:</span>}
					{f.value}
					<X aria-hidden="true" className="size-4 text-on-dark-muted" />
				</button>
			))}
			{filters.length > 1 && (
				<button
					className="inline-flex min-h-10 cursor-pointer items-center px-1 font-bold text-[14.5px] text-ink underline underline-offset-[3px]"
					onClick={onClearAll}
					type="button"
				>
					Limpar tudo
				</button>
			)}
		</div>
	);
}
