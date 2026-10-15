import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { YAML } from "bun";
import { z } from "zod";

const pastaWorkflows = resolve(import.meta.dir, "../.github/workflows");
const GUARDA = "github.repository == 'othavi0/emach-ecommerce'";
const EXTENSAO_YAML = /\.ya?ml$/;

const workflowSchema = z.object({
	jobs: z.record(z.string(), z.object({ if: z.string().optional() })),
});

function fechaNoFim(expressao: string): boolean {
	if (!expressao.startsWith("(")) {
		return false;
	}

	let nivel = 0;

	for (const [i, caractere] of [...expressao].entries()) {
		if (caractere === "(") {
			nivel++;
		}

		if (caractere === ")") {
			nivel--;
		}

		if (nivel === 0) {
			return i === expressao.length - 1;
		}
	}

	return false;
}

// O espelho de deploy recebe estes arquivos e tem Actions ligado. A guarda
// precisa valer para a condição inteira: o resto, se houver, vem entre parênteses.
function guardado(condicao: string | undefined): boolean {
	if (condicao === undefined) {
		return false;
	}

	const c = condicao.trim();
	const prefixo = `${GUARDA} && `;

	if (c === GUARDA) {
		return true;
	}

	return c.startsWith(prefixo) && fechaNoFim(c.slice(prefixo.length));
}

test("a guarda de repositório cobre a condição inteira do job", () => {
	expect(guardado(GUARDA)).toBe(true);
	expect(guardado(`${GUARDA} && (a || b)`)).toBe(true);
	expect(guardado(`${GUARDA} && ((a && b) || c)`)).toBe(true);
	expect(guardado(`${GUARDA} && (a) || (b)`)).toBe(false);
	expect(guardado(`a || ${GUARDA}`)).toBe(false);
	expect(guardado(`${GUARDA} && a || b`)).toBe(false);
	expect(guardado(undefined)).toBe(false);
});

test("todo job de .github/workflows só roda no repo canônico", () => {
	const jobs = readdirSync(pastaWorkflows)
		.filter((arquivo) => EXTENSAO_YAML.test(arquivo))
		.flatMap((arquivo) => {
			const { jobs: porId } = workflowSchema.parse(
				YAML.parse(readFileSync(resolve(pastaWorkflows, arquivo), "utf8"))
			);

			return Object.entries(porId).map(([id, job]) => ({
				job: `${arquivo}: ${id}`,
				guardado: guardado(job.if),
			}));
		});

	expect(jobs.length).toBeGreaterThan(0);
	expect(jobs.filter((j) => !j.guardado).map((j) => j.job)).toEqual([]);
});
