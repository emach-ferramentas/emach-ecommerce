import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Todo export async de arquivo "use server" vira endpoint POST que o navegador
// chama sem passar pela guarda do render. Sem sessão nem limiter, ele martela o
// banco único (o de produção) ou a cota da Frenet (#284).

const SRC = resolve(import.meta.dirname, "../..");
const SESSION_MODULE = "@/lib/session";
const RATE_LIMIT_MODULE = "@/lib/rate-limit";
const GUARD = "requireCurrentClient";
const LIMITER_SUFFIX = "Limiter";
const TEST_FILE = /\.test\.tsx?$/;
const SOURCE_FILE = /\.tsx?$/;

const MENSAGEM =
	"server action sem guarda: chame requireCurrentClient() no topo ou limite por IP com um limiter de lib/rate-limit.ts (CLAUDE.md, seção Server actions)";

interface ServerAction {
	body: ts.Node;
	id: string;
	imports: Map<string, string>;
}

function listSourceFiles(dir: string): string[] {
	const files: string[] = [];

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...listSourceFiles(path));
		} else if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
			files.push(path);
		}
	}

	return files;
}

function parse(file: string, text: string): ts.SourceFile {
	return ts.createSourceFile(
		file,
		text,
		ts.ScriptTarget.Latest,
		true,
		file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	);
}

function isUseServer(source: ts.SourceFile): boolean {
	const first = source.statements[0];

	return (
		first !== undefined &&
		ts.isExpressionStatement(first) &&
		ts.isStringLiteral(first.expression) &&
		first.expression.text === "use server"
	);
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
	return (
		ts.canHaveModifiers(node) &&
		(ts.getModifiers(node) ?? []).some((m) => m.kind === kind)
	);
}

function importedNames(source: ts.SourceFile): Map<string, string> {
	const names = new Map<string, string>();

	for (const statement of source.statements) {
		if (
			!(
				ts.isImportDeclaration(statement) &&
				ts.isStringLiteral(statement.moduleSpecifier)
			)
		) {
			continue;
		}

		const bindings = statement.importClause?.namedBindings;

		if (bindings && ts.isNamedImports(bindings)) {
			for (const element of bindings.elements) {
				names.set(element.name.text, statement.moduleSpecifier.text);
			}
		}
	}

	return names;
}

function asyncFunctionOf(
	initializer: ts.Expression | undefined
): ts.ArrowFunction | ts.FunctionExpression | undefined {
	if (
		initializer &&
		(ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) &&
		hasModifier(initializer, ts.SyntaxKind.AsyncKeyword)
	) {
		return initializer;
	}

	return;
}

function serverActions(source: ts.SourceFile): ServerAction[] {
	const file = source.fileName;
	const imports = importedNames(source);
	const actions: ServerAction[] = [];

	for (const statement of source.statements) {
		if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
			continue;
		}

		if (
			ts.isFunctionDeclaration(statement) &&
			statement.name &&
			statement.body &&
			hasModifier(statement, ts.SyntaxKind.AsyncKeyword)
		) {
			actions.push({
				id: `${file}:${statement.name.text}`,
				body: statement.body,
				imports,
			});
		}

		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				const fn = asyncFunctionOf(declaration.initializer);

				if (fn && ts.isIdentifier(declaration.name)) {
					actions.push({
						id: `${file}:${declaration.name.text}`,
						body: fn.body,
						imports,
					});
				}
			}
		}
	}

	return actions;
}

function isGuardCall(
	node: ts.CallExpression,
	imports: Map<string, string>
): boolean {
	const callee = node.expression;

	if (ts.isIdentifier(callee)) {
		return callee.text === GUARD && imports.get(GUARD) === SESSION_MODULE;
	}

	return (
		ts.isPropertyAccessExpression(callee) &&
		callee.name.text === "limit" &&
		ts.isIdentifier(callee.expression) &&
		callee.expression.text.endsWith(LIMITER_SUFFIX) &&
		imports.get(callee.expression.text) === RATE_LIMIT_MODULE
	);
}

function containsGuard(node: ts.Node, imports: Map<string, string>): boolean {
	if (ts.isCallExpression(node) && isGuardCall(node, imports)) {
		return true;
	}

	return (
		ts.forEachChild(node, (child) => containsGuard(child, imports)) ?? false
	);
}

function unguarded(sources: ts.SourceFile[]): string[] {
	return sources
		.flatMap(serverActions)
		.flatMap((a) => (containsGuard(a.body, a.imports) ? [] : [a.id]));
}

const useServerFiles = listSourceFiles(SRC)
	.map((path) => parse(relative(SRC, path), readFileSync(path, "utf8")))
	.filter(isUseServer);

const QUICK_VIEW_SEM_LIMITER = `"use server";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/client-ip";
import { quickViewLimiter } from "@/lib/rate-limit";

export async function quickViewAction(slug: string) {
	const ip = getClientIp(await headers());
	return { ok: true, slug, ip };
}
`;

describe("guarda das server actions (#284)", () => {
	it("acha os arquivos 'use server' de apps/web/src", () => {
		expect(useServerFiles.length).toBeGreaterThanOrEqual(12);
		expect(useServerFiles.flatMap(serverActions).map((a) => a.id)).toContain(
			"lib/actions/quick-view.ts:quickViewAction"
		);
	});

	it("todo export async chama requireCurrentClient() ou um limiter", () => {
		expect(unguarded(useServerFiles), MENSAGEM).toEqual([]);
	});

	it("acusa a action pública que perdeu a chamada do limiter", () => {
		const source = parse("lib/actions/quick-view.ts", QUICK_VIEW_SEM_LIMITER);

		expect(unguarded([source])).toEqual([
			"lib/actions/quick-view.ts:quickViewAction",
		]);
	});

	it("aceita o limiter de lib/rate-limit e recusa um limiter local", () => {
		const comLimiter = QUICK_VIEW_SEM_LIMITER.replace(
			"const ip",
			"await quickViewLimiter.limit(slug);\n\tconst ip"
		);

		const limiterLocal = comLimiter.replace(
			'import { quickViewLimiter } from "@/lib/rate-limit";',
			"const quickViewLimiter = { limit: async (_: string) => true };"
		);

		expect(unguarded([parse("a.ts", comLimiter)])).toEqual([]);
		expect(unguarded([parse("b.ts", limiterLocal)])).toEqual([
			"b.ts:quickViewAction",
		]);
	});
});
