import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./serialize-json-ld";

describe("serializeJsonLd", () => {
	it("escapa `<` para que dado do catálogo não feche o <script>", () => {
		const data = {
			"@context": "https://schema.org",
			name: "</script><b>",
		} as const;

		const out = serializeJsonLd(data);
		expect(out).not.toContain("<");
		expect(out).toContain("\\u003c/script>");
	});

	it("preserva o JSON quando reinterpretado", () => {
		const data = {
			"@context": "https://schema.org",
			name: "Furadeira <b>X</b>",
			price: "899.00",
		} as const;

		expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
	});
});
