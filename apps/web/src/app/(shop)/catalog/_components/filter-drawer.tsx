"use client";

import { X } from "lucide-react";
import { useOverlay } from "@/lib/use-overlay";

interface FilterDrawerProps {
	activeCount: number;
	children: React.ReactNode;
	onClearAll: () => void;
	onClose: () => void;
	open: boolean;
	total: number;
}

/**
 * Drawer de filtros mobile. Overlay próprio (não Base UI Sheet) por controle
 * total do ciclo abrir/fechar e do scroll-lock — evita o conflito do React
 * Compiler com a gestão de transição/unmount da Base UI. Esc, focus-trap, trava
 * de scroll e restauração de foco vêm do `useOverlay`.
 */
export function FilterDrawer({
	open,
	onClose,
	total,
	activeCount,
	onClearAll,
	children,
}: FilterDrawerProps) {
	const panelRef = useOverlay(open, onClose);

	if (!open) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[65] lg:hidden">
			<button
				aria-label="Fechar filtros"
				className="fade-in absolute inset-0 animate-in cursor-default border-none bg-grafite-deep/60 duration-200"
				onClick={onClose}
				tabIndex={-1}
				type="button"
			/>
			<div
				aria-label="Filtros"
				aria-modal="true"
				className="slide-in-from-right absolute inset-y-0 right-0 flex w-[min(400px,92vw)] animate-in flex-col bg-paper text-ink shadow-[-8px_0_28px_-10px_rgba(0,0,0,0.4)] duration-300 ease-out-expo motion-reduce:animate-none"
				id="filter-drawer"
				ref={panelRef}
				role="dialog"
			>
				<div className="flex min-h-16 shrink-0 items-center justify-between gap-2.5 border-line border-b py-2 pr-2 pl-5">
					<span className="font-display font-extrabold text-[26px] uppercase leading-none">
						Filtros
					</span>
					<button
						aria-label="Fechar filtros"
						className="grid size-11 cursor-pointer place-items-center rounded-[3px] hover:bg-canteiro"
						onClick={onClose}
						type="button"
					>
						<X aria-hidden="true" className="size-6" />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto overscroll-contain px-5">
					{children}
				</div>

				<div className="grid grid-cols-[auto_1fr] gap-2.5 border-line border-t bg-canteiro px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
					<button
						className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] border-line-strong bg-paper px-[18px] font-bold text-[15px] text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-45"
						disabled={activeCount === 0}
						onClick={onClearAll}
						type="button"
					>
						Limpar
					</button>
					<button
						className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[3px] bg-grafite px-[18px] font-bold text-[15px] text-on-dark hover:bg-black"
						onClick={onClose}
						type="button"
					>
						Ver {total} produto{total === 1 ? "" : "s"}
					</button>
				</div>
			</div>
		</div>
	);
}
