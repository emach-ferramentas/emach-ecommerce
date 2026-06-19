import type { CategoryNode } from "@emach/db/queries/categories";
import { describe, expect, it } from "vitest";
import { collectPathToActive } from "./category-tree";

function node(
	id: string,
	slug: string,
	children: CategoryNode[] = []
): CategoryNode {
	return {
		id,
		slug,
		name: id,
		parentId: null,
		path: id,
		depth: 0,
		sortOrder: 0,
		isActive: true,
		productCount: 0,
		children,
	};
}

const tree: CategoryNode[] = [
	node("eletricas", "ferramentas-eletricas", [
		node("furadeiras", "furadeiras-parafusadeiras", [
			node("impacto", "furadeiras-de-impacto"),
		]),
	]),
	node("manuais", "ferramentas-manuais"),
];

describe("collectPathToActive", () => {
	it("returns empty set when slug is null", () => {
		expect(collectPathToActive(tree, null).size).toBe(0);
	});

	it("returns empty set when slug is not found", () => {
		expect(collectPathToActive(tree, "inexistente").size).toBe(0);
	});

	it("includes the active leaf and all its ancestors", () => {
		const ids = collectPathToActive(tree, "furadeiras-de-impacto");
		expect([...ids].sort()).toEqual(["eletricas", "furadeiras", "impacto"]);
	});

	it("includes a matched root itself", () => {
		const ids = collectPathToActive(tree, "ferramentas-manuais");
		expect([...ids]).toEqual(["manuais"]);
	});
});
