// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	PRODUCT_CHIP_ROW,
	PRODUCT_GRID,
	PRODUCT_TITLE,
} from "./_lib/product-layout";
import Loading from "./loading";

const GALLERY_WELL = /class="[^"]*aspect-square[^"]*bg-well/;

const html = renderToStaticMarkup(<Loading />);

describe("esqueleto da página de produto", () => {
	it("usa a mesma grade da página", () => {
		expect(html).toContain(`class="${PRODUCT_GRID}"`);
	});

	it("reserva a galeria quadrada em bg-well", () => {
		expect(html).toMatch(GALLERY_WELL);
	});

	it("reserva o título com a mesma escala do h1", () => {
		expect(html).toContain(`class="${PRODUCT_TITLE}"`);
	});

	it("reserva a fileira do chip de ofício acima do título", () => {
		const chipRow = html.indexOf(`class="${PRODUCT_CHIP_ROW}"`);
		expect(chipRow).toBeGreaterThan(-1);
		expect(chipRow).toBeLessThan(html.indexOf(`class="${PRODUCT_TITLE}"`));
	});

	it("deixa o main do pular-conteúdo para o StoreFrame do layout", () => {
		expect(html).not.toContain("<main");
		expect(html).not.toContain('id="main-content"');
	});
});
