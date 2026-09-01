import { env } from "@emach/env/web";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import type { ProductShell } from "@/lib/product-detail";
import {
	buildBreadcrumbJsonLd,
	buildProductJsonLd,
} from "../_lib/product-json-ld";

const BASE_URL = env.NEXT_PUBLIC_SITE_URL;

export function ProductJsonLd({ detail }: { detail: ProductShell }) {
	// O relógio vem de `getProductShell` (lido dentro do `use cache`): sob
	// `cacheComponents`, `new Date()` aqui quebraria o prerender da PDP.
	// priceValidUntil "congela" pela janela de 10min, o que é aceitável.
	const data = buildProductJsonLd(detail, {
		baseUrl: BASE_URL,
		now: new Date(detail.shellGeneratedAt),
	});
	// Sem Offer nem rating não há Product válido — não emite <script>.
	if (!data) {
		return null;
	}
	return <JsonLdScript data={data} />;
}

export function BreadcrumbJsonLd({
	category,
	productName,
	slug,
}: {
	category: { slug: string; name: string } | null;
	productName: string;
	slug: string;
}) {
	const data = buildBreadcrumbJsonLd({
		baseUrl: BASE_URL,
		category,
		productName,
		slug,
	});
	return <JsonLdScript data={data} />;
}
