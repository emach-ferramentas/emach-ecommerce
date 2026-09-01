import { db } from "@emach/db";
import { getStoreSocialLinks } from "@emach/db/queries/store-settings";
import { env } from "@emach/env/web";
import { cacheLife } from "next/cache";

import { getActiveBranches } from "@/lib/branches";
import { buildSiteGraph } from "@/lib/seo/site-json-ld";

import { JsonLdScript } from "./json-ld-script";

// Mesmo TTL do footer (também lê storeSettings). Filiais e redes mudam raro.
async function loadSiteGraph() {
	"use cache";
	cacheLife({ revalidate: 3600 });
	const [socialLinks, branches] = await Promise.all([
		getStoreSocialLinks(db),
		getActiveBranches(),
	]);
	return buildSiteGraph({
		baseUrl: env.NEXT_PUBLIC_SITE_URL,
		branches,
		sameAs: socialLinks.map((s) => s.url),
	});
}

/** Organization + WebSite + uma HardwareStore por filial, em todas as páginas do shop. */
export async function SiteJsonLd() {
	const data = await loadSiteGraph();
	return <JsonLdScript data={data} />;
}
