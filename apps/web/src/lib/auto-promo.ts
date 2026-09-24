import type { db } from "@emach/db";
import { promotion, promotionTool } from "@emach/db/schema/promotions";
import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

export interface AutoPromo {
	discountType: string;
	discountValue: string;
}

/**
 * Para cada tool, as promoções automáticas ativas/vigentes que a cobrem
 * (global via `applies_to_all` OU específica via `promotion_tool`).
 * Fonte única ecommerce-side da regra de elegibilidade. O SQL `LATERAL` em
 * packages/db/src/queries/tools.ts aplica a MESMA regra na vitrine/PDP, mas
 * é owned-by-dashboard (nasce lá, chega via sync — ADR-0009); não unificar aqui.
 *
 * Módulo server-only: importa `db`/drizzle. NÃO importar em Client Components.
 */
export async function fetchAutoPromosByToolId(
	tx: typeof db,
	toolIds: string[],
	now: Date
): Promise<Map<string, AutoPromo[]>> {
	const [globalRows, specificRows] = await Promise.all([
		tx
			.select({
				discountType: promotion.discountType,
				discountValue: promotion.discountValue,
			})
			.from(promotion)
			.where(
				and(
					eq(promotion.active, true),
					eq(promotion.type, "promotion"),
					eq(promotion.appliesToAll, true),
					or(isNull(promotion.startsAt), lte(promotion.startsAt, now)),
					or(isNull(promotion.endsAt), gt(promotion.endsAt, now))
				)
			),
		tx
			.select({
				toolId: promotionTool.toolId,
				discountType: promotion.discountType,
				discountValue: promotion.discountValue,
			})
			.from(promotion)
			.innerJoin(promotionTool, eq(promotionTool.promotionId, promotion.id))
			.where(
				and(
					eq(promotion.active, true),
					eq(promotion.type, "promotion"),
					inArray(promotionTool.toolId, toolIds),
					or(isNull(promotion.startsAt), lte(promotion.startsAt, now)),
					or(isNull(promotion.endsAt), gt(promotion.endsAt, now))
				)
			),
	]);

	const map = new Map<string, AutoPromo[]>();
	for (const toolId of toolIds) {
		map.set(
			toolId,
			globalRows.map((r) => ({
				discountType: r.discountType,
				discountValue: r.discountValue,
			}))
		);
	}
	for (const row of specificRows) {
		map.get(row.toolId)?.push({
			discountType: row.discountType,
			discountValue: row.discountValue,
		});
	}
	return map;
}

/** Set de toolIds com auto-promo vigente (preserva a semântica de exclusão do cupom). */
export function autoPromoToolIdsFromMap(
	map: Map<string, AutoPromo[]>
): Set<string> {
	const set = new Set<string>();
	for (const [toolId, promos] of map) {
		if (promos.length > 0) {
			set.add(toolId);
		}
	}
	return set;
}
