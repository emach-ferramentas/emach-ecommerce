"use client";

import { useEffect, useState } from "react";

/**
 * Scroll-spy: `true` enquanto a seção `#id` alcança a metade superior do
 * viewport. `false` quando `enabled` é falso ou a seção não existe na página.
 * Preferir isto a rastrear `window.location.hash` — pushState do next/link
 * não dispara `hashchange`, e o hash fica stale em scroll manual.
 */
export function useSectionInView(id: string, enabled: boolean): boolean {
	const [inView, setInView] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setInView(false);
			return;
		}
		const section = document.getElementById(id);
		if (!section) {
			setInView(false);
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => setInView(entry?.isIntersecting ?? false),
			// Encolhe a raiz à metade superior: ativa quando o topo da seção
			// cruza o meio da tela (funciona também no fim da página).
			{ rootMargin: "0px 0px -50% 0px" }
		);
		observer.observe(section);
		return () => observer.disconnect();
	}, [id, enabled]);

	return inView;
}
