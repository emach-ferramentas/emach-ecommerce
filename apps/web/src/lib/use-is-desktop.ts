"use client";

import { useEffect, useState } from "react";

/**
 * `true` quando o viewport está no breakpoint desktop do Tailwind (`lg`, ≥1024px).
 * Default `false` (mobile-first) no SSR/1º paint — vira `true` pós-mount onde casa.
 * Use só para gates que **não** dão pra resolver em CSS puro (ex.: animação framer
 * cara só-desktop); preferência sempre por classes `lg:` quando o CSS resolve.
 */
export function useIsDesktop(): boolean {
	const [isDesktop, setIsDesktop] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 1024px)");
		const update = () => setIsDesktop(mq.matches);
		update();
		mq.addEventListener("change", update);

		return () => mq.removeEventListener("change", update);
	}, []);

	return isDesktop;
}
