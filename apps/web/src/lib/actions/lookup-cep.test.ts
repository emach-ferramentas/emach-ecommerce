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

	it("input inválido → ok:false SEM chamar a Frenet", async () => {
		await expect(lookupCepAction("1234")).resolves.toMatchObject({
			ok: false,
		});
		expect(fetchFrenetAddress).not.toHaveBeenCalled();
	});

	it("CEP não encontrado (sem City) → ok:false, sem lançar", async () => {
		vi.mocked(fetchFrenetAddress).mockResolvedValue({
			Message: "CEP não encontrado",
		});
		await expect(lookupCepAction("99999999")).resolves.toMatchObject({
			ok: false,
		});
	});

	it("Frenet fora/timeout → ok:false, sem lançar (autofill é enhancement)", async () => {
		vi.mocked(fetchFrenetAddress).mockRejectedValue(new FrenetError("timeout"));
		await expect(lookupCepAction("01310100")).resolves.toMatchObject({
			ok: false,
		});
	});

	it("rate limit estourado → ok:false sem chamar a Frenet", async () => {
		vi.mocked(cepLimiter.limit).mockResolvedValue({ success: false });
		await expect(lookupCepAction("01310100")).resolves.toMatchObject({
			ok: false,
		});
		expect(fetchFrenetAddress).not.toHaveBeenCalled();
	});
});
