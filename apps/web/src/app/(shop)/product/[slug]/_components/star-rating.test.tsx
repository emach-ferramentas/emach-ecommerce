// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { scanSource } from "@/test/h3-legacy-scan";
import { starFills } from "@/test/star-fills";
import { StarRating } from "./star-rating";

describe("StarRating", () => {
	it("desenha a estrela cheia preenchida e a vazia só em contorno", () => {
		const html = renderToStaticMarkup(<StarRating rating={3} />);
		expect(starFills(html)).toEqual([
			"cheia",
			"cheia",
			"cheia",
			"contorno",
			"contorno",
		]);
	});

	it("anuncia a nota por extenso", () => {
		const html = renderToStaticMarkup(<StarRating rating={4.4} />);
		expect(html).toContain('aria-label="4.4 de 5 estrelas"');
	});

	it("não usa token visual anterior ao H3", () => {
		const html = renderToStaticMarkup(<StarRating rating={2} />);
		expect(scanSource(html, "star-rating")).toEqual([]);
	});
});
