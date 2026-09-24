import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@emach/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({
	headers: vi.fn(() => Promise.resolve(new Headers())),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(() => "1.2.3.4") }));
vi.mock("@/lib/rate-limit", () => ({
	searchLimiter: { limit: vi.fn(() => Promise.resolve({ success: true })) },
}));
vi.mock("@/lib/evlog", () => ({ log: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@emach/db/queries/tools", () => ({ searchTools: vi.fn() }));
vi.mock("@/lib/auto-promo", () => ({ fetchAutoPromosByToolId: vi.fn() }));

import { searchTools } from "@emach/db/queries/tools";
import { fetchAutoPromosByToolId } from "@/lib/auto-promo";
import { log } from "@/lib/evlog";
import { searchToolsAction } from "./search";

const TOOL = {
	id: "t1",
	slug: "furadeira",
	name: "Furadeira",
	primaryImage: null,
	defaultVariant: { id: "v1", sku: "F1", voltage: null, priceAmount: "899.00" },
};

beforeEach(() => {
	vi.mocked(searchTools).mockReset();
	vi.mocked(fetchAutoPromosByToolId).mockReset();
	vi.mocked(log.error).mockReset();
});

describe("searchToolsAction", () => {
	it("aplica a melhor auto-promo ao preço do resultado", async () => {
		vi.mocked(searchTools).mockResolvedValue([TOOL]);
		vi.mocked(fetchAutoPromosByToolId).mockResolvedValue(
			new Map([
				[
					"t1",
					[
						{ discountType: "percent", discountValue: "10" },
						{ discountType: "percent", discountValue: "20" },
					],
				],
			])
		);
		const out = await searchToolsAction("fura");
		expect(out).toEqual({
			ok: true,
			data: [{ ...TOOL, discountedCents: 71_920 }],
		});
	});

	it("sem promo, discountedCents é null", async () => {
		vi.mocked(searchTools).mockResolvedValue([TOOL]);
		vi.mocked(fetchAutoPromosByToolId).mockResolvedValue(new Map([["t1", []]]));
		const out = await searchToolsAction("fura");
		expect(out).toEqual({
			ok: true,
			data: [{ ...TOOL, discountedCents: null }],
		});
	});

	it("falha do banco vira erro em pt-BR e log.error", async () => {
		vi.mocked(searchTools).mockRejectedValue(new Error("db down"));
		const out = await searchToolsAction("fura");
		expect(out).toEqual({
			ok: false,
			error: "Não foi possível buscar agora.",
		});
		expect(log.error).toHaveBeenCalledWith(
			expect.objectContaining({ action: "search_tools" })
		);
	});
});
