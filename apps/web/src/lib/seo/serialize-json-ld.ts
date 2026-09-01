// Regex no topo (nunca dentro da função — recompilaria a cada render).
const LESS_THAN = /</g;

/**
 * Serializa JSON-LD para `dangerouslySetInnerHTML`. Todo `<` vira `<`
 * para que dado do catálogo (nome/descrição) nunca feche o `<script>`.
 */
export function serializeJsonLd(data: object): string {
	return JSON.stringify(data).replace(LESS_THAN, "\\u003c");
}
