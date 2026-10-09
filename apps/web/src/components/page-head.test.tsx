// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PAGE_TITLE_CLASS, PageHead } from "./page-head";

const H1_TAG = /<h1[\s>]/g;
const TRAIL_NAV = 'aria-label="Você está em"';

describe("PageHead", () => {
	it("renderiza um único h1 com a escala de título do H3", () => {
		const html = renderToStaticMarkup(<PageHead title="Seu carrinho" />);
		expect(html.match(H1_TAG)).toHaveLength(1);
		expect(html).toContain(`<h1 class="${PAGE_TITLE_CLASS}">Seu carrinho</h1>`);
	});

	it("não mostra trilha de navegação", () => {
		const html = renderToStaticMarkup(<PageHead title="Finalizar compra" />);
		expect(html).not.toContain(TRAIL_NAV);
	});

	it("mostra linha de apoio e aside quando passados", () => {
		const html = renderToStaticMarkup(
			<PageHead aside={<span>chip</span>} title="Pedido">
				Realizado em 01/10/2026
			</PageHead>
		);
		expect(html).toContain("Realizado em 01/10/2026");
		expect(html).toContain("<span>chip</span>");
	});
});
