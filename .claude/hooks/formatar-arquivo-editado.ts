import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const EXTENSOES_DO_BIOME = new Set([
	".cjs",
	".css",
	".js",
	".json",
	".jsonc",
	".jsx",
	".mjs",
	".ts",
	".tsx",
]);

const raiz = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const evento = JSON.parse(readFileSync(0, "utf8"));

const alvoDoBiome = (arquivo: unknown) => {
	if (typeof arquivo !== "string") {
		return;
	}
	const absoluto = resolve(raiz, arquivo);
	const relativo = relative(raiz, absoluto);
	const foraDoProjeto =
		relativo === ".." ||
		relativo.startsWith(`..${sep}`) ||
		isAbsolute(relativo);
	if (
		foraDoProjeto ||
		!EXTENSOES_DO_BIOME.has(extname(absoluto)) ||
		!existsSync(absoluto)
	) {
		return;
	}
	return absoluto;
};

const alvo = alvoDoBiome(evento.tool_input?.file_path);

if (alvo) {
	const biome = spawnSync(
		join(raiz, "node_modules/.bin/biome"),
		[
			"check",
			"--write",
			"--no-errors-on-unmatched",
			"--files-ignore-unknown=true",
			"--skip=correctness/noUnusedImports",
			alvo,
		],
		{ cwd: raiz, stdio: ["ignore", "inherit", "inherit"] }
	);
	process.exitCode = biome.status === 0 ? 0 : 1;
}
