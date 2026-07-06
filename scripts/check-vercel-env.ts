/**
 * Drift-check: garante que toda env var OBRIGATÓRIA declarada nos schemas
 * t3-env (`packages/env/src/schemas.ts`) existe no projeto Vercel, para o
 * `target` escolhido (default `production`). Roda ANTES do deploy — pega a
 * lacuna que, senão, só estouraria no build da Vercel (caso `NEXT_PUBLIC_SITE_URL`).
 *
 * "Obrigatória" é derivado do próprio Zod via `safeParse(undefined)` — fiel à
 * validação real do build, sem parsear texto. `.optional()`/`.default()` contam
 * como não-obrigatórias.
 *
 * Uso:
 *   bun scripts/check-vercel-env.ts [--target=production|preview|development]
 *
 * Credenciais (em ordem de precedência):
 *   - VERCEL_TOKEN        (env)            — no CI, secret do repo
 *   - ~/.local/share/com.vercel.cli/auth.json  — fallback local (CLI logada)
 *   - VERCEL_ORG_ID / VERCEL_PROJECT_ID  (env) — no CI, vars do repo
 *   - .vercel/project.json               — fallback local (após `vercel link`)
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { z } from "zod";
import { clientSchema, serverSchema } from "../packages/env/src/schemas";

const target = (process.argv
	.find((a) => a.startsWith("--target="))
	?.split("=")[1] ?? "production") as "production" | "preview" | "development";

// Opcionais no Zod (dev roda sem Redis — fallback in-memory), mas obrigatórias
// no deploy: sem elas, cache Frenet e rate-limiters degradam pra in-memory por
// instância em silêncio (warn `redis_not_configured` só aparece em runtime).
// O Zod não pode exigi-las senão dev local quebraria — o gate é só aqui.
const REQUIRED_IN_PRODUCTION = [
	"UPSTASH_REDIS_REST_URL",
	"UPSTASH_REDIS_REST_TOKEN",
];

function requiredKeys(schema: Record<string, z.ZodType>): string[] {
	// Obrigatória = o schema rejeita `undefined`. Cobre `.optional()` e
	// `.default()` (ambos aceitam undefined) sem casos especiais.
	return Object.entries(schema)
		.filter(([, s]) => !s.safeParse(undefined).success)
		.map(([key]) => key);
}

function readToken(): string {
	if (process.env.VERCEL_TOKEN) {
		return process.env.VERCEL_TOKEN;
	}
	const authPath = resolve(homedir(), ".local/share/com.vercel.cli/auth.json");
	if (existsSync(authPath)) {
		const { token } = JSON.parse(readFileSync(authPath, "utf8"));
		if (token) {
			return token;
		}
	}
	throw new Error(
		"Sem credencial Vercel. Defina VERCEL_TOKEN ou rode `vercel login`."
	);
}

function readProjectRef(): { orgId: string; projectId: string } {
	const orgId = process.env.VERCEL_ORG_ID;
	const projectId = process.env.VERCEL_PROJECT_ID;
	if (orgId && projectId) {
		return { orgId, projectId };
	}

	const linkPath = resolve(process.cwd(), ".vercel/project.json");
	if (existsSync(linkPath)) {
		const link = JSON.parse(readFileSync(linkPath, "utf8"));
		if (link.orgId && link.projectId) {
			return { orgId: link.orgId, projectId: link.projectId };
		}
	}
	throw new Error(
		"Sem ref do projeto. Defina VERCEL_ORG_ID/VERCEL_PROJECT_ID ou rode `vercel link`."
	);
}

async function fetchEnvKeys(
	token: string,
	orgId: string,
	projectId: string
): Promise<Set<string>> {
	const url = `https://api.vercel.com/v9/projects/${projectId}/env?teamId=${orgId}`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) {
		throw new Error(`Vercel API ${res.status}: ${await res.text()}`);
	}
	const body = (await res.json()) as {
		envs: Array<{ key: string; target: string[] }>;
	};
	return new Set(
		body.envs.filter((e) => e.target.includes(target)).map((e) => e.key)
	);
}

async function main() {
	const required = [
		...requiredKeys(serverSchema),
		...requiredKeys(clientSchema),
		...(target === "production" ? REQUIRED_IN_PRODUCTION : []),
	];
	const token = readToken();
	const { orgId, projectId } = readProjectRef();
	const present = await fetchEnvKeys(token, orgId, projectId);

	const missing = required.filter((k) => !present.has(k));

	if (missing.length > 0) {
		console.error(
			`\n❌ Env vars obrigatórias AUSENTES na Vercel (target=${target}):\n` +
				missing.map((k) => `   - ${k}`).join("\n") +
				`\n\nCadastre com: vercel env add <KEY> ${target}\n`
		);
		process.exit(1);
	}

	console.log(
		`✓ ${required.length}/${required.length} env vars obrigatórias presentes na Vercel (target=${target}).`
	);
}

main().catch((err) => {
	console.error(`\n❌ check-vercel-env falhou: ${err.message}\n`);
	process.exit(1);
});
