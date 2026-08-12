"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
	createNavProgressMachine,
	shouldTrackNavigation,
} from "@/lib/nav-progress";

// Instância de módulo: o instrumentation-client.ts dispara "emach:navstart" no
// onRouterTransitionStart (único sinal global de navegação do App Router). Não
// existe evento nativo de fim — a chegada é detectada pela mudança de
// pathname/searchParams; o teto de segurança da máquina cobre o resto.
const machine = createNavProgressMachine();

export function NavigationProgress() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const state = useSyncExternalStore(
		machine.subscribe,
		machine.getState,
		machine.getState
	);

	useEffect(() => {
		const onStart = (event: Event) => {
			const url = (event as CustomEvent<{ url?: string }>).detail?.url;
			// Sem mudança de pathname/searchParams não há sinal de chegada — armar
			// a barra a deixaria varrendo até o teto, e nada está carregando.
			if (url && !shouldTrackNavigation(url, window.location.href)) {
				return;
			}
			machine.start();
		};
		window.addEventListener("emach:navstart", onStart);
		return () => window.removeEventListener("emach:navstart", onStart);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname/searchParams mudarem É o sinal de chegada da rota — o efeito não lê os valores.
	useEffect(() => {
		machine.finish();
	}, [pathname, searchParams]);

	if (state === "idle" || state === "delay") {
		return null;
	}

	return (
		<div aria-hidden="true" className="emach-nav-progress" data-state={state}>
			<div className="emach-nav-progress__bar" />
		</div>
	);
}
