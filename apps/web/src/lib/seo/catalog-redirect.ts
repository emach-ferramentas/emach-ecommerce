/** Slug antigo de categoria → slug atual, para link salvo e índice do Google. */
const RENAMED_CATEGORY_SLUGS: Record<string, string> = {
	"demolicao-e-rasgo": "demolicao",
};

const CATALOG_SLUG_PATH = /^\/catalog\/([^/]+)$/;

/**
 * Duas URLs legadas de categoria: `/catalog?cat=<slug>`, que era a URL até o
 * PR de rotas próprias, e `/catalog/<slug antigo>` de categoria renomeada.
 * Devolve a URL nova (`/catalog/<slug>` + demais params) ou null.
 */
export function legacyCategoryRedirect(url: URL): URL | null {
	const renamed =
		RENAMED_CATEGORY_SLUGS[url.pathname.match(CATALOG_SLUG_PATH)?.[1] ?? ""];
	if (renamed) {
		const next = new URL(url);
		next.pathname = `/catalog/${renamed}`;
		return next;
	}
	if (url.pathname !== "/catalog") {
		return null;
	}
	const cat = url.searchParams.get("cat")?.trim();
	if (!cat) {
		return null;
	}
	const next = new URL(url);
	next.pathname = `/catalog/${encodeURIComponent(RENAMED_CATEGORY_SLUGS[cat] ?? cat)}`;
	// O setter de `pathname` normaliza dot-segments: `cat=..` viraria `/` e o
	// 308 mandaria a categoria legada pra raiz do site. Nesse caso não redireciona.
	if (!next.pathname.startsWith("/catalog/") || next.pathname === "/catalog/") {
		return null;
	}
	next.searchParams.delete("cat");
	return next;
}
