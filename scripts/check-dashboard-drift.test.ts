import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import {
	caminhosDoSync,
	PARES,
	WORKFLOW_DO_SYNC,
} from "./check-dashboard-drift";

const SCRIPT = resolve(import.meta.dir, "check-dashboard-drift.ts");

const DASHBOARD_LOCAL =
	process.env.DASHBOARD_DIR ??
	resolve(import.meta.dir, "../../emach-dashboard");

const SYNC_YML = `on:
  push:
    branches: [main]
    paths:
      - "packages/db/src/schema/**"
      - "packages/db/src/queries/**"
      - "packages/db/src/utils.ts"
      - "packages/db/src/sql/triggers.sql"
      - "packages/db/src/sql/rls.sql"
      - "docs/integration/admin-ecommerce.md"
  workflow_dispatch:
`;

const BASE = {
	"packages/db/src/schema/client.ts": "export const client = 1;\n",
	"packages/db/src/queries/orders.ts": "export const orders = 1;\n",
	"packages/db/src/utils.ts": "export const toDate = 1;\n",
	"packages/db/src/sql/triggers.sql": "-- triggers\n",
	"packages/db/src/sql/rls.sql": "-- rls\n",
	"docs/integration/admin-ecommerce.md": "# Contrato\n",
	"tools/oxlint/anti-slop/index.ts": "export default {};\n",
	"tools/oxlint/anti-slop/UPSTREAM.md": "# Upstream\n",
} satisfies Record<string, string>;

const temporarios: string[] = [];

afterAll(() => {
	for (const dir of temporarios) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function repo(arquivos: Record<string, string>): string {
	const raiz = mkdtempSync(join(tmpdir(), "drift-"));
	temporarios.push(raiz);

	for (const [caminho, conteudo] of Object.entries(arquivos)) {
		mkdirSync(dirname(join(raiz, caminho)), { recursive: true });
		writeFileSync(join(raiz, caminho), conteudo);
	}

	return raiz;
}

function dashboard(arquivos: Record<string, string>, syncYml = SYNC_YML) {
	return repo({ ...arquivos, [WORKFLOW_DO_SYNC]: syncYml });
}

function rodar(ecommerce: string, dash: string) {
	const r = spawnSync("bun", [SCRIPT, ecommerce, dash], { encoding: "utf8" });

	return {
		status: r.status,
		linhas: (r.stderr.split("\n\n")[0] ?? "").split("\n").filter(Boolean),
	};
}

test("repos iguais saem com 0", () => {
	const r = spawnSync("bun", [SCRIPT, repo(BASE), dashboard(BASE)], {
		encoding: "utf8",
	});

	expect(r.status).toBe(0);
	expect(r.stdout).toContain("drift-dashboard: 7 caminhos iguais");
});

test("uma linha mudada em utils.ts sai com 1 e cita o arquivo", () => {
	const ecommerce = repo({
		...BASE,
		"packages/db/src/utils.ts": "export const toDate = 2;\n",
	});

	expect(rodar(ecommerce, dashboard(BASE))).toEqual({
		status: 1,
		linhas: ["conteúdo diferente: packages/db/src/utils.ts"],
	});
});

test("arquivo de um lado só conta como diferença, nos dois sentidos", () => {
	const ecommerce = repo({
		...BASE,
		"packages/db/src/schema/so-aqui.ts": "x\n",
	});

	const dash = dashboard({
		...BASE,
		"packages/db/src/queries/so-la.ts": "y\n",
	});

	expect(rodar(ecommerce, dash)).toEqual({
		status: 1,
		linhas: [
			"só no ecommerce: packages/db/src/schema/so-aqui.ts",
			"só no dashboard: packages/db/src/queries/so-la.ts",
		],
	});
});

test("contrato ausente no ecommerce é diferença", () => {
	const { "docs/integration/admin-ecommerce.md": _, ...semContrato } = BASE;

	expect(rodar(repo(semContrato), dashboard(BASE))).toEqual({
		status: 1,
		linhas: ["só no dashboard: docs/integration/admin-ecommerce.md"],
	});
});

test("diferença só no UPSTREAM.md do anti-slop sai com 0", () => {
	const ecommerce = repo({
		...BASE,
		"tools/oxlint/anti-slop/UPSTREAM.md": "# Upstream do ecommerce\n",
	});

	expect(rodar(ecommerce, dashboard(BASE)).status).toBe(0);
});

test("código do anti-slop diferente sai com 1", () => {
	const ecommerce = repo({
		...BASE,
		"tools/oxlint/anti-slop/index.ts": "export default { rules: {} };\n",
	});

	expect(rodar(ecommerce, dashboard(BASE))).toEqual({
		status: 1,
		linhas: ["conteúdo diferente: tools/oxlint/anti-slop/index.ts"],
	});
});

test("caminho novo no paths: do sync sem par na tabela sai com 1", () => {
	const yml = SYNC_YML.replace(
		"  workflow_dispatch:",
		'      - "packages/db/src/sql/novo.sql"\n  workflow_dispatch:'
	);

	expect(rodar(repo(BASE), dashboard(BASE, yml))).toEqual({
		status: 1,
		linhas: ["caminho do sync sem par: packages/db/src/sql/novo.sql"],
	});
});

test.skipIf(!existsSync(join(DASHBOARD_LOCAL, WORKFLOW_DO_SYNC)))(
	"a tabela de pares cobre o paths: do sync-db-schema.yml do dashboard",
	() => {
		const doSync = caminhosDoSync(
			readFileSync(join(DASHBOARD_LOCAL, WORKFLOW_DO_SYNC), "utf8")
		);

		const daTabela = PARES.map((p) => p.caminho);

		expect(doSync.filter((c) => !daTabela.includes(c))).toEqual([]);
	}
);
