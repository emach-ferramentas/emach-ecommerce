import type { CategoryNode } from "@emach/db/queries/categories";
import { describe, expect, it } from "vitest";
import { ancestorsOf } from "./category-crumbs";

function node(path: string, name: string, children: CategoryNode[] = []) {
	const slug = path.split("/").at(-1) ?? path;
	return {
		children,
		depth: 0,
		id: slug,
		isActive: true,
		name,
		parentId: null,
		path,
		productCount: 0,
		slug,
		sortOrder: 0,
	};
}

const TREE = [
	node("/eletricas", "Elétricas", [
		node("/eletricas/furadeiras", "Furadeiras", [
			node("/eletricas/furadeiras/impacto", "De impacto"),
		]),
	]),
	node("/servicos", "Serviços", [node("/servicos/reboco", "Reboco")]),
];

describe("ancestorsOf", () => {
	it("monta a trilha da raiz até o pai, pelo path", () => {
		expect(ancestorsOf(TREE, "/eletricas/furadeiras/impacto")).toEqual([
			{ name: "Elétricas", slug: "eletricas" },
			{ name: "Furadeiras", slug: "furadeiras" },
		]);
	});

	it("ofício não mostra a categoria-mãe de serviços", () => {
		expect(ancestorsOf(TREE, "/servicos/reboco")).toEqual([]);
	});

	it("categoria raiz não tem ancestrais", () => {
		expect(ancestorsOf(TREE, "/eletricas")).toEqual([]);
	});
});
