import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { YAML } from "bun";
import { z } from "zod";

const raiz = resolve(import.meta.dir, "..");

const { scripts } = z
	.object({ scripts: z.object({ prepare: z.string(), fix: z.string() }) })
	.parse(JSON.parse(readFileSync(resolve(raiz, "package.json"), "utf8")));

test("o prepare só chama o lefthook depois de achar um repositório git", () => {
	const guarda = scripts.prepare.indexOf("git rev-parse --git-dir");

	expect(guarda).toBeGreaterThanOrEqual(0);
	expect(scripts.prepare.indexOf("lefthook install")).toBeGreaterThan(guarda);
});

// Reproduz o build da Vercel quando um .vercelignore apaga o .git: o bun
// install roda o prepare com o node_modules/.bin no PATH e sem repositório.
test("o prepare sai com 0 num diretório sem .git e não cria hooks", () => {
	const tmp = mkdtempSync(join(tmpdir(), "prepare-sem-git-"));

	try {
		const { status, stderr } = spawnSync("sh", ["-c", scripts.prepare], {
			cwd: tmp,
			encoding: "utf8",
			env: {
				PATH: `${resolve(raiz, "node_modules/.bin")}:${process.env.PATH ?? ""}`,
				GIT_CEILING_DIRECTORIES: dirname(tmp),
			},
		});

		expect({ status, stderr }).toEqual({ status: 0, stderr: "" });
		expect(existsSync(join(tmp, ".git"))).toBe(false);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("o fix roda o Biome antes do oxlint, na ordem do pre-commit", () => {
	const biome = scripts.fix.indexOf("ultracite fix");

	expect(biome).toBeGreaterThanOrEqual(0);
	expect(scripts.fix.indexOf("oxlint --fix")).toBeGreaterThan(biome);
});

test("o pre-commit roda o job biome antes do job oxlint", () => {
	const lefthook = z
		.object({
			"pre-commit": z.object({
				jobs: z.array(z.object({ name: z.string() })),
			}),
		})
		.parse(YAML.parse(readFileSync(resolve(raiz, "lefthook.yml"), "utf8")));

	expect(lefthook["pre-commit"].jobs.map((j) => j.name)).toEqual([
		"biome",
		"oxlint",
		"doc-paths",
	]);
});
