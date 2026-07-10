"use client";

import type { CategoryNode } from "@emach/db/queries/categories";
import { cn } from "@emach/ui/lib/utils";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { deriveDrilldownLevel } from "../_lib/drilldown-level";

interface CategoryDrilldownProps {
	activeSlug: string | null;
	/** facetCounts.byCategory (id → count). */
	counts: Record<string, number>;
	onSelect: (slug: string | null) => void;
	/** facetCounts.total — contagem da linha "Todas". */
	totalCount: number;
	tree: CategoryNode[];
}

/**
 * Navegação de categoria por nível (drill-down): mostra só o nível atual,
 * a linha "voltar" e a categoria ativa. Clicar num item filtra por ele e
 * desce um nível; "voltar" filtra pelo pai. Substitui a árvore expandível.
 */
export function CategoryDrilldown({
	tree,
	activeSlug,
	counts,
	totalCount,
	onSelect,
}: CategoryDrilldownProps) {
	const level = deriveDrilldownLevel(tree, activeSlug);

	const rowClass =
		"flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-2 py-1 text-left text-[14px] text-gray-60 transition-colors hover:text-near-black lg:min-h-9";

	return (
		<nav aria-label="Categorias" className="flex flex-col">
			{level.back && (
				<button
					className="flex min-h-11 cursor-pointer items-center gap-1.5 px-2 py-1 text-left text-[13px] text-gray-60 transition-colors hover:text-near-black lg:min-h-9"
					onClick={() => onSelect(level.back?.slug ?? null)}
					type="button"
				>
					<ArrowLeft aria-hidden="true" className="size-3 shrink-0" />
					{level.back.name}
				</button>
			)}

			{level.active ? (
				<div
					aria-current="page"
					className="flex min-h-11 items-center bg-[#e6e6e6] px-2 py-1 font-bold text-[14px] text-near-black lg:min-h-9"
				>
					<span className="flex-1">{level.active.name}</span>
					<span className="pl-2 text-[11.5px] text-gray-60 tabular-nums">
						{counts[level.active.id] ?? 0}
					</span>
				</div>
			) : (
				<div
					aria-current="page"
					className="flex min-h-11 items-center bg-[#e6e6e6] px-2 py-1 font-bold text-[14px] text-near-black lg:min-h-9"
				>
					<span className="flex-1">Todas</span>
					<span className="pl-2 text-[11.5px] text-gray-60 tabular-nums">
						{totalCount}
					</span>
				</div>
			)}

			<div
				className={cn(
					"flex flex-col",
					level.rowsAreChildren && "ml-2.5 border-border border-l pl-1.5"
				)}
			>
				{level.rows.map((row) => (
					<button
						className={rowClass}
						key={row.id}
						onClick={() => onSelect(row.slug)}
						type="button"
					>
						<span className="flex-1">{row.name}</span>
						{row.hasChildren && (
							<ChevronDown
								aria-hidden="true"
								className="size-3 shrink-0 text-gray-60"
							/>
						)}
						<span className="pl-1 text-[11.5px] text-gray-60 tabular-nums">
							{counts[row.id] ?? 0}
						</span>
					</button>
				))}
			</div>
		</nav>
	);
}
