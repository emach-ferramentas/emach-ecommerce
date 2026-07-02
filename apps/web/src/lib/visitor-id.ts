"use client";

const STORAGE_KEY = "emach:visitor:v1";

let fallbackId: string | null = null;

/**
 * Id pseudônimo de visitante para `cart_event.session_id`. Persistente em
 * localStorage (mesma vida útil do carrinho, que também é localStorage) —
 * permite dedup analítica futura no admin. Se o storage estiver indisponível
 * (modo privado restrito), degrada para um id por page-load em memória:
 * `session_id` é NOT NULL no banco e o evento vale mais que a continuidade.
 */
export function getVisitorId(): string {
	try {
		const existing = localStorage.getItem(STORAGE_KEY);
		if (existing) {
			return existing;
		}
		const id = crypto.randomUUID();
		localStorage.setItem(STORAGE_KEY, id);
		return id;
	} catch {
		fallbackId ??= crypto.randomUUID();
		return fallbackId;
	}
}
