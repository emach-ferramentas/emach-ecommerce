import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";
import { legacyCategoryRedirect } from "@/lib/seo/catalog-redirect";

const PROTECTED = ["/dashboard", "/pedidos"];

const runEvlog = evlogMiddleware({
	exclude: ["/api/auth/**", "/_next/**", "/favicon/**"],
});

// Retorno anotado como `Response` (super-tipo de `NextResponse`): o `evlog`
// tipa a resposta do middleware estruturalmente (só `headers`), então sem a
// anotação a união perde `status` pra quem consome o proxy. Só tipos mudam.
export async function proxy(req: NextRequest): Promise<Response> {
	const { pathname } = req.nextUrl;

	// URL legada de categoria (`/catalog?cat=x`) → rota própria. 308 preserva
	// método e é tratado como permanente pelo Google.
	const legacy = legacyCategoryRedirect(req.nextUrl);
	if (legacy) {
		return NextResponse.redirect(legacy, 308);
	}

	// 1ª camada (edge, só existência do cookie); a validação real da sessão fica
	// no content sob Suspense (requireCurrentClient). Com cacheComponents o shell
	// é servido com 200, então sem o edge-redirect o cliente deslogado veria o
	// shell piscar antes de cair no /login. `/checkout/success` é confirmação
	// pública (não lê sessão) — fica de fora.
	const isProtected =
		PROTECTED.some((p) => pathname.startsWith(p)) ||
		(pathname.startsWith("/checkout") &&
			!pathname.startsWith("/checkout/success"));

	if (isProtected) {
		// Better Auth prefixa o cookie com `__Secure-` quando roda sob HTTPS
		// (produção). Em dev (HTTP) o nome é cru. Checar as duas variantes —
		// senão o proxy nunca acha a sessão em prod e entra em loop de redirect
		// /dashboard → /login → /dashboard (tela preta do loader).
		const token =
			req.cookies.get("ecommerce.session_token") ??
			req.cookies.get("__Secure-ecommerce.session_token");
		if (!token) {
			const url = req.nextUrl.clone();
			url.pathname = "/login";
			url.searchParams.set("redirect", req.nextUrl.pathname);
			return NextResponse.redirect(url);
		}
	}

	// evlog entrega a Response real do middleware, mas declara só `headers`.
	return (await runEvlog(req)) as Response;
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon|images|.*\\.png$|.*\\.svg$).*)",
	],
};
