import { describe, expect, it } from "vitest";
import { canonicalFor } from "./canonical";

const BASE = "https://www.emachferramentas.com.br";

describe("canonicalFor", () => {
	it("home vira a raiz com barra", () => {
		expect(canonicalFor("/", BASE)).toEqual({ canonical: `${BASE}/` });
	});
	it("descarta query string", () => {
		expect(canonicalFor("/catalog?cat=furadeiras&page=2", BASE)).toEqual({
			canonical: `${BASE}/catalog`,
		});
	});
	it("descarta barra final", () => {
		expect(canonicalFor("/product/abc/", BASE)).toEqual({
			canonical: `${BASE}/product/abc`,
		});
	});
	it("tolera baseUrl com barra final", () => {
		expect(canonicalFor("/sobre", `${BASE}/`)).toEqual({
			canonical: `${BASE}/sobre`,
		});
	});
	it("usa NEXT_PUBLIC_SITE_URL quando baseUrl é omitido", () => {
		expect(canonicalFor("/sobre").canonical.endsWith("/sobre")).toBe(true);
	});
});
