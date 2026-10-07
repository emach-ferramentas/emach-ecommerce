import { describe, expect, test } from "bun:test";
import { render } from "@react-email/render";
import { ResetPasswordEmail } from "./reset-password";
import { VerifyEmailEmail } from "./verify-email";

const ACTION_URL =
	"https://loja.example.com.br/api/auth/verify-email?token=abc&callbackURL=%2F";

const COMPANY_ADDRESS = [
	"Rua Pascoal Moreira Cabral Leme, 64, Loja Pinheiro, Nova Esperança",
	"Balneário Camboriú/SC, CEP 88336-310",
];

function footerOf(html: string): string {
	return html.slice(html.indexOf('data-email-layout="footer"'));
}

const templates = [
	{
		name: "verificação de e-mail",
		element: <VerifyEmailEmail name="Ana" url={ACTION_URL} />,
		heading: "Confirme seu e-mail",
		button: "Confirmar e-mail",
		withAddress: (
			<VerifyEmailEmail
				companyAddress={COMPANY_ADDRESS}
				name="Ana"
				url={ACTION_URL}
			/>
		),
	},
	{
		name: "redefinição de senha",
		element: <ResetPasswordEmail name="Ana" url={ACTION_URL} />,
		heading: "Redefinir sua senha",
		button: "Redefinir senha",
		withAddress: (
			<ResetPasswordEmail
				companyAddress={COMPANY_ADDRESS}
				name="Ana"
				url={ACTION_URL}
			/>
		),
	},
];

describe.each(templates)("e-mail de $name no H3", (t) => {
	test("cabeçalho traz o logo PNG servido pela própria loja", async () => {
		const html = await render(t.element);
		expect(html).toContain(
			'src="https://loja.example.com.br/images/email/emach-logo.png"'
		);
		expect(html).toContain('alt="EMACH Ferramentas"');
	});

	test("rodapé traz razão social e CNPJ do rodapé do site", async () => {
		const html = await render(t.element);
		expect(html).toContain("EMACH Ferramentas");
		expect(html).toContain("CNPJ 04.128.615/0001-59");
	});

	test("rodapé traz o endereço da loja antes do CNPJ", async () => {
		const footer = footerOf(await render(t.withAddress));
		const cnpj = footer.indexOf("CNPJ 04.128.615/0001-59");
		const [street, city] = COMPANY_ADDRESS.map((line) => footer.indexOf(line));
		expect(street).toBeGreaterThan(footer.indexOf("Ferramentas e acessórios"));
		expect(city).toBeGreaterThan(street ?? -1);
		expect(cnpj).toBeGreaterThan(city ?? -1);
	});

	test("sem endereço o rodapé fica só com tagline e CNPJ", async () => {
		const footer = footerOf(await render(t.element));
		expect(footer).toContain("Ferramentas e acessórios");
		expect(footer).toContain("CNPJ 04.128.615/0001-59");
		expect(footer).not.toContain("Rua Pascoal");
		expect(footer).not.toContain("CEP ");
	});

	test("tipografia Archivo com fallback seguro", async () => {
		const html = await render(t.element);
		expect(html).toContain("@font-face");
		expect(html).toContain("font-family:Archivo, Arial, Helvetica, sans-serif");
		expect(html).not.toContain("Barlow");
	});

	test("botão de ação usa o CTA da loja e aponta para o link", async () => {
		const html = await render(t.element);
		const button = html.match(/<a[^>]*>(?:(?!<\/a>).)*<\/a>/gs) ?? [];
		const cta = button.find((a) => a.includes(t.button));
		expect(cta).toBeDefined();
		expect(cta).toContain(`href="${ACTION_URL.replaceAll("&", "&amp;")}"`);
		expect(cta?.toLowerCase()).toContain("background-color:#da291c");
		expect(cta).toContain("border-radius:3px");
	});

	test("texto de hoje continua", async () => {
		const html = await render(t.element);
		expect(html).toContain(t.heading);
		expect(html).toContain("Ana");
	});
});

test("os dois templates usam o mesmo layout base", async () => {
	const [verify, reset] = await Promise.all(
		templates.map((t) => render(t.element))
	);
	const chrome = (html: string) => html.match(/data-email-layout="[a-z]+"/g);
	expect(chrome(verify ?? "")).toEqual([
		'data-email-layout="header"',
		'data-email-layout="content"',
		'data-email-layout="footer"',
	]);
	expect(chrome(reset ?? "")).toEqual(chrome(verify ?? ""));
});
