import { describe, expect, it } from "vitest";
import { compositionSchema } from "@/lib/composition/composition-schema";
import { FALLBACK_BANNERS } from "./hero-fallbacks";

describe("FALLBACK_BANNERS", () => {
	it("todo fallback tem composition literal VÁLIDA pelo schema", () => {
		expect(FALLBACK_BANNERS.length).toBeGreaterThan(0);
		for (const banner of FALLBACK_BANNERS) {
			const parsed = compositionSchema.safeParse(banner.composition);
			expect(parsed.success, banner.id).toBe(true);
		}
	});

	it("fallbacks são split-equivalentes: produto mr + cta br, sem texto", () => {
		for (const banner of FALLBACK_BANNERS) {
			expect(banner.title).toBeNull();
			// Banner["composition"] é o envelope raso do jsonb (Record<string, unknown>);
			// o shape rico vem do parse — acessar .elements direto não compila.
			const parsed = compositionSchema.parse(banner.composition);
			expect(Object.keys(parsed.desktop.elements).sort()).toEqual([
				"cta",
				"product",
			]);
		}
	});
});
