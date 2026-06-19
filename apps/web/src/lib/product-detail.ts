import { db } from "@emach/db";
import { getToolBySlug } from "@emach/db/queries/tools";
import { cacheLife } from "next/cache";

// Shell do produto cacheado (ISR ~10min, alinhado à home). `generateMetadata` e
// a página chamam esta MESMA função: o `use cache` deduplica (1 query por janela
// em vez de 2 por acesso — resolve o #2) e serve o shell prerenderizado (#1).
// O wrapper vive no app porque `packages/db/queries` é owned-by-dashboard
// (sincronizado via CI; editar lá seria sobrescrito — ADR-0009).
// `searchParams` (reviews) NÃO entra aqui — fica no buraco dinâmico sob Suspense.
export async function getProductShell(slug: string) {
	"use cache";
	cacheLife({ revalidate: 600 });
	return getToolBySlug(db, slug);
}
