import type { CategoryNode } from "@emach/db/queries/categories";
import { describe, expect, it } from "vitest";
import { deriveDrilldownLevel } from "./drilldown-level";

let seq = 0;
function node(name: string, children: CategoryNode[] = []): CategoryNode {
	seq += 1;
	const id = `id-${seq}`;
	return {
		id,
		slug: name.toLowerCase().replace(/\s+/g, "-"),
		name,
		parentId: null,
		path: `/${id}`,
		depth: 0,
		sortOrder: seq,
		isActive: true,
		productCount: 0,
		children,
	};
}

const impacto = node("Furadeiras de Impacto");
const bateria = node("Parafusadeiras a Bateria");
const furadeiras = node("Furadeiras e Parafusadeiras", [impacto, bateria]);
const serras = node("Serras Elétricas", [node("Serra Circular")]);
const eletricas = node("Ferramentas Elétricas", [furadeiras, serras]);
const manuais = node("Ferramentas Manuais");
const tree = [eletricas, manuais];

describe("deriveDrilldownLevel", () => {
	it("sem seleção: raízes, sem voltar", () => {
		const level = deriveDrilldownLevel(tree, null);
		expect(level.active).toBeNull();
		expect(level.back).toBeNull();
		expect(level.rows.map((r) => r.name)).toEqual([
			"Ferramentas Elétricas",
			"Ferramentas Manuais",
		]);
		expect(level.rowsAreChildren).toBe(false);
		expect(level.rows[0]?.hasChildren).toBe(true);
		expect(level.rows[1]?.hasChildren).toBe(false);
	});

	it("nível intermediário: filhas + voltar pro nível acima", () => {
		const level = deriveDrilldownLevel(tree, furadeiras.slug);
		expect(level.active?.name).toBe("Furadeiras e Parafusadeiras");
		expect(level.back).toEqual({
			name: "Ferramentas Elétricas",
			slug: eletricas.slug,
		});
		expect(level.rows.map((r) => r.name)).toEqual([
			"Furadeiras de Impacto",
			"Parafusadeiras a Bateria",
		]);
		expect(level.rowsAreChildren).toBe(true);
	});

	it("raiz com filhas: voltar = Todas as categorias (slug null)", () => {
		const level = deriveDrilldownLevel(tree, eletricas.slug);
		expect(level.back).toEqual({ name: "Todas as categorias", slug: null });
		expect(level.rowsAreChildren).toBe(true);
	});

	it("folha: irmãs sem o ativo + voltar pro pai", () => {
		const level = deriveDrilldownLevel(tree, impacto.slug);
		expect(level.active?.name).toBe("Furadeiras de Impacto");
		expect(level.back?.name).toBe("Furadeiras e Parafusadeiras");
		expect(level.rows.map((r) => r.name)).toEqual(["Parafusadeiras a Bateria"]);
		expect(level.rowsAreChildren).toBe(false);
	});

	it("folha na raiz: voltar = Todas as categorias", () => {
		const level = deriveDrilldownLevel(tree, manuais.slug);
		expect(level.back).toEqual({ name: "Todas as categorias", slug: null });
		expect(level.rows.map((r) => r.name)).toEqual(["Ferramentas Elétricas"]);
	});

	it("slug inexistente cai no estado sem seleção", () => {
		const level = deriveDrilldownLevel(tree, "nao-existe");
		expect(level.active).toBeNull();
		expect(level.rows).toHaveLength(2);
	});
});
