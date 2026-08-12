import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createNavProgressMachine,
	shouldTrackNavigation,
} from "./nav-progress";

describe("shouldTrackNavigation", () => {
	const CURRENT = "http://localhost:3003/catalog?cat=eletricas";

	it("rastreia quando o pathname muda", () => {
		expect(shouldTrackNavigation("/sobre", CURRENT)).toBe(true);
	});

	it("rastreia quando só a query muda", () => {
		expect(shouldTrackNavigation("/catalog?cat=manuais", CURRENT)).toBe(true);
		expect(shouldTrackNavigation("/catalog", CURRENT)).toBe(true);
	});

	// Sem mudança de pathname/search o App Router não emite novo pathname/
	// searchParams — o sinal de chegada nunca vem e a barra ficaria presa.
	it("ignora navegação para a URL idêntica", () => {
		expect(shouldTrackNavigation("/catalog?cat=eletricas", CURRENT)).toBe(
			false
		);
		expect(shouldTrackNavigation(CURRENT, CURRENT)).toBe(false);
	});

	it("ignora mudança só de hash (é scroll, não carregamento)", () => {
		expect(shouldTrackNavigation("/catalog?cat=eletricas#topo", CURRENT)).toBe(
			false
		);
		expect(shouldTrackNavigation("/sobre#filiais", "http://x.dev/sobre")).toBe(
			false
		);
	});

	it("ignora ordem diferente dos mesmos parâmetros", () => {
		expect(
			shouldTrackNavigation(
				"/catalog?b=2&a=1",
				"http://localhost:3003/catalog?a=1&b=2"
			)
		).toBe(false);
	});

	it("ignora destino de outra origem", () => {
		expect(shouldTrackNavigation("https://outro.site/catalog", CURRENT)).toBe(
			false
		);
	});

	it("href atual inválido não rastreia nem lança", () => {
		expect(() => shouldTrackNavigation("/catalog", "")).not.toThrow();
		expect(shouldTrackNavigation("/catalog", "")).toBe(false);
	});
});

describe("createNavProgressMachine", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("começa idle e só fica ativo depois do delay (nunca pisca)", () => {
		const m = createNavProgressMachine({ delayMs: 150 });
		expect(m.getState()).toBe("idle");

		m.start();
		expect(m.getState()).toBe("delay");

		vi.advanceTimersByTime(149);
		expect(m.getState()).toBe("delay");

		vi.advanceTimersByTime(1);
		expect(m.getState()).toBe("active");
	});

	it("navegação rápida: finish durante o delay volta pra idle sem mostrar nada", () => {
		const m = createNavProgressMachine({ delayMs: 150 });
		m.start();
		vi.advanceTimersByTime(100);
		m.finish();
		expect(m.getState()).toBe("idle");

		// o timer de delay pendente não pode reativar depois
		vi.advanceTimersByTime(200);
		expect(m.getState()).toBe("idle");
	});

	it("finish com barra ativa passa por done e volta pra idle", () => {
		const m = createNavProgressMachine({ delayMs: 150, doneMs: 250 });
		m.start();
		vi.advanceTimersByTime(150);
		expect(m.getState()).toBe("active");

		m.finish();
		expect(m.getState()).toBe("done");

		vi.advanceTimersByTime(250);
		expect(m.getState()).toBe("idle");
	});

	it("start durante active mantém a barra ativa (segunda navegação em voo)", () => {
		const m = createNavProgressMachine({ delayMs: 150 });
		m.start();
		vi.advanceTimersByTime(150);
		expect(m.getState()).toBe("active");

		m.start();
		expect(m.getState()).toBe("active");
	});

	it("start durante done reinicia o ciclo em delay", () => {
		const m = createNavProgressMachine({ delayMs: 150, doneMs: 250 });
		m.start();
		vi.advanceTimersByTime(150);
		m.finish();
		expect(m.getState()).toBe("done");

		m.start();
		expect(m.getState()).toBe("delay");
	});

	it("teto de segurança: barra nunca fica pendurada sem finish", () => {
		const m = createNavProgressMachine({
			delayMs: 150,
			doneMs: 250,
			maxMs: 8000,
		});
		m.start();
		vi.advanceTimersByTime(150 + 8000);
		expect(m.getState()).toBe("done");
		vi.advanceTimersByTime(250);
		expect(m.getState()).toBe("idle");
	});

	it("finish sem start é no-op", () => {
		const m = createNavProgressMachine();
		m.finish();
		expect(m.getState()).toBe("idle");
	});

	it("notifica subscribers a cada mudança de estado e para após unsubscribe", () => {
		const m = createNavProgressMachine({ delayMs: 150 });
		const seen: string[] = [];
		const unsubscribe = m.subscribe((s) => seen.push(s));

		m.start();
		vi.advanceTimersByTime(150);
		expect(seen).toEqual(["delay", "active"]);

		unsubscribe();
		m.finish();
		expect(seen).toEqual(["delay", "active"]);
	});
});
