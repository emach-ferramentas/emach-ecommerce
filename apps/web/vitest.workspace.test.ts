import { describe, expect, it } from "vitest";
import { INTEGRATION } from "./vitest.config";
import { workspaceProjects } from "./vitest.workspace";

function project(unitOnly: boolean, name: string) {
	return workspaceProjects({ unitOnly }).find((p) => p.test?.name === name);
}

describe("projetos do vitest (#246)", () => {
	it("roda a lista INTEGRATION num processo só, um arquivo por vez", () => {
		const integration = project(false, "integration");
		expect(integration?.test?.include).toEqual(INTEGRATION);
		expect(integration?.test?.poolOptions?.forks?.singleFork).toBe(true);
	});

	it("o projeto unit nunca pega arquivo de integração", () => {
		for (const unitOnly of [false, true]) {
			expect(project(unitOnly, "unit")?.test?.exclude).toEqual(
				expect.arrayContaining(INTEGRATION)
			);
		}
	});

	it("o test:ci (VITEST_UNIT_ONLY=1) monta só o projeto unit", () => {
		expect(
			workspaceProjects({ unitOnly: true }).map((p) => p.test?.name)
		).toEqual(["unit"]);
	});
});
