// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HOME_CRUMB } from "./breadcrumb";
import { PAGE_TITLE_CLASS, PageHead } from "./page-head";

const H1_TAG = /<h1[\s>]/g;
const TRAIL_NAV = 'aria-label="Você está em"';

describe("PageHead", () => {
	it("renderiza um único h1 com a escala de título do H3", () => {
		const html = renderToStaticMarkup(<PageHead title="Seu carrinho" />);
		expect(html.match(H1_TAG)).toHaveLength(1);
		expect(html).toContain(`<h1 class="${PAGE_TITLE_CLASS}">Seu carrinho</h1>`);
	});

	it("sem trail não mostra trilha", () => {
		const html = renderToStaticMarkup(<PageHead title="Finalizar compra" />);
		expect(html).not.toContain(TRAIL_NAV);
	});

	it("com trail usa o título como página atual, salvo current", () => {
		const padrao = renderToStaticMarkup(
			<PageHead title="Seu carrinho" trail={[HOME_CRUMB]} />
		);
		expect(padrao).toContain(TRAIL_NAV);
		expect(padrao).toContain(
			'<span aria-current="page" class="line-clamp-1">Seu carrinho</span>'
		);

		const proprio = renderToStaticMarkup(
			<PageHead
				current="Pedido #12"
				title="Pedido #12 · pago"
				trail={[HOME_CRUMB]}
			/>
		);
		expect(proprio).toContain(
			'<span aria-current="page" class="line-clamp-1">Pedido #12</span>'
		);
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
