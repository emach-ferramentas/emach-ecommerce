import type { CategoryNode } from "@emach/db/queries/categories";

/**
 * Ofícios ("Reboco e acabamento", "Furar e parafusar"...) são categorias filhas
 * de uma categoria-mãe com este slug, ligadas aos produtos por `tool_category`
 * com `is_primary = false`. A subárvore não é uma categoria de produto: some das
 * listas de categoria e vira a navegação por serviço.
 */
export const SERVICES_ROOT_SLUG = "servicos";

const SERVICES_ROOT_PATH = `/${SERVICES_ROOT_SLUG}`;

export function isServicePath(path: string): boolean {
	return (
		path === SERVICES_ROOT_PATH || path.startsWith(`${SERVICES_ROOT_PATH}/`)
	);
}

function withoutServiceNodes(nodes: CategoryNode[]): CategoryNode[] {
	const kept: CategoryNode[] = [];
	for (const node of nodes) {
		if (isServicePath(node.path)) {
			continue;
		}
		kept.push({ ...node, children: withoutServiceNodes(node.children) });
	}
	return kept;
}

export interface ServiceTreeSplit {
	/** Árvore de categorias de produto, sem nenhum nó da subárvore de ofícios. */
	categories: CategoryNode[];
	/** Filhas diretas da categoria-mãe de ofícios; vazio quando ela não existe. */
	services: CategoryNode[];
}

export function splitServiceTree(tree: CategoryNode[]): ServiceTreeSplit {
	const root = tree.find((node) => node.path === SERVICES_ROOT_PATH);
	return {
		categories: withoutServiceNodes(tree),
		services: root ? root.children : [],
	};
}
