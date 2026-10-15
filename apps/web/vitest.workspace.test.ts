import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INTEGRATION } from "./vitest.config";
import { workspaceProjects } from "./vitest.workspace";

const SRC = join(import.meta.dirname, "src");
const TESTE = /\.test\.tsx?$/;
const IMPORTA_DB = /^import \{[^}]*\bdb\b[^}]*\} from "@emach\/db";/m;
const MOCKA_DB = /vi\.mock\("@emach\/db"/;

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

	it("teste que usa o db real tem o sufixo .integration.test.ts", () => {
		const usaDbReal = (arquivo: string) => {
			const fonte = readFileSync(join(SRC, arquivo), "utf8");

			return IMPORTA_DB.test(fonte) && !MOCKA_DB.test(fonte);
		};

		const foraDoGlob = readdirSync(SRC, { recursive: true, encoding: "utf8" })
			.filter((f) => TESTE.test(f) && !f.endsWith(".integration.test.ts"))
			.filter(usaDbReal);

		expect(foraDoGlob).toEqual([]);
	});
});
