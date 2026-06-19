import type { CategoryNode } from "@emach/db/queries/categories";

/**
 * IDs de todos os nós no caminho da raiz até a categoria ativa (inclusive ela).
 * Usado para auto-expandir o accordion e marcar a raiz do ramo ativo.
 */
export function collectPathToActive(
	tree: CategoryNode[],
	activeSlug: string | null
): Set<string> {
	const ids = new Set<string>();
	if (!activeSlug) {
		return ids;
	}

	function walk(nodes: CategoryNode[], trail: string[]): boolean {
		for (const n of nodes) {
			const nextTrail = [...trail, n.id];
			if (n.slug === activeSlug) {
				for (const id of nextTrail) {
					ids.add(id);
				}
				return true;
			}
			if (n.children.length > 0 && walk(n.children, nextTrail)) {
				return true;
			}
		}
		return false;
	}

	walk(tree, []);
	return ids;
}
