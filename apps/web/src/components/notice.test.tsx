// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Notice } from "./notice";

describe("Notice", () => {
	it("info é texto comum, sem role de alerta, com ícone", () => {
		const html = renderToStaticMarkup(
			<Notice>Ambiente de demonstração: nenhum pagamento é cobrado.</Notice>
		);
		expect(html).not.toContain('role="alert"');
		expect(html).toContain("lucide-info");
		expect(html).toContain("Ambiente de demonstração");
	});

	it("error anuncia como alerta, com ícone de alerta", () => {
		const html = renderToStaticMarkup(
			<Notice tone="error">Não foi possível entrar com o Google.</Notice>
		);
		expect(html).toContain('role="alert"');
		expect(html).toContain("lucide-circle-alert");
	});

	it("mostra a ação quando passada", () => {
		const html = renderToStaticMarkup(
			<Notice action={<button type="button">Verificar e-mail</button>}>
				Confirme seu e-mail.
			</Notice>
		);
		expect(html).toContain('<button type="button">Verificar e-mail</button>');
	});
});
