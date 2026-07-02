import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit-only: todas as bordas (db, sessão, rate limit, headers) mockadas — não
// entra na lista INTEGRATION do vitest.config.ts.
const {
	values,
	insert,
	getCurrentClient,
	limit,
	getClientIp,
	logError,
	logWarn,
} = vi.hoisted(() => {
	const valuesFn = vi.fn();
	return {
		values: valuesFn,
		insert: vi.fn(() => ({ values: valuesFn })),
		getCurrentClient: vi.fn(),
		limit: vi.fn(),
		getClientIp: vi.fn(),
		logError: vi.fn(),
		logWarn: vi.fn(),
	};
});

vi.mock("@emach/db", () => ({ db: { insert } }));
vi.mock("@/lib/session", () => ({ getCurrentClient }));
vi.mock("@/lib/rate-limit", () => ({ cartEventLimiter: { limit } }));
vi.mock("@/lib/client-ip", () => ({ getClientIp }));
vi.mock("@/lib/evlog", () => ({
	log: { error: logError, warn: logWarn },
}));
vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers()),
}));

import { trackCartEventAction } from "./track-cart-event";

const input = {
	toolId: "tool-1",
	variantId: "variant-1",
	sessionId: "visitor-1",
	quantity: 2,
};

describe("trackCartEventAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		values.mockResolvedValue(undefined);
		getCurrentClient.mockResolvedValue(null);
		getClientIp.mockReturnValue("203.0.113.7");
		limit.mockResolvedValue({ success: true });
	});

	it("insere 1 linha com clientId quando o cliente está logado", async () => {
		getCurrentClient.mockResolvedValue({
			user: { id: "client-1" },
			session: { id: "s1" },
		});
		await trackCartEventAction(input);
		expect(values).toHaveBeenCalledTimes(1);
		expect(values).toHaveBeenCalledWith({
			id: expect.any(String),
			toolId: "tool-1",
			variantId: "variant-1",
			clientId: "client-1",
			sessionId: "visitor-1",
			quantity: 2,
		});
	});

	it("insere com clientId null quando anônimo (sessionId sempre presente)", async () => {
		await trackCartEventAction(input);
		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({ clientId: null, sessionId: "visitor-1" })
		);
	});

	it("fire-and-forget: falha no INSERT não propaga — só loga", async () => {
		values.mockRejectedValue(new Error("connection refused"));
		await expect(trackCartEventAction(input)).resolves.toBeUndefined();
		expect(logError).toHaveBeenCalledWith(
			expect.objectContaining({ action: "cart_event_insert_failed" })
		);
	});

	it("falha na resolução de sessão também não propaga", async () => {
		getCurrentClient.mockRejectedValue(new Error("auth indisponível"));
		await expect(trackCartEventAction(input)).resolves.toBeUndefined();
		expect(values).not.toHaveBeenCalled();
		expect(logError).toHaveBeenCalled();
	});

	it("input inválido não insere (quantity 0)", async () => {
		await trackCartEventAction({ ...input, quantity: 0 });
		expect(values).not.toHaveBeenCalled();
		expect(logWarn).toHaveBeenCalledWith(
			expect.objectContaining({ action: "cart_event_invalid_input" })
		);
	});

	it("rate-limited: descarta em silêncio, sem erro", async () => {
		limit.mockResolvedValue({ success: false });
		await trackCartEventAction(input);
		expect(values).not.toHaveBeenCalled();
		expect(logError).not.toHaveBeenCalled();
	});
});
