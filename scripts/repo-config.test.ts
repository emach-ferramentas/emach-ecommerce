import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TOML } from "bun";
import { z } from "zod";
import { clientSchema, serverSchema } from "../packages/env/src/schemas";

const raiz = resolve(import.meta.dir, "..");

function lerJson<T>(arquivo: string, schema: z.ZodType<T>): T {
	return schema.parse(JSON.parse(readFileSync(resolve(raiz, arquivo), "utf8")));
}

const BORDAS = /^(?:!|\*\*\/)+|\/\*\*$/g;

function pasta(padrao: string): string {
	return padrao.replaceAll(BORDAS, "");
}

// Divergência aceita entre os ignores, com o motivo. Pasta nova ignorada em um
// só dos dois precisa de linha aqui.
const SO_NO_OXLINT = {
	"tools/oxlint/emach": "o anti-slop dispararia nas próprias regras",
	"packages/db/src/schema": "cópia do dashboard, chega pelo sync",
	"packages/db/src/queries": "cópia do dashboard, chega pelo sync",
};

const SO_NO_BIOME = {
	".vscode": "config de editor, não é código",
};

test("Biome e oxlint ignoram as mesmas pastas, salvo as exceções declaradas", () => {
	const biome = lerJson(
		"biome.json",
		z.object({ files: z.object({ includes: z.array(z.string()) }) })
	)
		.files.includes.filter((p) => p.startsWith("!"))
		.map(pasta);

	const oxlint = lerJson(
		".oxlintrc.json",
		z.object({ ignorePatterns: z.array(z.string()) })
	).ignorePatterns.map(pasta);

	expect(oxlint.filter((p) => !biome.includes(p)).sort()).toEqual(
		Object.keys(SO_NO_OXLINT).sort()
	);
	expect(biome.filter((p) => !oxlint.includes(p)).sort()).toEqual(
		Object.keys(SO_NO_BIOME).sort()
	);
});

test("o hash do build no turbo inclui toda env de servidor do Zod", () => {
	const env = lerJson(
		"turbo.json",
		z.object({
			tasks: z.object({ build: z.object({ env: z.array(z.string()) }) }),
		})
	).tasks.build.env;

	const cobre = (chave: string) =>
		env.some((p) =>
			p.endsWith("*") ? chave.startsWith(p.slice(0, -1)) : p === chave
		);

	// NEXT_PUBLIC_* entra no hash pela inferência de framework do turbo; NODE_ENV o turbo já considera.
	const chaves = [...Object.keys(serverSchema), ...Object.keys(clientSchema)]
		.filter((k) => !(k.startsWith("NEXT_PUBLIC_") || k === "NODE_ENV"))
		.filter((k) => !cobre(k));

	expect(chaves).toEqual([]);
});

function lerTexto(arquivo: string): string {
	return readFileSync(resolve(raiz, arquivo), "utf8");
}

const NODE_NO_CI = /node-version: (\S+)/g;
const NOME_DO_CI = /^name: (.+)$/m;
const WORKFLOWS_DO_MIRROR = /workflows: \[([^\]]+)\]/;

test("Bun e Node do mise são os mesmos do package.json e do ci.yml", () => {
	const mise = z
		.object({ tools: z.object({ bun: z.string(), node: z.string() }) })
		.parse(TOML.parse(lerTexto("mise.toml")));

	const { packageManager } = lerJson(
		"package.json",
		z.object({ packageManager: z.string() })
	);

	const nodeNoCi = [
		...lerTexto(".github/workflows/ci.yml").matchAll(NODE_NO_CI),
	].map((m) => m[1]);

	expect(packageManager).toBe(`bun@${mise.tools.bun}`);
	expect(nodeNoCi.length).toBeGreaterThan(0);
	expect([...new Set(nodeNoCi)]).toEqual([mise.tools.node]);
});

test("o mirror escuta o workflow do CI pelo nome", () => {
	const nome = lerTexto(".github/workflows/ci.yml").match(NOME_DO_CI)?.[1];

	const escuta = lerTexto(".github/workflows/mirror.yml")
		.match(WORKFLOWS_DO_MIRROR)?.[1]
		?.split(",")
		.map((w) => w.trim());

	expect(nome).toBeDefined();
	expect(escuta).toContain(nome);
});

test("o MCP do shadcn usa a versão do @emach/ui", () => {
	const ui = lerJson(
		"packages/ui/package.json",
		z.object({ dependencies: z.object({ shadcn: z.string() }) })
	).dependencies.shadcn;

	const mcp = lerJson(
		".mcp.json",
		z.object({
			mcpServers: z.object({
				shadcn: z.object({ args: z.array(z.string()) }),
			}),
		})
	).mcpServers.shadcn.args;

	expect(mcp).toContain(`shadcn@${ui}`);
});

test("o @emach/auth da loja exporta só a instância ecommerce", () => {
	const exportsDoAuth = lerJson(
		"packages/auth/package.json",
		z.object({ exports: z.record(z.string(), z.unknown()) })
	).exports;

	expect(Object.keys(exportsDoAuth)).toEqual(["./ecommerce"]);
});
