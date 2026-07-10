import { db } from "@emach/db";
import { STOREFRONT_TOOL_STATUSES } from "@emach/db/queries/tools";
import { type SQL, sql } from "drizzle-orm";
import type { VoltageKey } from "./catalog-filters";
import { PRICE_RANGES, type PriceRangeKey } from "./price-ranges";

// Contagens por faceta do catálogo. Server-only (importado só por page.tsx).
// Os predicados replicam buildToolListWhere (packages/db/src/queries/tools.ts,
// dashboard-owned — não importável daqui): se aquele WHERE mudar, este arquivo
// precisa acompanhar. O teste de integração (consistência com getTools) acusa
// divergência.
// O EXISTS de tool_variant.is_default abaixo espelha o INNER JOIN dv (variante
// default) de getTools — sem ele, tools sem variante default seriam contadas
// aqui mas excluídas do grid.

export interface FacetCountsInput {
	categoryId?: string;
	onlyPromo: boolean;
	priceMax?: number;
	priceMin?: number;
	search?: string;
	voltages: VoltageKey[];
}

export interface FacetCounts {
	byCategory: Record<string, number>;
	byPriceRange: Record<PriceRangeKey, number>;
	byVoltage: Record<VoltageKey, number>;
	promo: number;
	total: number;
}

const STATUS_SQL = sql`t.status IN (${sql.join(
	STOREFRONT_TOOL_STATUSES.map((s) => sql`${s}`),
	sql`, `
)})`;

const PROMO_SQL = sql`EXISTS (
	SELECT 1 FROM promotion p
	WHERE p.type = 'promotion'
	  AND p.active = true
	  AND (p.starts_at IS NULL OR p.starts_at <= now())
	  AND (p.ends_at IS NULL OR p.ends_at > now())
	  AND (
	    p.applies_to_all = true
	    OR EXISTS (SELECT 1 FROM promotion_tool pt WHERE pt.promotion_id = p.id AND pt.tool_id = t.id)
	  )
)`;

interface PredicateFlags {
	withCategory: boolean;
	withPrice: boolean;
	withPromo: boolean;
	withVoltage: boolean;
}

function buildPredicates(input: FacetCountsInput, flags: PredicateFlags): SQL {
	const filters = [
		STATUS_SQL,
		sql`t.visible_on_site = true`,
		sql`EXISTS (SELECT 1 FROM tool_variant dv WHERE dv.tool_id = t.id AND dv.is_default = true)`,
	];

	if (input.search && input.search.trim() !== "") {
		const term = `%${input.search.trim()}%`;
		filters.push(sql`(t.name ILIKE ${term} OR t.model ILIKE ${term})`);
	}

	if (flags.withCategory && input.categoryId) {
		filters.push(sql`EXISTS (
			SELECT 1
			FROM tool_category tc
			JOIN category c ON c.id = tc.category_id
			JOIN category root ON root.id = ${input.categoryId}
			WHERE tc.tool_id = t.id
			  AND (c.id = root.id OR c.path LIKE root.path || '%')
		)`);
	}

	if (flags.withVoltage && input.voltages.length > 0) {
		filters.push(sql`EXISTS (
			SELECT 1 FROM tool_variant tvf
			WHERE tvf.tool_id = t.id
			  AND tvf.voltage::text IN (${sql.join(
					input.voltages.map((v) => sql`${v}`),
					sql`, `
				)})
		)`);
	}

	if (flags.withPrice && typeof input.priceMin === "number") {
		filters.push(
			sql`(SELECT MIN(price_amount) FROM tool_variant WHERE tool_id = t.id) >= ${input.priceMin}`
		);
	}
	if (flags.withPrice && typeof input.priceMax === "number") {
		filters.push(
			sql`(SELECT MIN(price_amount) FROM tool_variant WHERE tool_id = t.id) <= ${input.priceMax}`
		);
	}

	if (flags.withPromo && input.onlyPromo) {
		filters.push(PROMO_SQL);
	}

	return sql.join(filters, sql` AND `);
}

export async function getFacetCounts(
	input: FacetCountsInput
): Promise<FacetCounts> {
	// Cada faceta conta com TODOS os grupos aplicados, exceto o próprio.
	const exceptCategory = buildPredicates(input, {
		withCategory: false,
		withPrice: true,
		withPromo: true,
		withVoltage: true,
	});
	const exceptPrice = buildPredicates(input, {
		withCategory: true,
		withPrice: false,
		withPromo: true,
		withVoltage: true,
	});
	const exceptVoltage = buildPredicates(input, {
		withCategory: true,
		withPrice: true,
		withPromo: true,
		withVoltage: false,
	});
	const exceptPromo = buildPredicates(input, {
		withCategory: true,
		withPrice: true,
		withPromo: false,
		withVoltage: true,
	});

	const priceBuckets = PRICE_RANGES.map((r) => {
		const conds: SQL[] = [];
		if (r.pmin !== null) {
			conds.push(sql`s.minp >= ${r.pmin}`);
		}
		if (r.pmax !== null) {
			conds.push(sql`s.minp <= ${r.pmax}`);
		}
		return sql`COUNT(*) FILTER (WHERE ${sql.join(conds, sql` AND `)})::int AS ${sql.raw(`"${r.key}"`)}`;
	});

	const [
		categoryRes,
		activeCategoriesRes,
		priceRes,
		voltageRes,
		promoRes,
		totalRes,
	] = await Promise.all([
		db.execute<{ category_id: string; n: number | string }>(sql`
				SELECT root.id AS category_id, COUNT(DISTINCT t.id)::int AS n
				FROM category root
				JOIN category c ON (c.id = root.id OR c.path LIKE root.path || '%')
				JOIN tool_category tc ON tc.category_id = c.id
				JOIN tool t ON t.id = tc.tool_id
				WHERE root.is_active = true AND ${exceptCategory}
				GROUP BY root.id
			`),
		db.execute<{ id: string }>(sql`
				SELECT id FROM category WHERE is_active = true
			`),
		db.execute<Record<PriceRangeKey, number | string>>(sql`
				SELECT ${sql.join(priceBuckets, sql`, `)}
				FROM (
					SELECT (SELECT MIN(price_amount) FROM tool_variant WHERE tool_id = t.id) AS minp
					FROM tool t
					WHERE ${exceptPrice}
				) s
			`),
		db.execute<{ voltage: VoltageKey; n: number | string }>(sql`
				SELECT tv.voltage::text AS voltage, COUNT(DISTINCT t.id)::int AS n
				FROM tool t
				JOIN tool_variant tv ON tv.tool_id = t.id
				WHERE tv.voltage IS NOT NULL AND ${exceptVoltage}
				GROUP BY tv.voltage
			`),
		db.execute<{ n: number | string }>(sql`
				SELECT COUNT(*)::int AS n
				FROM tool t
				WHERE ${exceptPromo} AND ${PROMO_SQL}
			`),
		db.execute<{ n: number | string }>(sql`
				SELECT COUNT(*)::int AS n
				FROM tool t
				WHERE ${exceptCategory}
			`),
	]);

	const byCategory: Record<string, number> = {};
	for (const row of activeCategoriesRes.rows) {
		byCategory[row.id] = 0;
	}
	for (const row of categoryRes.rows) {
		byCategory[row.category_id] = Number(row.n) || 0;
	}

	const priceRow = priceRes.rows[0];
	const byPriceRange = Object.fromEntries(
		PRICE_RANGES.map((r) => [r.key, Number(priceRow?.[r.key]) || 0])
	) as Record<PriceRangeKey, number>;

	const byVoltage: Record<VoltageKey, number> = {
		"127V": 0,
		"220V": 0,
		Bivolt: 0,
		"380V": 0,
	};
	for (const row of voltageRes.rows) {
		byVoltage[row.voltage] = Number(row.n) || 0;
	}

	return {
		byCategory,
		byPriceRange,
		byVoltage,
		promo: Number(promoRes.rows[0]?.n) || 0,
		total: Number(totalRes.rows[0]?.n) || 0,
	};
}
