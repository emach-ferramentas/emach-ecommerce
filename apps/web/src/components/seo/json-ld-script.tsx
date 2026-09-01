import { serializeJsonLd } from "@/lib/seo/serialize-json-ld";

/**
 * Único ponto do app que injeta JSON-LD. O escape do `<` vive em
 * `serializeJsonLd` (função pura, testada em serialize-json-ld.test.ts).
 */
export function JsonLdScript({ data }: { data: object }) {
	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD exige <script> inline; "<" escapado bloqueia injeção via dados do catálogo
			dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
			type="application/ld+json"
		/>
	);
}
