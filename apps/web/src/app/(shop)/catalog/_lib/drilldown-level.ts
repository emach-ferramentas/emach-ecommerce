import type { CategoryNode } from "@emach/db/queries/categories";

export interface DrilldownRow {
	hasChildren: boolean;
	id: string;
	name: string;
	slug: string;
}

export interface DrilldownLevel {
	/** Categoria ativa; null quando nada selecionado ("Todas"). */
	active: { id: string; name: string; slug: string } | null;
	/** Nível acima; slug null = "Todas as categorias"; null = já está no topo. */
	back: { name: string; slug: string | null } | null;
	/** Itens exibidos abaixo do ativo (nunca incluem o próprio ativo). */
	rows: DrilldownRow[];
	/** true = rows são filhas do ativo (ganham recuo); false = irmãs/raízes. */
	rowsAreChildren: boolean;
}

function toRow(n: CategoryNode): DrilldownRow {
	return {
		id: n.id,
		slug: n.slug,
		name: n.name,
		hasChildren: n.children.length > 0,
	};
}

function findWithParent(
	nodes: CategoryNode[],
	slug: string,
	parent: CategoryNode | null
): { node: CategoryNode; parent: CategoryNode | null } | null {
	for (const n of nodes) {
		if (n.slug === slug) {
			return { node: n, parent };
		}
		const inChildren = findWithParent(n.children, slug, n);
		if (inChildren) {
			return inChildren;
		}
	}
	return null;
}

export function deriveDrilldownLevel(
	tree: CategoryNode[],
	activeSlug: string | null
): DrilldownLevel {
	const found = activeSlug ? findWithParent(tree, activeSlug, null) : null;
	if (!found) {
		return {
			active: null,
			back: null,
			rows: tree.map(toRow),
			rowsAreChildren: false,
		};
	}

	const { node, parent } = found;
	const back = parent
		? { name: parent.name, slug: parent.slug }
		: { name: "Todas as categorias", slug: null };
	const active = { id: node.id, name: node.name, slug: node.slug };

	if (node.children.length > 0) {
		return {
			active,
			back,
			rows: node.children.map(toRow),
			rowsAreChildren: true,
		};
	}

	const siblings = (parent ? parent.children : tree).filter(
		(s) => s.id !== node.id
	);
	return { active, back, rows: siblings.map(toRow), rowsAreChildren: false };
}
