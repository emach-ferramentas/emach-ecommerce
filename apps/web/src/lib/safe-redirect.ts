// Mesma regra que o Better Auth 1.6 aplica a callbackURL relativa
// (dist/auth/trusted-origins.mjs). Um destino que ela recusa vira 403
// INVALID_CALLBACK_URL no login Google e no cadastro, então aceitar mais que
// isso aqui quebra o fluxo. A regra também fecha o open redirect: tab, CR/LF,
// espaço e `\` não passam, e o parser de URL não tem como transformar o
// caminho em "//outra-origem".
const SAFE_PATH_RE = /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/;

export function safeRedirect(
	raw: string | null | undefined,
	fallback: string
): string {
	return raw && SAFE_PATH_RE.test(raw) ? raw : fallback;
}
