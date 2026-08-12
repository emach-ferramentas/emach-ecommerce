// Máquina de estados da hairline de navegação (framework-free, testada com
// fake timers). O componente NavigationProgress traduz: "delay" = nada visível
// (evita piscar em navegação rápida), "active" = varredura, "done" = completa
// e some, "idle" = desmontada.

export type NavProgressState = "idle" | "delay" | "active" | "done";

/**
 * A barra só pode ser armada quando existe sinal de chegada.
 *
 * O App Router avisa o INÍCIO de toda transição (onRouterTransitionStart), mas
 * não tem evento de fim: quem detecta a chegada é a mudança de
 * pathname/searchParams. Navegação para a mesma URL (ex.: "Limpar filtros" sem
 * filtro ativo, re-clicar no sort já ativo) ou só de hash (nav "Filiais" dentro
 * de /sobre) não muda nenhum dos dois — a barra apareceria e ficaria varrendo
 * até o teto de segurança, justamente onde nada carrega.
 */
export function shouldTrackNavigation(
	targetUrl: string,
	currentHref: string
): boolean {
	try {
		const target = new URL(targetUrl, currentHref);
		const current = new URL(currentHref);
		if (target.origin !== current.origin) {
			return false;
		}
		if (target.pathname !== current.pathname) {
			return true;
		}
		target.searchParams.sort();
		current.searchParams.sort();
		return target.searchParams.toString() !== current.searchParams.toString();
	} catch {
		return false;
	}
}

export interface NavProgressOptions {
	/** Espera antes de mostrar a barra — navegação mais rápida que isto nunca pisca. */
	delayMs?: number;
	/** Duração do estado "done" (barra completa + fade) antes de voltar a idle. */
	doneMs?: number;
	/** Teto de segurança: sem finish até aqui, a barra completa sozinha. */
	maxMs?: number;
}

export interface NavProgressMachine {
	finish(): void;
	getState(): NavProgressState;
	start(): void;
	subscribe(listener: (state: NavProgressState) => void): () => void;
}

export function createNavProgressMachine({
	delayMs = 150,
	doneMs = 250,
	maxMs = 8000,
}: NavProgressOptions = {}): NavProgressMachine {
	let state: NavProgressState = "idle";
	const listeners = new Set<(s: NavProgressState) => void>();
	let delayTimer: ReturnType<typeof setTimeout> | undefined;
	let doneTimer: ReturnType<typeof setTimeout> | undefined;
	let maxTimer: ReturnType<typeof setTimeout> | undefined;

	function clearTimers() {
		clearTimeout(delayTimer);
		clearTimeout(doneTimer);
		clearTimeout(maxTimer);
	}

	function setState(next: NavProgressState) {
		if (next === state) {
			return;
		}
		state = next;
		for (const listener of listeners) {
			listener(state);
		}
	}

	function toDone() {
		clearTimers();
		setState("done");
		doneTimer = setTimeout(() => {
			setState("idle");
		}, doneMs);
	}

	function toActive() {
		setState("active");
		maxTimer = setTimeout(toDone, maxMs);
	}

	return {
		start() {
			if (state === "active") {
				// Segunda navegação em voo: mantém a barra, só renova o teto.
				clearTimeout(maxTimer);
				maxTimer = setTimeout(toDone, maxMs);
				return;
			}
			clearTimers();
			setState("delay");
			delayTimer = setTimeout(toActive, delayMs);
		},
		finish() {
			if (state === "delay") {
				clearTimers();
				setState("idle");
				return;
			}
			if (state === "active") {
				toDone();
			}
		},
		getState() {
			return state;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
