/**
 * Barra PR que edita aqui um arquivo que o sync do dashboard sobrescreve.
 *
 * A lista é cópia do `paths:` do `.github/workflows/sync-db-schema.yml` do
 * emach-dashboard, que copia esses caminhos com `rsync --delete` e `cp`.
 * Mudou lá, muda aqui.
 */
import { execFileSync } from "node:child_process";
import process from "node:process";

const PREFIXOS_ESPELHADOS = [
	"packages/db/src/schema/",
	"packages/db/src/queries/",
];

const ARQUIVOS_ESPELHADOS = new Set([
	"packages/db/src/utils.ts",
	"packages/db/src/sql/triggers.sql",
	"packages/db/src/sql/rls.sql",
]);

const BRANCH_DO_SYNC = "chore/sync-db-schema";

export interface OrigemDoPr {
	headRef: string;
	headRepo: string;
	repo: string;
}

export function caminhosEspelhadosTocados(arquivos: readonly string[]) {
	return arquivos.filter(
		(arquivo) =>
			ARQUIVOS_ESPELHADOS.has(arquivo) ||
			PREFIXOS_ESPELHADOS.some((prefixo) => arquivo.startsWith(prefixo))
	);
}

export function arquivosBarrados(
	arquivos: readonly string[],
	origem: OrigemDoPr
) {
	const vemDoSync =
		origem.headRef === BRANCH_DO_SYNC && origem.headRepo === origem.repo;

	return vemDoSync ? [] : caminhosEspelhadosTocados(arquivos);
}

function envObrigatoria(nome: string) {
	const valor = process.env[nome];

	if (!valor) {
		console.error(`::error::${nome} ausente no ambiente do sync-guard`);
		process.exit(1);
	}

	return valor;
}

if (import.meta.main) {
	const baseRef = envObrigatoria("BASE_REF");

	const origem: OrigemDoPr = {
		headRef: envObrigatoria("HEAD_REF"),
		headRepo: envObrigatoria("HEAD_REPO"),
		repo: envObrigatoria("REPO"),
	};

	const arquivos = execFileSync(
		"git",
		["diff", "--name-only", "--no-renames", `origin/${baseRef}...HEAD`],
		{ encoding: "utf8" }
	)
		.split("\n")
		.filter(Boolean);

	const barrados = arquivosBarrados(arquivos, origem);

	if (barrados.length > 0) {
		for (const arquivo of barrados) {
			console.error(
				`::error file=${arquivo}::${arquivo} é cópia do emach-dashboard (sync-db-schema.yml); a mudança começa lá`
			);
		}

		process.exit(1);
	}

	console.log(
		`sync-guard: ${arquivos.length} arquivo(s) no diff, nenhum caminho espelhado do dashboard`
	);
}
