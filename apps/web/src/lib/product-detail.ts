import { db } from "@emach/db";
import { getToolBySlug, type ToolDetail } from "@emach/db/queries/tools";
import { cacheLife } from "next/cache";

/** Detalhe do produto + o instante em que o shell foi gerado (ver abaixo). */
export type ProductShell = ToolDetail & { shellGeneratedAt: string };

// Shell do produto cacheado (ISR ~10min, alinhado à home). `generateMetadata` e
// a página chamam esta MESMA função: o `use cache` deduplica (1 query por janela
// em vez de 2 por acesso — resolve o #2) e serve o shell prerenderizado (#1).
// O wrapper vive no app porque `packages/db/queries` é owned-by-dashboard
// (sincronizado via CI; editar lá seria sobrescrito — ADR-0009).
// `searchParams` (reviews) NÃO entra aqui — fica no buraco dinâmico sob Suspense.
export async function getProductShell(
	slug: string
): Promise<ProductShell | null> {
	"use cache";
	cacheLife({ revalidate: 600 });
	const detail = await getToolBySlug(db, slug);
	if (!detail) {
		return null;
	}
	// Relógio lido AQUI (escopo cacheado). Fora dele, `cacheComponents` proíbe
	// `new Date()` antes de dado dinâmico (next-prerender-current-time) — o
	// JSON-LD da PDP consome este instante em vez de ler o relógio no render.
	return { ...detail, shellGeneratedAt: new Date().toISOString() };
}
