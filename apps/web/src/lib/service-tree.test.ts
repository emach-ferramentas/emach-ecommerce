import type { CategoryNode } from "@emach/db/queries/categories";
import { describe, expect, it } from "vitest";
import { isServicePath, splitServiceTree } from "./service-tree";

function node(
	path: string,
	children: CategoryNode[] = [],
	productCount = 1
): CategoryNode {
	const slug = path.split("/").at(-1) ?? path;
	return {
		children,
		depth: path.split("/").length - 2,
		id: `id-${slug}`,
		isActive: true,
		name: slug,
		parentId: null,
		path,
		productCount,
		slug,
		sortOrder: 0,
	};
}

describe("isServicePath", () => {
	it("reconhece a categoria-mãe e as filhas", () => {
		expect(isServicePath("/servicos")).toBe(true);
		expect(isServicePath("/servicos/reboco-e-acabamento")).toBe(true);
	});

	it("não confunde prefixo de texto com segmento", () => {
		expect(isServicePath("/servicos-gerais")).toBe(false);
		expect(isServicePath("/eletricas/servicos")).toBe(false);
		expect(isServicePath("/eletricas")).toBe(false);
	});
});

describe("splitServiceTree", () => {
	const reboco = node("/servicos/reboco-e-acabamento");
	const furar = node("/servicos/furar-e-parafusar");
	const tree = [
		node("/eletricas", [node("/eletricas/furadeiras")]),
		node("/servicos", [reboco, furar]),
		node("/acessorios"),
	];

	it("tira a subárvore de ofícios da árvore de categorias", () => {
		const { categories } = splitServiceTree(tree);
		expect(categories.map((c) => c.path)).toEqual([
			"/eletricas",
			"/acessorios",
		]);
		expect(categories[0]?.children.map((c) => c.path)).toEqual([
			"/eletricas/furadeiras",
		]);
	});

	it("devolve as filhas de servicos como ofícios, na ordem da árvore", () => {
		expect(splitServiceTree(tree).services.map((s) => s.slug)).toEqual([
			"reboco-e-acabamento",
			"furar-e-parafusar",
		]);
	});

	it("tira nó de ofício mesmo pendurado fora da raiz", () => {
		const odd = [node("/eletricas", [node("/servicos/solto")])];
		expect(splitServiceTree(odd).categories[0]?.children).toEqual([]);
	});

	it("sem a categoria servicos, não há ofícios e a árvore fica igual", () => {
		const plain = [node("/eletricas"), node("/acessorios")];
		const split = splitServiceTree(plain);
		expect(split.services).toEqual([]);
		expect(split.categories).toEqual(plain);
	});
});
