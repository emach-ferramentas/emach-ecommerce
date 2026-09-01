/**
 * `/catalog?cat=<slug>` era a URL de categoria até o PR de rotas próprias.
 * Devolve a URL nova (`/catalog/<slug>` + demais params) ou null.
 */
export function legacyCategoryRedirect(url: URL): URL | null {
	if (url.pathname !== "/catalog") {
		return null;
	}
	const cat = url.searchParams.get("cat")?.trim();
	if (!cat) {
		return null;
	}
	const next = new URL(url);
	next.pathname = `/catalog/${encodeURIComponent(cat)}`;
	// O setter de `pathname` normaliza dot-segments: `cat=..` viraria `/` e o
	// 308 mandaria a categoria legada pra raiz do site. Nesse caso não redireciona.
	if (!next.pathname.startsWith("/catalog/") || next.pathname === "/catalog/") {
		return null;
	}
	next.searchParams.delete("cat");
	return next;
}
