import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
	headers: vi.fn(() => Promise.resolve(new Headers())),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(() => "1.2.3.4") }));
vi.mock("@/lib/rate-limit", () => ({
	quickViewLimiter: { limit: vi.fn(() => Promise.resolve({ success: true })) },
}));
vi.mock("@/lib/evlog", () => ({ log: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/product-detail", () => ({ getProductShell: vi.fn() }));

import { log } from "@/lib/evlog";
import { getProductShell, type ProductShell } from "@/lib/product-detail";
import { quickViewLimiter } from "@/lib/rate-limit";
import { quickViewAction } from "./quick-view";

function variant(
	id: string,
	voltage: "127V" | "220V" | null,
	priceAmount: string | null,
	isDefault: boolean,
	sortOrder: number
) {
	return { id, isDefault, priceAmount, sku: `SKU-${id}`, sortOrder, voltage };
}

const SHELL = {
	activePromotion: { discountType: "percent", discountValue: "10" },
	attributes: [],
	images: [{ url: "https://img/1.webp" }, { url: "https://img/2.webp" }],
	primaryCategory: {
		id: "c1",
		name: "Elétricas",
		path: "/eletricas",
		slug: "eletricas",
	},
	stockByVariant: { v127: true, v220: false },
	tool: { id: "t1", name: "Lixadeira girafa" },
	variants: [
		variant("rascunho", "220V", null, false, 0),
		variant("v220", "220V", "536.18", false, 2),
		variant("v127", "127V", "536.18", true, 1),
	],
} as unknown as ProductShell;

beforeEach(() => {
	vi.mocked(getProductShell).mockReset();
	vi.mocked(log.error).mockReset();
	vi.mocked(quickViewLimiter.limit).mockResolvedValue({ success: true });
});

describe("quickViewAction", () => {
	it("devolve só variantes vendáveis, default primeiro, com promoção e estoque", async () => {
		vi.mocked(getProductShell).mockResolvedValue(SHELL);
		const out = await quickViewAction({ slug: "lixadeira-girafa" });
		expect(out.ok).toBe(true);
		if (!out.ok) {
			return;
		}
		expect(out.data.variants).toEqual([
			{
				baseAmount: "536.18",
				discountPct: 10,
				finalAmount: "482.56",
				id: "v127",
				inStock: true,
				sku: "SKU-v127",
				voltage: "127V",
			},
			{
				baseAmount: "536.18",
				discountPct: 10,
				finalAmount: "482.56",
				id: "v220",
				inStock: false,
				sku: "SKU-v220",
				voltage: "220V",
			},
		]);
		expect(out.data.images).toEqual([
			"https://img/1.webp",
			"https://img/2.webp",
		]);
		expect(out.data.categorySlug).toBe("eletricas");
	});

	it("recusa slug inválido sem ler o banco", async () => {
		const out = await quickViewAction({ slug: "../../etc" });
		expect(out).toEqual({ ok: false, error: "Produto inválido." });
		expect(getProductShell).not.toHaveBeenCalled();
	});

	it("produto inexistente vira erro legível", async () => {
		vi.mocked(getProductShell).mockResolvedValue(null);
		expect(await quickViewAction({ slug: "nao-existe" })).toEqual({
			ok: false,
			error: "Produto não encontrado.",
		});
	});

	it("respeita o limite por IP", async () => {
		vi.mocked(quickViewLimiter.limit).mockResolvedValue({ success: false });
		const out = await quickViewAction({ slug: "lixadeira-girafa" });
		expect(out.ok).toBe(false);
		expect(getProductShell).not.toHaveBeenCalled();
	});

	it("loga e devolve erro quando a leitura falha", async () => {
		vi.mocked(getProductShell).mockRejectedValue(new Error("db fora"));
		const out = await quickViewAction({ slug: "lixadeira-girafa" });
		expect(out).toEqual({
			ok: false,
			error: "Não foi possível abrir o produto agora.",
		});
		expect(log.error).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "quick_view",
				slug: "lixadeira-girafa",
			})
		);
	});
});
