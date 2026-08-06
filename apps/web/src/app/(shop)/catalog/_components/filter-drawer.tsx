"use client";

import { X } from "lucide-react";
import { EmachButton } from "@/components/emach-button";
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
		<div className="fade-in fixed inset-0 z-50 animate-in duration-150 lg:hidden">
			<button
				aria-label="Fechar filtros"
				className="absolute inset-0 cursor-default border-none bg-black/50"
				onClick={onClose}
				type="button"
			/>
			<div
				aria-label="Filtros"
				aria-modal="true"
				className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-gray-10 text-near-black"
				id="filter-drawer"
				ref={panelRef}
				role="dialog"
			>
				<div className="flex items-center justify-between gap-2 border-emach-red border-b-2 bg-near-black px-5 py-4">
					<span className="font-bold font-display text-[15px] text-white uppercase tracking-[0.14em]">
						Filtros
					</span>
					<button
						aria-label="Fechar filtros"
						className="-mr-3 flex size-11 cursor-pointer items-center justify-center text-white/70 transition-colors hover:text-white active:text-white/80"
						onClick={onClose}
						type="button"
					>
						<X className="size-5" />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

				<div className="flex items-center gap-3 border-border border-t bg-gray-10 p-4">
					{activeCount > 0 && (
						<button
							className="inline-flex min-h-11 cursor-pointer items-center px-3 font-display font-semibold text-[12px] text-emach-red-deep uppercase tracking-[0.08em] transition-opacity active:opacity-60"
							onClick={onClearAll}
							type="button"
						>
							Limpar
						</button>
					)}
					<EmachButton className="flex-1" onClick={onClose} variant="primary">
						Ver {total} produto{total === 1 ? "" : "s"}
					</EmachButton>
				</div>
			</div>
		</div>
	);
}
