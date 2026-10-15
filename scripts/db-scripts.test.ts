import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "bun";
import { z } from "zod";

const raiz = resolve(import.meta.dir, "..");

const ESCRITA_DE_SCHEMA = /drizzle-kit\s+(?:push|migrate|generate)\b/;

const MOTIVO = "schema muda só no dashboard (ADR-0009 do dashboard)";

function lerJson<T>(arquivo: string, schema: z.ZodType<T>): T {
	return schema.parse(JSON.parse(readFileSync(resolve(raiz, arquivo), "utf8")));
}

function packageJsonsRastreados(): string[] {
	const git = spawnSync(["git", "ls-files", "*package.json"], { cwd: raiz });

	return git.stdout.toString().split("\n").filter(Boolean);
}

test("nenhum script de package.json escreve schema com drizzle-kit", () => {
	const arquivos = packageJsonsRastreados();
	expect(arquivos).toContain("package.json");
	expect(arquivos).toContain("packages/db/package.json");

	const violacoes = arquivos.flatMap((arquivo) => {
		const { scripts = {} } = lerJson(
			arquivo,
			z.object({ scripts: z.record(z.string(), z.string()).optional() })
		);

		return Object.entries(scripts)
			.filter(([, comando]) => ESCRITA_DE_SCHEMA.test(comando))
			.map(([nome, comando]) => `${arquivo} ${nome} (${comando}): ${MOTIVO}`);
	});

	expect(violacoes).toEqual([]);
});

test("o turbo.json não tem task db:push", () => {
	const { tasks } = lerJson(
		"turbo.json",
		z.object({ tasks: z.record(z.string(), z.unknown()) })
	);

	expect(Object.keys(tasks)).toContain("db:studio");
	expect(Object.keys(tasks)).not.toContain("db:push");
});
