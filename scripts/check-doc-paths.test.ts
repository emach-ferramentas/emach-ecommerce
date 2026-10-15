import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SCRIPT = join(import.meta.dir, "check-doc-paths.ts");
const roots: string[] = [];

afterAll(() => {
	for (const r of roots) {
		rmSync(r, { recursive: true, force: true });
	}
});

function check(files: Record<string, string>) {
	const root = mkdtempSync(join(tmpdir(), "check-docs-"));
	roots.push(root);

	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}

	spawnSync("git", ["init", "-q"], { cwd: root });
	spawnSync("git", ["add", "-A"], { cwd: root });

	const run = spawnSync(process.execPath, [SCRIPT, root], {
		encoding: "utf8",
	});

	return { code: run.status, lines: run.stdout.trim().split("\n") };
}

const PKG = JSON.stringify({ scripts: { "db:read": "x" } });

describe("caminhos", () => {
	test("caminho existente passa", () => {
		expect(
			check({ "apps/web/a.ts": "", "README.md": "Veja `apps/web/a.ts`." })
		).toEqual({ code: 0, lines: ["files=1 refs=1 broken=0 warned=0"] });
	});

	test("caminho inexistente e arquivo da raiz que não existe falham", () => {
		expect(
			check({ "README.md": "Veja `apps/web/a.ts` e `lefthook.yml`." })
		).toEqual({
			code: 1,
			lines: [
				"README.md:1\tcaminho\tapps/web/a.ts não existe no repo",
				"README.md:1\tcaminho\tlefthook.yml não existe no repo",
				"files=1 refs=2 broken=2 warned=0",
			],
		});
	});

	test("linha que cita o emach-dashboard ou o dashboard é pulada", () => {
		expect(
			check({
				"README.md": [
					"No `emach-dashboard`, ver `apps/web/src/lib/gone.ts`.",
					"O workflow `sync-db-schema.yml` do dashboard abre o PR.",
				].join("\n"),
			})
		).toEqual({ code: 0, lines: ["files=1 refs=0 broken=0 warned=0"] });
	});

	test("linha com a área do cliente apps/web/src/app/dashboard/ é conferida", () => {
		expect(
			check({
				"README.md":
					"A área do cliente fica em `apps/web/src/app/dashboard/x.tsx`.",
			})
		).toEqual({
			code: 1,
			lines: [
				"README.md:1\tcaminho\tapps/web/src/app/dashboard/x.tsx não existe no repo",
				"files=1 refs=1 broken=1 warned=0",
			],
		});
	});

	test("contrato copiado do dashboard fica fora do check", () => {
		expect(
			check({
				"docs/integration/admin-ecommerce.md":
					"Ver `apps/web/src/lib/gone.ts` e ADR-0009.",
			})
		).toEqual({ code: 0, lines: ["files=0 refs=0 broken=0 warned=0"] });
	});

	test("caminho quebrado em ADR local avisa e sai 0", () => {
		expect(
			check({ "docs/adr/0001-x.md": "Ver `packages/db/gone.ts`." })
		).toEqual({
			code: 0,
			lines: [
				"docs/adr/0001-x.md:1\taviso:caminho\tpackages/db/gone.ts não existe no repo",
				"files=1 refs=1 broken=0 warned=1",
			],
		});
	});

	test("citar linha de arquivo é erro", () => {
		expect(
			check({
				"packages/env/a.ts": "",
				"README.md": "Ver `packages/env/a.ts:25-26`.",
			})
		).toEqual({
			code: 1,
			lines: [
				"README.md:1\tlinha\tpackages/env/a.ts:25-26: cite a função ou o símbolo, não a linha",
				"files=1 refs=1 broken=1 warned=0",
			],
		});
	});
});

describe("ADR", () => {
	test("ADR-0009 do dashboard e ADR-0009, no `emach-dashboard` passam", () => {
		expect(
			check({
				"README.md": [
					"Sync (ADR-0009 do dashboard).",
					"Ownership (ADR-0009, no `emach-dashboard`).",
				].join("\n"),
			})
		).toEqual({ code: 0, lines: ["files=1 refs=2 broken=0 warned=0"] });
	});

	test("ADR-0009 sem qualificador falha", () => {
		expect(check({ "README.md": "## Schema sync (ADR-0009)" })).toEqual({
			code: 1,
			lines: [
				'README.md:1\tadr\tADR-0009 sem "do dashboard"',
				"files=1 refs=1 broken=1 warned=0",
			],
		});
	});

	test("ADR-0003 passa quando docs/adr/0003-x.md existe", () => {
		expect(
			check({ "docs/adr/0003-x.md": "# 3", "README.md": "Ver ADR-0003." })
		).toEqual({ code: 0, lines: ["files=2 refs=1 broken=0 warned=0"] });
	});

	test("ADR em bloco de código não é conferido", () => {
		expect(check({ "README.md": "```\nADR-0009\n```" })).toEqual({
			code: 0,
			lines: ["files=1 refs=0 broken=0 warned=0"],
		});
	});
});

describe("scripts", () => {
	test("script do --cwd e subcomando do bun passam, script inexistente falha", () => {
		expect(
			check({
				"packages/db/package.json": PKG,
				"packages/db/CLAUDE.md": "`db:read` lê.",
				"README.md":
					"`bun run --cwd packages/db db:read`, `bun install` e `bun db:synk`.",
			})
		).toEqual({
			code: 1,
			lines: [
				"README.md:1\tbun-script\tdb:synk não é script de nenhum package.json nem binário de node_modules/.bin",
				"files=2 refs=2 broken=1 warned=0",
			],
		});
	});

	test("db:* sem menção no packages/db/CLAUDE.md falha", () => {
		expect(
			check({
				"packages/db/package.json": JSON.stringify(
					{ scripts: { "db:read": "x", "db:studio": "y" } },
					null,
					2
				),
				"packages/db/CLAUDE.md": "`db:read` lê.",
			})
		).toEqual({
			code: 1,
			lines: [
				"packages/db/package.json:4\tdb-script\tdb:studio não aparece em packages/db/CLAUDE.md",
				"files=1 refs=0 broken=1 warned=0",
			],
		});
	});
});
