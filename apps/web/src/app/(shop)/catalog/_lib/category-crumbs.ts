import type { CategoryNode } from "@emach/db/queries/categories";

import { SERVICES_ROOT_SLUG } from "@/lib/service-tree";

export interface CatalogCrumb {
	name: string;
	slug: string;
}

function flatten(nodes: CategoryNode[], out = new Map<string, CategoryNode>()) {
	for (const node of nodes) {
		out.set(node.path, node);
		flatten(node.children, out);
	}
	return out;
}

/**
 * Ancestrais pelo `path` (slugs separados por "/"), resolvidos na árvore da
 * loja: a query dashboard-owned `getCategoryBySlug` não resolve ancestrais de
 * categorias com id UUID. A mãe dos ofícios fica de fora da trilha.
 */
export function ancestorsOf(
	tree: CategoryNode[],
	path: string
): CatalogCrumb[] {
	const byPath = flatten(tree);
	const segments = path.split("/").filter(Boolean);
	const crumbs: CatalogCrumb[] = [];
	for (let i = 1; i < segments.length; i++) {
		const prefix = `/${segments.slice(0, i).join("/")}`;
		const node = byPath.get(prefix);
		if (node && prefix !== `/${SERVICES_ROOT_SLUG}`) {
			crumbs.push({ name: node.name, slug: node.slug });
		}
	}
	return crumbs;
}
