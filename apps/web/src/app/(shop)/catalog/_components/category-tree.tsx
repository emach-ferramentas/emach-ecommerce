"use client";

import type { CategoryNode } from "@emach/db/queries/catalog";
import { cn } from "@emach/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { collectPathToActive } from "../_lib/category-tree";

interface CategoryTreeProps {
	activeSlug: string | null;
	/** Contagem de produtos por categoria (id → total). Opcional; ver ADR-0009. */
	counts?: Record<string, number>;
	onSelect: (slug: string | null) => void;
	tree: CategoryNode[];
}

export function CategoryTree({
	tree,
	activeSlug,
	counts,
	onSelect,
}: CategoryTreeProps) {
	const [expanded, setExpanded] = useState<Set<string>>(() =>
		collectPathToActive(tree, activeSlug)
	);

	// Recomputado a cada render (barato): caminho do filtro ativo, p/ a faixa.
	const activePath = collectPathToActive(tree, activeSlug);

	function toggle(id: string) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	function select(node: CategoryNode) {
		onSelect(node.slug);
		if (node.children.length > 0 && !expanded.has(node.id)) {
			toggle(node.id);
		}
	}

	function renderNode(node: CategoryNode, depth: number) {
		const hasChildren = node.children.length > 0;
		const isOpen = expanded.has(node.id);
		const isActive = node.slug === activeSlug;
		const count = counts?.[node.id];
		const indent = 4 + depth * 14;

		return (
			<div key={node.id}>
				<div className="flex items-center">
					{hasChildren ? (
						<button
							aria-expanded={isOpen}
							aria-label={
								isOpen ? `Recolher ${node.name}` : `Expandir ${node.name}`
							}
							className="flex size-6 shrink-0 items-center justify-center text-gray-50 hover:text-near-black"
							onClick={() => toggle(node.id)}
							type="button"
						>
							<ChevronRight
								className={cn(
									"size-3 transition-transform duration-200",
									isOpen && "rotate-90"
								)}
							/>
						</button>
					) : (
						<span aria-hidden="true" className="size-6 shrink-0" />
					)}
					<button
						aria-current={isActive ? "page" : undefined}
						className={cn(
							"flex flex-1 items-center gap-2 py-1.5 pr-2 text-left text-[14px] transition-colors hover:text-near-black",
							isActive
								? "font-bold text-emach-red-deep"
								: depth === 0
									? "font-semibold text-near-black"
									: "text-gray-60"
						)}
						onClick={() => select(node)}
						style={{ paddingLeft: `${indent}px` }}
						type="button"
					>
						<span className="flex-1">{node.name}</span>
						{count != null && (
							<span className="text-[11px] text-gray-50 tabular-nums">
								{count}
							</span>
						)}
					</button>
				</div>
				{hasChildren && isOpen && (
					<div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
				)}
			</div>
		);
	}

	return (
		<nav aria-label="Categorias" className="flex flex-col">
			<div className="mb-2.5 font-semibold text-[13px]">Categoria</div>
			<button
				aria-current={activeSlug === null ? "page" : undefined}
				className={cn(
					"py-1.5 pl-4 text-left text-[14px] transition-colors hover:text-near-black",
					activeSlug === null
						? "font-bold text-emach-red-deep"
						: "font-semibold text-near-black"
				)}
				onClick={() => onSelect(null)}
				type="button"
			>
				Todas
			</button>
			{tree.map((root) =>
				activePath.has(root.id) ? (
					<div className="border-emach-red border-l-2" key={root.id}>
						{renderNode(root, 0)}
					</div>
				) : (
					<div className="border-l-2 border-l-transparent" key={root.id}>
						{renderNode(root, 0)}
					</div>
				)
			)}
		</nav>
	);
}
