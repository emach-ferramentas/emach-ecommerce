// Mesma regra que o Better Auth 1.6 aplica a callbackURL relativa
// (dist/auth/trusted-origins.mjs). Um destino que ela recusa vira 403
// INVALID_CALLBACK_URL no login Google e no cadastro, então aceitar mais que
// isso aqui quebra o fluxo. A regra também fecha o open redirect: tab, CR/LF,
// espaço e `\` não passam, e o parser de URL não tem como transformar o
// caminho em "//outra-origem".
const SAFE_PATH_RE = /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/;

const AUTH_PATH_RE =
	/^\/(?:login|esqueci-senha|redefinir-senha|verificar-email)\/?(?:\?|$)/;

const REPEATED_SLASHES_RE = /\/{2,}/g;

/**
 * Caminho seguro e resolvido, ou null. O texto cru passa pela regex antes do
 * parser: `//login` viraria host. Depois `.`, `..` e barras repetidas saem, e o
 * resultado passa de novo pelas duas regex, para `/x/../login` não escapar.
 */
function toSafePath(raw: string | null | undefined): string | null {
	if (!(raw && SAFE_PATH_RE.test(raw))) {
		return null;
	}
	const url = new URL(raw, "http://local");
	const path = `${url.pathname.replace(REPEATED_SLASHES_RE, "/")}${url.search}`;
	return SAFE_PATH_RE.test(path) && !AUTH_PATH_RE.test(path) ? path : null;
}

export function safeRedirect(
	raw: string | null | undefined,
	fallback: string
): string {
	return toSafePath(raw) ?? fallback;
}

export function loginHref(pathname: string): {
	pathname: "/login";
	query?: { redirect: string };
} {
	const redirect = toSafePath(pathname);
	return redirect
		? { pathname: "/login", query: { redirect } }
		: { pathname: "/login" };
}
