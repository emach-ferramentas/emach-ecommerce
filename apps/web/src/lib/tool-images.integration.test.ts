import { db } from "@emach/db";
import { toolImage } from "@emach/db/schema/tools";
import { describe, expect, it } from "vitest";

import type { DbTransaction } from "@/lib/db-executor";
import { seedTool } from "@/lib/test-helpers";

import { primaryImageByToolId } from "./tool-images";

// Integração: bate no Supabase compartilhado via withRollback. Fora do CI
// (lista INTEGRATION em vitest.config.ts); roda local com `bun run --filter=web test`.
const ROLLBACK = Symbol("rollback");

async function withRollback(
	fn: (tx: DbTransaction) => Promise<void>
): Promise<void> {
	try {
		await db.transaction(async (tx) => {
			await fn(tx);
			throw ROLLBACK;
		});
	} catch (err) {
		if (err !== ROLLBACK) {
			throw err;
		}
	}
}

async function seedImages(
	tx: DbTransaction,
	toolId: string,
	images: { sortOrder: number; url: string }[]
): Promise<void> {
	await tx.insert(toolImage).values(
		images.map((img) => ({
			id: crypto.randomUUID(),
			toolId,
			url: img.url,
			sortOrder: img.sortOrder,
		}))
	);
}

describe("primaryImageByToolId (integração)", () => {
	it("resolve a primária = menor sortOrder por tool (não a 1ª inserida, não 'sortOrder 0')", async () => {
		await withRollback(async (tx) => {
			const toolA = await seedTool(tx);
			const toolB = await seedTool(tx);
			// Seeds fora da ordem de inserção. toolA: primária = sortOrder 1 (a MENOR),
			// embora inserida depois e ≠ 0 — pega um hipotético `WHERE sortOrder = 0`
			// hardcoded. toolB: primária = sortOrder 0. Dois tools verificam resolução
			// independente por tool (sem cross-contaminação do first-wins). Uma inversão
			// asc→desc ou um last-wins (sem o guard `!map.has`) falhariam aqui.
			await seedImages(tx, toolA, [
				{ url: "https://img/a-terceira.jpg", sortOrder: 3 },
				{ url: "https://img/a-primaria.jpg", sortOrder: 1 },
			]);
			await seedImages(tx, toolB, [
				{ url: "https://img/b-primaria.jpg", sortOrder: 0 },
				{ url: "https://img/b-segunda.jpg", sortOrder: 2 },
			]);

			const map = await primaryImageByToolId(tx, [toolA, toolB]);

			expect(map.get(toolA)).toBe("https://img/a-primaria.jpg");
			expect(map.get(toolB)).toBe("https://img/b-primaria.jpg");
			expect(map.size).toBe(2);
		});
	});

	it("input vazio retorna Map vazio sem consultar", async () => {
		const map = await primaryImageByToolId(db, []);
		expect(map.size).toBe(0);
	});
});
