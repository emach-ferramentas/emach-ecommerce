import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const script = resolve(import.meta.dir, "dummy-env.ts");
const LINHA_ENV = /^[A-Z_]+=\S+$/;

function rodar(env: Record<string, string>) {
	const { status, stdout } = spawnSync("bun", [script], {
		encoding: "utf8",
		env: { PATH: process.env.PATH ?? "", ...env },
	});

	expect(status).toBe(0);

	return stdout.trim().split("\n");
}

test("sem env, imprime CHAVE=valor que o $GITHUB_ENV aceita", () => {
	const linhas = rodar({});

	expect(linhas).toContain("FRENET_SELLER_CEP=12345678");
	expect(linhas.filter((l) => !LINHA_ENV.test(l))).toEqual([]);
});

test("não sobrescreve a env que o job já define", () => {
	const linhas = rodar({ DATABASE_URL: "postgres://ci" });

	expect(linhas).toContain("FRENET_SELLER_CEP=12345678");
	expect(linhas.some((l) => l.startsWith("DATABASE_URL="))).toBe(false);
});
