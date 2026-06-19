import { db } from "@emach/db";
import { getCategoryTree } from "@emach/db/queries/categories";
import { cacheLife } from "next/cache";

// Árvore de categorias não depende de searchParams nem de runtime APIs — é a
// parte cacheável do catálogo (o shell), enquanto a lista filtrada fica no
// buraco dinâmico sob Suspense. Wrapper no app (packages/db é owned-by-dashboard).
export async function getCachedCategoryTree() {
	"use cache";
	cacheLife({ revalidate: 600 });
	return getCategoryTree(db);
}
