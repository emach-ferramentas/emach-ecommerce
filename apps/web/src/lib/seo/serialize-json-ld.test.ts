import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./serialize-json-ld";

describe("serializeJsonLd", () => {
	it("escapa `<` para que dado do catálogo não feche o <script>", () => {
		const out = serializeJsonLd({ a: "</script><b>" });
		expect(out).not.toContain("<");
		expect(out).toContain("\\u003c/script>");
	});

	it("preserva o JSON quando reinterpretado", () => {
		const data = { name: "Furadeira <b>X</b>", price: "899.00" };
		expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
	});
});
