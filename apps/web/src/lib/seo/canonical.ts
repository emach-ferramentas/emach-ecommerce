import { env } from "@emach/env/web";

const TRAILING_SLASHES = /\/+$/;

/**
 * `alternates.canonical` absoluto para uma rota. Query string e barra final
 * são descartadas: o canonical é sempre a URL "limpa" da rota, mesmo quando
 * a página aceita filtros por query (caso do /catalog).
 */
export function canonicalFor(
	path: string,
	baseUrl: string = env.NEXT_PUBLIC_SITE_URL
): { canonical: string } {
	const base = baseUrl.replace(TRAILING_SLASHES, "");
	const withoutQuery = path.split("?")[0] ?? "/";
	const trimmed = withoutQuery.replace(TRAILING_SLASHES, "");
	return { canonical: `${base}${trimmed === "" ? "/" : trimmed}` };
}
