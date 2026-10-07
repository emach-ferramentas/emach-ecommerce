// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductImage } from "./product-image";

describe("ProductImage sem foto", () => {
	it("mostra o ícone da categoria num poço bg-well em ink-muted", () => {
		const html = renderToStaticMarkup(<ProductImage categorySlug="manuais" />);

		expect(html).toContain("bg-well");
		expect(html).toContain("text-ink-muted");
		expect(html).toContain("<svg");
	});
});
