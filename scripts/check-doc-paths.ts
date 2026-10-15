import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, normalize } from "node:path";
import { PARES } from "./check-dashboard-drift.ts";

const EXCLUDED_FILE = /(^|\/)skills\/|^tools\/oxlint\/anti-slop\//;

const WARN_ONLY_FILE = /^docs\/adr\//;

// Não pode ser /dashboard/i: a área do cliente vive em apps/web/src/app/dashboard/
// e as linhas que a citam precisam ser conferidas.
const SKIP_LINE_CITING_OTHER_REPO =
	/emach-dashboard|\b(do|no|pelo) dashboard\b/i;

const DELIBERATE_MISSING =
	/removid|apagad|não usa|não existe|histórico do git|<!-- check-docs: ignore -->/i;

const LINK = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const CODE = /`([^`\n]+)`/g;
const FENCE = /^(```|~~~)/;

const EXT =
	/\.(ts|tsx|js|mjs|cjs|json|jsonc|md|yml|yaml|sql|css|sh|toml|html|png|svg|env)$/;

const PREFIX = /^(\.\/)?(apps|packages|docs|scripts|tools|\.github|\.claude)\//;

const SKIP =
	/(^|\/)\.env(\.|$)|[*<>{}$\s|]|^https?:|^mailto:|^@|^#|^~|^\/|^node_modules\/|\.\.\.|^[a-z]+:\/\//;

const ANCHOR = /#.*$/;
const LINE_OR_SYMBOL = /:(L?\d+([-–,]L?\d+)*(:\d+)?|[A-Za-z_]\w*)$/;
const LINE_NUMBER = /:L?\d+([-–,]L?\d+)*(:\d+)?$/;
const TRAILING_SLASH = /\/$/;
const LEADING_DOT_SLASH = /^\.\//;

const WHITESPACE = /\s+/;
const ENV_ASSIGNMENT = /^[A-Z_][A-Z0-9_]*=/;
const NOT_A_SCRIPT_NAME = /[/<>{}$]/;

const ADR_FILE = /^docs\/adr\/(\d{4})-[^/]*\.md$/;
const ADR_CITATION = /ADR-(\d{4})[),]*( do dashboard| no `emach-dashboard`)?/g;

const BUN_SUBCOMMANDS = new Set([
	"add",
	"build",
	"create",
	"exec",
	"i",
	"init",
	"install",
	"link",
	"outdated",
	"pm",
	"remove",
	"rm",
	"test",
	"unlink",
	"update",
	"upgrade",
	"x",
]);

const BUN_FLAG_FIELD = new Map<string, "cwd" | "filter">([
	["--cwd", "cwd"],
	["-F", "filter"],
	["--filter", "filter"],
]);

const DB_PACKAGE = "packages/db/package.json";
const DB_CLAUDE_MD = "packages/db/CLAUDE.md";
const DB_SCRIPT = /db:[a-z][\w:-]*/g;

type Severity = "erro" | "aviso";

interface Finding {
	detail: string;
	file: string;
	kind: string;
	line: number;
	severity: Severity;
}

interface Ref {
	file: string;
	kind: "link" | "code";
	line: number;
	raw: string;
}

interface BunCall {
	cwd?: string;
	filter?: string;
	name: string;
}

interface WorkspacePackage {
	dir: string;
	name: string;
	scripts: Set<string>;
}

const root = process.argv[2] ?? process.cwd();

// core.quotepath=off: sem ele o git escapa acento em octal e o readFileSync falha.
function gitLsFiles(pattern = ""): string[] {
	return execSync(`git -c core.quotepath=off ls-files ${pattern}`, {
		cwd: root,
		encoding: "utf8",
	})
		.split("\n")
		.filter(Boolean);
}

const exists = (p: string) => existsSync(join(root, p));
const read = (p: string) => readFileSync(join(root, p), "utf8");

function strip(p: string): string {
	return p
		.replace(ANCHOR, "")
		.replace(LINE_OR_SYMBOL, "")
		.replace(TRAILING_SLASH, "");
}

const tracked = gitLsFiles();
const trackedPathSuffixes = new Set<string>();

for (const t of tracked) {
	const parts = t.split("/");

	for (let i = 0; i < parts.length; i++) {
		for (let j = i + 1; j <= parts.length; j++) {
			trackedPathSuffixes.add(parts.slice(i, j).join("/"));
		}
	}
}

// O contrato e o resto que vem do dashboard citam caminhos e ADRs de lá; o
// check:docs do dashboard confere o original e o drift-dashboard.yml, a cópia.
function mirroredFromDashboard(file: string): boolean {
	return PARES.some(
		(p) => file === p.caminho || file.startsWith(`${p.caminho}/`)
	);
}

const docFiles = tracked.filter(
	(f) =>
		f.endsWith(".md") &&
		!(
			f.includes("node_modules") ||
			EXCLUDED_FILE.test(f) ||
			mirroredFromDashboard(f)
		)
);

const localAdrs = new Set(
	tracked.flatMap((f) => f.match(ADR_FILE)?.slice(1, 2) ?? [])
);

function readManifest(path: string): WorkspacePackage {
	// SAFETY: package.json rastreado é manifest npm; name e scripts são opcionais e caem no ?? abaixo.
	const manifest = JSON.parse(read(path)) as {
		name?: string;
		scripts?: Record<string, string>;
	};

	return {
		dir: dirname(path),
		name: manifest.name ?? "",
		scripts: new Set(Object.keys(manifest.scripts ?? {})),
	};
}

const workspacePackages = tracked
	.filter((f) => basename(f) === "package.json")
	.map(readManifest);

const findings: Finding[] = [];
let refsChecked = 0;

function report(
	file: string,
	line: number,
	kind: string,
	detail: string,
	severity: Severity = WARN_ONLY_FILE.test(file) ? "aviso" : "erro"
) {
	const repeated = findings.some(
		(f) => f.file === file && f.line === line && f.detail === detail
	);

	if (!repeated) {
		findings.push({ file, line, kind, detail, severity });
	}
}

function lineOf(text: string, index: number): number {
	return text.slice(0, index).split("\n").length;
}

function resolves(r: Ref, p: string): boolean {
	const fromFile = normalize(join(dirname(r.file), p));

	if (r.kind === "link") {
		return exists(fromFile);
	}

	return (
		exists(p) ||
		exists(fromFile) ||
		trackedPathSuffixes.has(p.replace(LEADING_DOT_SLASH, ""))
	);
}

function checkPath(r: Ref) {
	const p = SKIP.test(r.raw) ? "" : strip(r.raw);

	if (!p) {
		return;
	}

	refsChecked++;

	if (!resolves(r, p)) {
		report(r.file, r.line, "caminho", `${r.raw} não existe no repo`);
	}
}

function isPathRef(code: string): boolean {
	const p = strip(code);

	if (code.includes("/")) {
		return EXT.test(p) || PREFIX.test(code);
	}

	return EXT.test(p) && !p.startsWith(".");
}

function scriptCall(
	call: Partial<BunCall>,
	name: string,
	viaRun: boolean
): BunCall | null {
	const isFile = NOT_A_SCRIPT_NAME.test(name) || EXT.test(name);
	const isSubcommand = !viaRun && BUN_SUBCOMMANDS.has(name);

	return isFile || isSubcommand ? null : { ...call, name };
}

function parseBunCall(code: string): BunCall | null {
	const tokens = code
		.trim()
		.split(WHITESPACE)
		.filter((t) => !ENV_ASSIGNMENT.test(t));

	if (tokens.shift() !== "bun") {
		return null;
	}

	const call: Partial<BunCall> = {};
	let viaRun = false;

	while (tokens.length > 0) {
		const t = tokens.shift() ?? "";
		const [flag = "", inline] = t.split("=", 2);
		const field = BUN_FLAG_FIELD.get(flag);

		if (field) {
			call[field] = inline ?? tokens.shift();
		} else if (t === "run") {
			viaRun = true;
		} else if (!t.startsWith("-")) {
			return scriptCall(call, t, viaRun);
		}
	}

	return null;
}

function hasBin(dir: string, name: string): boolean {
	return (
		exists(join(dir, "node_modules/.bin", name)) ||
		exists(join("node_modules/.bin", name))
	);
}

function bunCallResolves(call: BunCall): boolean {
	if (call.cwd) {
		const dir = normalize(call.cwd).replace(TRAILING_SLASH, "");
		const pkg = workspacePackages.find((w) => w.dir === dir);

		return Boolean(pkg?.scripts.has(call.name)) || hasBin(dir, call.name);
	}

	if (call.filter) {
		const pkg = workspacePackages.find(
			(w) => w.name === call.filter || basename(w.dir) === call.filter
		);

		return (
			Boolean(pkg?.scripts.has(call.name)) ||
			(pkg !== undefined && hasBin(pkg.dir, call.name))
		);
	}

	return (
		workspacePackages.some((w) => w.scripts.has(call.name)) ||
		hasBin(".", call.name)
	);
}

function describeBunCall(call: BunCall): string {
	if (call.cwd) {
		return `${call.name} não é script de ${call.cwd}/package.json`;
	}

	if (call.filter) {
		return `${call.name} não é script do pacote ${call.filter}`;
	}

	return `${call.name} não é script de nenhum package.json nem binário de node_modules/.bin`;
}

function checkCode(file: string, line: number, code: string, l: string) {
	const lineNumber = code.match(LINE_NUMBER);

	if (lineNumber && EXT.test(code.slice(0, lineNumber.index))) {
		report(
			file,
			line,
			"linha",
			`${code}: cite a função ou o símbolo, não a linha`
		);
	}

	if (SKIP_LINE_CITING_OTHER_REPO.test(l)) {
		return;
	}

	const call = parseBunCall(code);

	if (call) {
		refsChecked++;

		if (!bunCallResolves(call)) {
			report(file, line, "bun-script", describeBunCall(call));
		}

		return;
	}

	const deliberate =
		DELIBERATE_MISSING.test(l) &&
		(!code.includes("/") || WARN_ONLY_FILE.test(file));

	if (!deliberate && isPathRef(code)) {
		checkPath({ file, line, raw: code, kind: "code" });
	}
}

function checkAdrs(file: string, line: number, l: string) {
	for (const [, number = "", qualifier] of l.matchAll(ADR_CITATION)) {
		refsChecked++;

		if (!(localAdrs.has(number) || qualifier)) {
			report(file, line, "adr", `ADR-${number} sem "do dashboard"`);
		}
	}
}

function checkDoc(file: string) {
	let inFence = false;

	for (const [i, l] of read(file).split("\n").entries()) {
		if (FENCE.test(l.trim())) {
			inFence = !inFence;
			continue;
		}

		if (inFence) {
			continue;
		}

		checkAdrs(file, i + 1, l);

		const skipLinks =
			SKIP_LINE_CITING_OTHER_REPO.test(l) ||
			(DELIBERATE_MISSING.test(l) && WARN_ONLY_FILE.test(file));

		for (const [, raw] of l.matchAll(LINK)) {
			if (raw && !skipLinks) {
				checkPath({ file, line: i + 1, raw, kind: "link" });
			}
		}

		for (const [, code] of l.replace(LINK, "").matchAll(CODE)) {
			checkCode(file, i + 1, (code ?? "").trim(), l);
		}
	}
}

function checkDbScripts() {
	if (!(exists(DB_PACKAGE) && exists(DB_CLAUDE_MD))) {
		return;
	}

	const pkgText = read(DB_PACKAGE);
	const { scripts } = readManifest(DB_PACKAGE);
	const documented = new Set(read(DB_CLAUDE_MD).match(DB_SCRIPT));

	for (const name of scripts) {
		if (name.startsWith("db:") && !documented.has(name)) {
			report(
				DB_PACKAGE,
				lineOf(pkgText, pkgText.indexOf(`"${name}"`)),
				"db-script",
				`${name} não aparece em ${DB_CLAUDE_MD}`
			);
		}
	}
}

for (const file of docFiles) {
	checkDoc(file);
}

checkDbScripts();

const broken = findings.filter((f) => f.severity === "erro");
const warned = findings.filter((f) => f.severity === "aviso");

for (const f of [...broken, ...warned]) {
	const kind = f.severity === "aviso" ? `aviso:${f.kind}` : f.kind;
	console.log(`${f.file}:${f.line}\t${kind}\t${f.detail}`);
}

console.log(
	`files=${docFiles.length} refs=${refsChecked} broken=${broken.length} warned=${warned.length}`
);

process.exit(broken.length ? 1 : 0);
