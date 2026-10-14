import { toolImage } from "@emach/db/schema/tools";
import { asc, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Mapa `toolId` → URL da imagem primária (a de menor `sortOrder`).
 *
 * Fonte única ecommerce-side da regra "primária = menor sortOrder", usada nos
 * previews de pedido, devolução e recompra. Ver `docs/contexts/catalog/CONTEXT.md`
 * ("Primary image"). É read-only do Catalog (dashboard-owned).
 *
 * Recebe o handle do banco (`db` em produção, `tx` nos testes de integração via
 * `withRollback`) — mesma assinatura parametrizada dos demais query modules
 * (`NodePgDatabase<Record<string, unknown>>`, ver `packages/db/CLAUDE.md`).
 */
export async function primaryImageByToolId(
	database: NodePgDatabase<Record<string, unknown>>,
	toolIds: string[]
): Promise<Map<string, string>> {
	if (toolIds.length === 0) {
		return new Map();
	}

	const rows = await database
		.select({ toolId: toolImage.toolId, url: toolImage.url })
		.from(toolImage)
		.where(inArray(toolImage.toolId, toolIds))
		// `asc(toolId)` casa com o índice `tool_image_tool_sort_idx`
		// `(toolId, sortOrder)`: a ordenação sai do índice sem um sort extra.
		// O first-wins abaixo só depende de `asc(sortOrder)`, mas dropar o
		// `asc(toolId)` impediria o índice de servir o ORDER BY (forçaria sort).
		.orderBy(asc(toolImage.toolId), asc(toolImage.sortOrder));

	const map = new Map<string, string>();

	for (const r of rows) {
		if (!map.has(r.toolId)) {
			map.set(r.toolId, r.url); // primeira = menor sortOrder
		}
	}

	return map;
}
