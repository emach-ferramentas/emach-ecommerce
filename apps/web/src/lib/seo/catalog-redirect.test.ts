import { describe, expect, it } from "vitest";
import { legacyCategoryRedirect } from "./catalog-redirect";

const ORIGIN = "https://www.emachferramentas.com.br";

describe("legacyCategoryRedirect", () => {
	it("move cat da query para o path e preserva os demais params", () => {
		const out = legacyCategoryRedirect(
			new URL(`${ORIGIN}/catalog?cat=furadeiras&sort=price-asc&page=2`)
		);
		expect(out?.toString()).toBe(
			`${ORIGIN}/catalog/furadeiras?sort=price-asc&page=2`
		);
	});
	it("sem cat, ou cat vazio, não redireciona", () => {
		expect(legacyCategoryRedirect(new URL(`${ORIGIN}/catalog`))).toBeNull();
		expect(
			legacyCategoryRedirect(new URL(`${ORIGIN}/catalog?cat=`))
		).toBeNull();
		expect(
			legacyCategoryRedirect(new URL(`${ORIGIN}/catalog?cat=%20`))
		).toBeNull();
	});
	it("só age em /catalog exato", () => {
		expect(
			legacyCategoryRedirect(new URL(`${ORIGIN}/catalog/serras?cat=x`))
		).toBeNull();
		expect(legacyCategoryRedirect(new URL(`${ORIGIN}/?cat=x`))).toBeNull();
	});
	it("dot-segment não redireciona pra fora de /catalog/", () => {
		expect(
			legacyCategoryRedirect(new URL(`${ORIGIN}/catalog?cat=..`))
		).toBeNull();
		expect(
			legacyCategoryRedirect(new URL(`${ORIGIN}/catalog?cat=.`))
		).toBeNull();
		expect(
			legacyCategoryRedirect(new URL(`${ORIGIN}/catalog?cat=%2E%2E`))
		).toBeNull();
	});
	it("escapa slug malicioso", () => {
		const out = legacyCategoryRedirect(
			new URL(`${ORIGIN}/catalog?cat=..%2F..%2Fadmin`)
		);
		expect(out?.pathname).toBe("/catalog/..%2F..%2Fadmin");
	});
});
