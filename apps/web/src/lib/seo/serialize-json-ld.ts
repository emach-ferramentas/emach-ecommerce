// Regex no topo (nunca dentro da função — recompilaria a cada render).
const LESS_THAN = /</g;

/** Raiz comum a todo JSON-LD do app (`SiteGraph`, `ProductJsonLd`, `BreadcrumbJsonLd`). */
export interface JsonLdDocument {
	"@context": "https://schema.org";
}

/**
 * Serializa JSON-LD para `dangerouslySetInnerHTML`. Todo `<` vira `<`
 * para que dado do catálogo (nome/descrição) nunca feche o `<script>`.
 */
export function serializeJsonLd(data: JsonLdDocument): string {
	return JSON.stringify(data).replace(LESS_THAN, "\\u003c");
}
