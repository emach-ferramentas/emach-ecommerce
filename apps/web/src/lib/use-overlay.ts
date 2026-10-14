"use client";

import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function cycleFocus(container: HTMLElement, e: KeyboardEvent) {
	const focusables = Array.from(
		container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
	);

	const first = focusables[0];
	const last = focusables.at(-1);

	if (!(first && last)) {
		return;
	}

	const active = document.activeElement as HTMLElement | null;

	if (e.shiftKey && active === first) {
		e.preventDefault();
		last.focus();
	} else if (!e.shiftKey && active === last) {
		e.preventDefault();
		first.focus();
	}
}

interface UseOverlayOptions {
	/**
	 * Foca o 1º elemento focável do painel ao abrir (default `true`). Desligar
	 * quando o painel já gerencia o foco inicial (ex.: `<input autoFocus>`).
	 */
	autoFocus?: boolean;
}

/**
 * Mecânica compartilhada dos overlays modais client-side do storefront: trava o
 * scroll do body, Esc fecha, Tab cicla o foco dentro do painel (focus-trap),
 * foca o painel ao abrir e devolve o foco ao elemento anterior ao fechar.
 *
 * Substitui a Base UI `Sheet`/`Dialog`: a gestão de transição/unmount dela
 * conflita com o React Compiler (o painel abre em `opacity:0` e não desmonta,
 * capturando cliques de forma invisível). `onClose` é lido via ref, então o
 * effect só re-roda quando `open` muda — sem thrash de scroll-lock nem roubo de
 * foco a cada re-render do pai.
 *
 * Só cuida do comportamento; cada componente mantém o próprio markup/posição.
 */
export function useOverlay(
	open: boolean,
	onClose: () => void,
	{ autoFocus = true }: UseOverlayOptions = {}
): RefObject<HTMLDivElement | null> {
	const panelRef = useRef<HTMLDivElement>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		if (!open) {
			return;
		}

		const previouslyFocused = document.activeElement as HTMLElement | null;

		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onCloseRef.current();

				return;
			}

			if (e.key === "Tab" && panelRef.current) {
				cycleFocus(panelRef.current, e);
			}
		};

		document.addEventListener("keydown", onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		if (autoFocus) {
			panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
		}

		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prevOverflow;
			previouslyFocused?.focus?.();
		};
	}, [open, autoFocus]);

	return panelRef;
}
