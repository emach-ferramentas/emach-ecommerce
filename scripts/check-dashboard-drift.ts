/**
 * Compara os caminhos que o ecommerce copia do emach-dashboard com a cópia de
 * lá. Roda no `drift-dashboard.yml` contra a `main` do dashboard.
 *
 * Uso: bun scripts/check-dashboard-drift.ts <raiz-ecommerce> <raiz-dashboard>
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { YAML } from "bun";
import { z } from "zod";

export interface Par {
	caminho: string;
	excluir?: readonly string[];
	tipo: "arquivo" | "diretorio";
}

// O sync-db-schema.yml do dashboard copia os pares que não são do anti-slop,
// com `rsync --delete` nas pastas. O anti-slop é vendorizado nos dois repos e
// cada um registra os próprios desvios no UPSTREAM.md.
export const PARES: readonly Par[] = [
	{ caminho: "packages/db/src/schema", tipo: "diretorio" },
	{ caminho: "packages/db/src/queries", tipo: "diretorio" },
	{ caminho: "packages/db/src/utils.ts", tipo: "arquivo" },
	{ caminho: "packages/db/src/sql/triggers.sql", tipo: "arquivo" },
	{ caminho: "packages/db/src/sql/rls.sql", tipo: "arquivo" },
	{ caminho: "docs/integration/admin-ecommerce.md", tipo: "arquivo" },
	{
		caminho: "tools/oxlint/anti-slop",
		tipo: "diretorio",
		excluir: ["UPSTREAM.md"],
	},
];

export const WORKFLOW_DO_SYNC = ".github/workflows/sync-db-schema.yml";

export interface Diferenca {
	caminho: string;
	tipo:
		| "só no dashboard"
		| "só no ecommerce"
		| "conteúdo diferente"
		| "caminho do sync sem par";
}

const SUFIXO_DE_PASTA = /\/\*\*$/;

const syncSchema = z.object({
	on: z.object({
		push: z.object({ paths: z.array(z.string()) }),
	}),
});

export function caminhosDoSync(yml: string): string[] {
	return syncSchema
		.parse(YAML.parse(yml))
		.on.push.paths.map((p) => p.replace(SUFIXO_DE_PASTA, ""));
}

function arquivosEm(raiz: string, par: Par): Set<string> {
	const base = join(raiz, par.caminho);

	try {
		if (par.tipo === "arquivo") {
			return statSync(base).isFile() ? new Set([par.caminho]) : new Set();
		}

		return new Set(
			readdirSync(base, { recursive: true, withFileTypes: true })
				.filter((e) => e.isFile())
				.map((e) => relative(base, join(e.parentPath, e.name)))
				.filter((r) => !par.excluir?.includes(r))
				.map((r) => join(par.caminho, r))
		);
	} catch (erro) {
		if (erro instanceof Error && "code" in erro && erro.code === "ENOENT") {
			return new Set();
		}

		throw erro;
	}
}

export function diferencas(ecommerce: string, dashboard: string): Diferenca[] {
	const resultado: Diferenca[] = [];
	const cobertos = new Set(PARES.map((p) => p.caminho));

	for (const caminho of caminhosDoSync(
		readFileSync(join(dashboard, WORKFLOW_DO_SYNC), "utf8")
	)) {
		if (!cobertos.has(caminho)) {
			resultado.push({ tipo: "caminho do sync sem par", caminho });
		}
	}

	for (const par of PARES) {
		const doEcommerce = arquivosEm(ecommerce, par);
		const doDashboard = arquivosEm(dashboard, par);

		for (const caminho of [
			...new Set([...doDashboard, ...doEcommerce]),
		].sort()) {
			if (!doEcommerce.has(caminho)) {
				resultado.push({ tipo: "só no dashboard", caminho });
			} else if (!doDashboard.has(caminho)) {
				resultado.push({ tipo: "só no ecommerce", caminho });
			} else if (
				!readFileSync(join(ecommerce, caminho)).equals(
					readFileSync(join(dashboard, caminho))
				)
			) {
				resultado.push({ tipo: "conteúdo diferente", caminho });
			}
		}
	}

	return resultado;
}

const O_QUE_FAZER = `Como resolver:
- schema, queries, utils, sql ou contrato: mergeie o PR chore/sync-db-schema aberto no ecommerce, ou rode o workflow_dispatch do sync-db-schema.yml no dashboard para abrir um.
- tools/oxlint/anti-slop: porte a mudança para o repo que ficou para trás.
- caminho do sync sem par: acrescente o caminho em PARES (scripts/check-dashboard-drift.ts).`;

if (import.meta.main) {
	const [ecommerce, dashboard] = process.argv.slice(2);

	if (!(ecommerce && dashboard)) {
		console.error(
			"uso: bun scripts/check-dashboard-drift.ts <raiz-ecommerce> <raiz-dashboard>"
		);
		process.exit(2);
	}

	const achadas = diferencas(ecommerce, dashboard);

	if (achadas.length > 0) {
		for (const d of achadas) {
			console.error(`${d.tipo}: ${d.caminho}`);
		}

		console.error(
			`\n${achadas.length} diferença(s) com o dashboard.\n${O_QUE_FAZER}`
		);
		process.exit(1);
	}

	console.log(
		`drift-dashboard: ${PARES.length} caminhos iguais aos da main do dashboard`
	);
}
