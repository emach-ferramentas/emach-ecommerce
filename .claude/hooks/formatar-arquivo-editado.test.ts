import { afterEach, expect, test } from "bun:test";
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
import { join, resolve } from "node:path";

const raiz = resolve(import.meta.dir, "../..");
const settings = JSON.parse(
	readFileSync(join(raiz, ".claude/settings.json"), "utf8")
);
const [editarArquivo] = settings.hooks.PostToolUse;
const [hook] = editarArquivo.hooks;

const MAL_FORMATADO = "export const sonda = {a:1}\n";
const FORMATADO = "export const sonda = { a: 1 };\n";
const LIMITE_SEM_BIOME_MS = 1000;
const TIMEOUT_TESTE_MS = 180_000;

const limpezas: (() => void)[] = [];

afterEach(() => {
	for (const limpar of limpezas.splice(0).reverse()) {
		limpar();
	}
});

const criarSonda = (caminho: string) => {
	writeFileSync(caminho, MAL_FORMATADO);
	limpezas.push(() => rmSync(caminho, { force: true }));
	return caminho;
};

const criarPasta = (caminho: string) => {
	if (!existsSync(caminho)) {
		mkdirSync(caminho, { recursive: true });
		limpezas.push(() => rmSync(caminho, { force: true, recursive: true }));
	}
	return caminho;
};

const rodarHook = (arquivo: string, cwd = raiz) => {
	const evento = {
		hook_event_name: "PostToolUse",
		tool_input: { file_path: arquivo },
		tool_name: "Edit",
	};
	const inicio = performance.now();
	const processo = spawnSync("bash", ["-c", hook.command], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, CLAUDE_PROJECT_DIR: raiz },
		input: JSON.stringify(evento),
	});
	return {
		codigo: processo.status,
		ms: performance.now() - inicio,
		saida: `${processo.stdout}${processo.stderr}`,
	};
};

const conteudo = (caminho: string) => readFileSync(caminho, "utf8");

test("o hook declara timeout em segundos", () => {
	expect(typeof hook.timeout).toBe("number");
});

test(
	"edição em Markdown não roda o Biome nem toca outro arquivo",
	() => {
		const sonda = criarSonda(join(raiz, "apps/web/src/app/sonda-hook.ts"));

		const resultado = rodarHook(join(raiz, "README.md"));

		expect(resultado).toMatchObject({ codigo: 0, saida: "" });
		expect(resultado.ms).toBeLessThan(LIMITE_SEM_BIOME_MS);
		expect(conteudo(sonda)).toBe(MAL_FORMATADO);
	},
	TIMEOUT_TESTE_MS
);

test(
	"formata só o arquivo do evento, mesmo com espaço e parênteses no caminho",
	() => {
		const alvo = criarSonda(
			join(raiz, "apps/web/src/app/(auth)/sonda hook.tsx")
		);
		const vizinha = criarSonda(join(raiz, "apps/web/src/app/sonda-hook.ts"));

		const resultado = rodarHook(alvo);

		expect(resultado.saida).toContain("Checked 1 file");
		expect(resultado.saida).toContain("useFilenamingConvention");
		expect(resultado.codigo).toBe(1);
		expect(conteudo(alvo)).toBe(FORMATADO);
		expect(conteudo(vizinha)).toBe(MAL_FORMATADO);
	},
	TIMEOUT_TESTE_MS
);

test(
	"sessão aberta numa subpasta formata o arquivo pela raiz do projeto",
	() => {
		const sonda = criarSonda(join(raiz, "apps/web/src/app/sonda-hook.ts"));

		const resultado = rodarHook(sonda, join(raiz, "apps/web"));

		expect(resultado.codigo).toBe(0);
		expect(conteudo(sonda)).toBe(FORMATADO);
	},
	TIMEOUT_TESTE_MS
);

test(
	"arquivo fora do repo sai com 0 sem rodar o Biome",
	() => {
		const pasta = mkdtempSync(join(tmpdir(), "hook-formatacao-"));
		limpezas.push(() => rmSync(pasta, { force: true, recursive: true }));
		const sonda = criarSonda(join(pasta, "fora.ts"));

		const resultado = rodarHook(sonda);

		expect(resultado).toMatchObject({ codigo: 0, saida: "" });
		expect(resultado.ms).toBeLessThan(LIMITE_SEM_BIOME_MS);
		expect(conteudo(sonda)).toBe(MAL_FORMATADO);
	},
	TIMEOUT_TESTE_MS
);

test(
	"arquivo apagado sai com 0 sem rodar o Biome",
	() => {
		const resultado = rodarHook(join(raiz, "apps/web/src/app/nao-existe.ts"));

		expect(resultado).toMatchObject({ codigo: 0, saida: "" });
		expect(resultado.ms).toBeLessThan(LIMITE_SEM_BIOME_MS);
	},
	TIMEOUT_TESTE_MS
);

test(
	"arquivo ignorado pelo git não é tocado pelo Biome",
	() => {
		const sonda = criarSonda(
			join(criarPasta(join(raiz, "build")), "sonda-hook.ts")
		);

		const resultado = rodarHook(sonda);

		expect(resultado.saida).toContain("Checked 0 files");
		expect(conteudo(sonda)).toBe(MAL_FORMATADO);
	},
	TIMEOUT_TESTE_MS
);
