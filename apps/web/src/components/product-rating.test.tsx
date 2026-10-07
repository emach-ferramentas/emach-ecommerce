// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { scanSource } from "@/test/h3-legacy-scan";
import { starFills } from "@/test/star-fills";
import { ProductRating } from "./product-rating";

describe("ProductRating", () => {
	it("desenha a estrela cheia preenchida e a vazia só em contorno", () => {
		const html = renderToStaticMarkup(<ProductRating average={4.2} />);
		expect(starFills(html)).toEqual([
			"cheia",
			"cheia",
			"cheia",
			"cheia",
			"contorno",
		]);
		expect(html).toContain('aria-label="Avaliação 4.2 de 5"');
	});

	it("não usa token visual anterior ao H3", () => {
		const html = renderToStaticMarkup(<ProductRating average={1} />);
		expect(scanSource(html, "product-rating")).toEqual([]);
	});
});
