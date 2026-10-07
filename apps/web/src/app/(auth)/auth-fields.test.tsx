// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
	useSearchParams: () => searchParams.current,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({ data: null, isPending: false }),
	},
}));

const { default: ForgotPasswordPage } = await import("./esqueci-senha/page");
const { LoginForm } = await import("./login/_components/login-form");
const { ResetPasswordForm } = await import(
	"./redefinir-senha/_components/reset-password-form"
);

const INPUT_TAG = /<input[^>]*>/g;
const LABEL_WRAPPING_INPUT =
	/<label class="emach-field"[^>]*>(?:(?!<\/label>)[\s\S])*<input/;

function inputById(html: string, id: string): string {
	return (
		html.match(INPUT_TAG)?.find((tag) => tag.includes(` id="${id}"`)) ?? ""
	);
}

function expectTextField(html: string, id: string, name: string) {
	expect(html).toContain(`<label class="emach-field__label" for="${id}">`);
	expect(inputById(html, id)).toContain(`name="${name}"`);
}

beforeEach(() => {
	searchParams.current = new URLSearchParams();
});

describe("telas de auth usam Field", () => {
	it("entrar: e-mail e senha com rótulo fora do input e o mesmo name", () => {
		const html = renderToStaticMarkup(<LoginForm />);
		expect(html).toContain('aria-label="Entrar"');
		expectTextField(html, "email", "email");
		expectTextField(html, "password", "password");
		expect(html).toContain('id="remember-me"');
		expect(html).toContain('aria-label="Mostrar senha"');
		expect(html).not.toMatch(LABEL_WRAPPING_INPUT);
	});

	it("cadastrar: nome, e-mail, telefone e senha", () => {
		searchParams.current = new URLSearchParams("modo=cadastro");
		const html = renderToStaticMarkup(<LoginForm />);
		expect(html).toContain('aria-label="Criar conta"');
		for (const name of ["name", "email", "phone", "password"]) {
			expectTextField(html, name, name);
		}
		expect(html).not.toMatch(LABEL_WRAPPING_INPUT);
	});

	it("esqueci a senha: e-mail", () => {
		const html = renderToStaticMarkup(<ForgotPasswordPage />);
		expectTextField(html, "email", "email");
		expect(html).not.toMatch(LABEL_WRAPPING_INPUT);
	});

	it("redefinir a senha: senha e confirmação com botão de mostrar", () => {
		searchParams.current = new URLSearchParams("token=abc");
		const html = renderToStaticMarkup(<ResetPasswordForm />);
		expectTextField(html, "password", "password");
		expectTextField(html, "confirm", "confirm");
		expect(inputById(html, "confirm")).toContain('type="password"');
		expect(html).toContain('aria-label="Mostrar senha"');
		expect(html).not.toMatch(LABEL_WRAPPING_INPUT);
	});
});
