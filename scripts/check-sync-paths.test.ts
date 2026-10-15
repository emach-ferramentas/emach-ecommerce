import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { arquivosBarrados, type OrigemDoPr } from "./check-sync-paths";

const REPO = "othavi0/emach-ecommerce";

const BRANCH_COMUM: OrigemDoPr = {
	headRef: "feat/x",
	headRepo: REPO,
	repo: REPO,
};

const SYNC_DO_REPO: OrigemDoPr = {
	headRef: "chore/sync-db-schema",
	headRepo: REPO,
	repo: REPO,
};

const SYNC_DE_FORK: OrigemDoPr = {
	headRef: "chore/sync-db-schema",
	headRepo: "alguem/emach-ecommerce",
	repo: REPO,
};

const SCHEMA_CLIENT = "packages/db/src/schema/client.ts";

test("arquivo de schema/ numa branch comum é barrado", () => {
	expect(arquivosBarrados([SCHEMA_CLIENT], BRANCH_COMUM)).toEqual([
		SCHEMA_CLIENT,
	]);
});

test("utils.ts e sql/rls.sql do db são barrados", () => {
	const arquivos = ["packages/db/src/utils.ts", "packages/db/src/sql/rls.sql"];

	expect(arquivosBarrados(arquivos, BRANCH_COMUM)).toEqual(arquivos);
});

test("arquivos do db fora do sync passam", () => {
	const arquivos = [
		"packages/db/src/index.ts",
		"packages/db/scripts/apply-triggers.ts",
		"apps/web/src/app/page.tsx",
	];

	expect(arquivosBarrados(arquivos, BRANCH_COMUM)).toEqual([]);
});

test("a branch do sync no próprio repo passa", () => {
	expect(arquivosBarrados([SCHEMA_CLIENT], SYNC_DO_REPO)).toEqual([]);
});

test("a branch do sync vinda de fork é barrada", () => {
	expect(arquivosBarrados([SCHEMA_CLIENT], SYNC_DE_FORK)).toEqual([
		SCHEMA_CLIENT,
	]);
});

const script = resolve(import.meta.dir, "check-sync-paths.ts");
const reposTemp: string[] = [];

afterAll(() => {
	for (const repo of reposTemp) {
		rmSync(repo, { recursive: true, force: true });
	}
});

function git(repo: string, ...args: string[]) {
	const { status, stderr } = spawnSync(
		"git",
		["-c", "user.name=t", "-c", "user.email=t@t", ...args],
		{ cwd: repo, encoding: "utf8" }
	);

	expect(stderr).not.toContain("fatal");
	expect(status).toBe(0);
}

function commitar(repo: string, caminho: string) {
	const absoluto = join(repo, caminho);

	mkdirSync(dirname(absoluto), { recursive: true });
	writeFileSync(absoluto, `${caminho}\n`);
	git(repo, "add", ".");
	git(repo, "commit", "-q", "-m", caminho);
}

function prSobre(arquivosDaMain: readonly string[]) {
	const repo = mkdtempSync(join(tmpdir(), "sync-guard-"));

	reposTemp.push(repo);
	git(repo, "init", "-q", "-b", "main");

	for (const arquivo of ["README.md", ...arquivosDaMain]) {
		commitar(repo, arquivo);
	}

	git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
	git(repo, "switch", "-q", "-c", BRANCH_COMUM.headRef);

	return repo;
}

function rodarScript(repo: string) {
	return spawnSync("bun", [script], {
		cwd: repo,
		encoding: "utf8",
		env: {
			PATH: process.env.PATH ?? "",
			BASE_REF: "main",
			HEAD_REF: BRANCH_COMUM.headRef,
			HEAD_REPO: REPO,
			REPO,
		},
	});
}

const ERRO_SCHEMA_CLIENT = `::error file=${SCHEMA_CLIENT}::${SCHEMA_CLIENT} é cópia do emach-dashboard (sync-db-schema.yml); a mudança começa lá`;

test("o script lê o diff do PR no git e sai com 1 citando o arquivo", () => {
	const repo = prSobre([]);

	commitar(repo, SCHEMA_CLIENT);

	const { status, stderr } = rodarScript(repo);

	expect(status).toBe(1);
	expect(stderr).toContain(ERRO_SCHEMA_CLIENT);
});

test("mover um arquivo espelhado para fora do caminho é barrado", () => {
	const repo = prSobre([SCHEMA_CLIENT]);

	git(repo, "mv", SCHEMA_CLIENT, "packages/db/src/client-local.ts");
	git(repo, "commit", "-q", "-m", "mv");

	const { status, stderr } = rodarScript(repo);

	expect(status).toBe(1);
	expect(stderr).toContain(ERRO_SCHEMA_CLIENT);
});
