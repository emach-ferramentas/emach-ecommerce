import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { YAML } from "bun";
import { z } from "zod";

const raiz = resolve(import.meta.dir, "..");
const ESPACOS = /\s+/;

function ler(arquivo: string): string {
	return readFileSync(resolve(raiz, arquivo), "utf8");
}

const passoSchema = z.object({
	run: z.string().optional(),
	uses: z.string().optional(),
});

const passosDoCheckTypes = z
	.object({
		jobs: z.object({
			"check-types": z.object({ steps: z.array(passoSchema) }),
		}),
	})
	.parse(YAML.parse(ler(".github/workflows/ci.yml"))).jobs["check-types"].steps;

function indiceDoRun(comando: string): number {
	return passosDoCheckTypes.findIndex((p) => p.run?.trim() === comando);
}

test("o job check-types roda bun run test:repo", () => {
	expect(indiceDoRun("bun run test:repo")).toBeGreaterThanOrEqual(0);
});

test("o test:repo cobre .claude/hooks/ e scripts/", () => {
	const testRepo = z
		.object({ scripts: z.object({ "test:repo": z.string() }) })
		.parse(JSON.parse(ler("package.json"))).scripts["test:repo"];

	expect(testRepo.split(ESPACOS)).toEqual(
		expect.arrayContaining(["./.claude/hooks/", "./scripts/"])
	);
});

test("o check-types instala o Node antes de bun run test:lint-rules", () => {
	const lintRules = indiceDoRun("bun run test:lint-rules");

	const setupNode = passosDoCheckTypes.findIndex((p) =>
		p.uses?.startsWith("actions/setup-node@")
	);

	expect(lintRules).toBeGreaterThanOrEqual(0);
	expect(setupNode).toBeGreaterThanOrEqual(0);
	expect(setupNode).toBeLessThan(lintRules);
});
