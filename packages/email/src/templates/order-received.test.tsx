import { describe, expect, test } from "bun:test";
import { render } from "@react-email/render";
import { OrderReceivedEmail, type OrderReceivedProps } from "./order-received";

const ORDER_URL = "https://loja.example.com.br/dashboard/pedidos/o-123";

const props: OrderReceivedProps = {
	name: "Ana",
	orderNumber: "2026-000123",
	orderUrl: ORDER_URL,
	items: [
		{
			id: "i1",
			name: "Furadeira de Impacto",
			detail: "220V",
			quantity: 2,
			lineTotal: "R$ 1.798,00",
		},
		{
			id: "i2",
			name: "Óculos de Proteção",
			detail: null,
			quantity: 1,
			lineTotal: "R$ 29,90",
		},
	],
	summary: [
		{ label: "Subtotal", value: "R$ 1.827,90" },
		{ label: "Desconto", value: "- R$ 50,00" },
		{ label: "Frete", value: "R$ 42,10" },
	],
	total: "R$ 1.820,00",
	addressLines: [
		"Ana Souza",
		"Rua das Obras, 100 — Apto 2",
		"Centro, Campinas — SP",
		"CEP 13010-000",
	],
};

describe("e-mail de pedido recebido", () => {
	test("traz número, itens, total e endereço", async () => {
		const html = await render(<OrderReceivedEmail {...props} />);
		expect(html).toContain("2026-000123");
		expect(html).toContain("Furadeira de Impacto");
		expect(html).toContain("220V");
		expect(html).toContain("Óculos de Proteção");
		expect(html).toContain("R$ 1.798,00");
		expect(html).toContain("- R$ 50,00");
		expect(html).toContain("R$ 1.820,00");
		expect(html).toContain("Rua das Obras, 100 — Apto 2");
		expect(html).toContain("CEP 13010-000");
	});

	test("botão leva ao pedido na conta para pagar", async () => {
		const html = await render(<OrderReceivedEmail {...props} />);
		const anchors = html.match(/<a[^>]*>(?:(?!<\/a>).)*<\/a>/gs) ?? [];
		const cta = anchors.find((a) => a.includes(`href="${ORDER_URL}"`));
		expect(cta).toBeDefined();
		expect(cta?.toLowerCase()).toContain("background-color:#da291c");
	});

	test("usa o layout base com o logo da origem do link", async () => {
		const html = await render(<OrderReceivedEmail {...props} />);
		expect(html.match(/data-email-layout="[a-z]+"/g)).toEqual([
			'data-email-layout="header"',
			'data-email-layout="content"',
			'data-email-layout="footer"',
		]);
		expect(html).toContain(
			'src="https://loja.example.com.br/images/email/emach-logo.png"'
		);
	});

	test("não promete nota fiscal nem prazo", async () => {
		const text = (
			await render(<OrderReceivedEmail {...props} />, {
				plainText: true,
			})
		).toLowerCase();
		for (const banned of [
			"nota fiscal",
			"nf-e",
			"nfe",
			"dias úteis",
			"prazo",
			"chega em",
			"entregue em",
			"enviamos a confirmação",
		]) {
			expect(text).not.toContain(banned);
		}
	});
});
