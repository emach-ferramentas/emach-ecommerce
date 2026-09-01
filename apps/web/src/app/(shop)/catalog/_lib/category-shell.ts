import { db } from "@emach/db";
import {
	type CategoryDetail,
	getCategoryBySlug,
} from "@emach/db/queries/categories";
import { cacheLife } from "next/cache";

// Mesmo padrão de getProductShell: generateMetadata e a página chamam a MESMA
// função e o `use cache` deduplica (1 query por janela). Wrapper vive no app
// porque packages/db/queries é owned-by-dashboard (ADR-0009).
export async function getCategoryShell(
	slug: string
): Promise<CategoryDetail | null> {
	"use cache";
	cacheLife({ revalidate: 600 });
	return await getCategoryBySlug(db, slug);
}

/** Description de metadata quando a categoria não tem a própria. */
export function defaultCategoryDescription(name: string): string {
	return `${name} para obra, oficina e indústria. Linha profissional, com estoque nas filiais e envio para todo o Brasil.`;
}
