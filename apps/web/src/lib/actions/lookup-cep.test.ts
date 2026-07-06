import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
	headers: vi.fn(() => Promise.resolve(new Headers())),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(() => "1.2.3.4") }));
vi.mock("@/lib/frenet/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/frenet/client")>();
	return { ...actual, fetchFrenetAddress: vi.fn() };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
	return {
		...actual,
		cepLimiter: { limit: vi.fn(() => Promise.resolve({ success: true })) },
	};
});

import { FrenetError, fetchFrenetAddress } from "@/lib/frenet/client";
import { cepLimiter } from "@/lib/rate-limit";
import { lookupCepAction } from "./lookup-cep";

const FRENET_OK = {
	CEP: "01310100",
	City: "São Paulo",
	District: "Bela Vista",
	Message: "ok",
	Street: "Avenida Paulista",
	UF: "SP",
};

beforeEach(() => {
	vi.mocked(fetchFrenetAddress).mockReset();
	vi.mocked(cepLimiter.limit).mockResolvedValue({ success: true });
});

describe("lookupCepAction", () => {
	it("CEP válido → campos mapeados (District→neighborhood, UF→state)", async () => {
		vi.mocked(fetchFrenetAddress).mockResolvedValue(FRENET_OK);

		await expect(lookupCepAction("01310-100")).resolves.toEqual({
			ok: true,
			data: {
				street: "Avenida Paulista",
				neighborhood: "Bela Vista",
				city: "São Paulo",
				state: "SP",
			},
		});
		// Normalizado pra 8 dígitos antes de chamar a Frenet.
		expect(fetchFrenetAddress).toHaveBeenCalledWith("01310100");
	});

	it("input inválido → not_found SEM chamar a Frenet", async () => {
		await expect(lookupCepAction("1234")).resolves.toEqual({
			ok: false,
			reason: "not_found",
		});
		expect(fetchFrenetAddress).not.toHaveBeenCalled();
	});

	it("CEP não encontrado (sem City) → not_found (definitivo: UI avisa), sem lançar", async () => {
		vi.mocked(fetchFrenetAddress).mockResolvedValue({
			Message: "CEP não encontrado",
		});
		await expect(lookupCepAction("99999999")).resolves.toEqual({
			ok: false,
			reason: "not_found",
		});
	});

	it("Frenet fora/timeout → unavailable (transitório: UI não alarma), sem lançar", async () => {
		vi.mocked(fetchFrenetAddress).mockRejectedValue(new FrenetError("timeout"));
		await expect(lookupCepAction("01310100")).resolves.toEqual({
			ok: false,
			reason: "unavailable",
		});
	});

	it("rate limit estourado → unavailable sem chamar a Frenet", async () => {
		vi.mocked(cepLimiter.limit).mockResolvedValue({ success: false });
		await expect(lookupCepAction("01310100")).resolves.toEqual({
			ok: false,
			reason: "unavailable",
		});
		expect(fetchFrenetAddress).not.toHaveBeenCalled();
	});
});
