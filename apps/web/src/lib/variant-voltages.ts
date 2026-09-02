import { db } from "@emach/db";
import type { Voltage } from "@emach/db/schema/tools";
import { toolVariant } from "@emach/db/schema/tools";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

// Ordem de exibição dos chips de voltagem (numéricas primeiro, Bivolt por último).
const VOLTAGE_ORDER: Voltage[] = ["127V", "220V", "380V", "Bivolt"];

/**
 * Voltagens das variantes por produto, para os selos do ProductCard.
 *
 * Leitura própria do storefront: o `ToolListItem` (catalog.ts, owned-by-dashboard)
 * só traz a voltagem da variante default + `hasOtherVariants`. Para listar TODAS
 * as voltagens sem editar a query dashboard-owned, agregamos aqui.
 *
 * Filtra `visibleOnSite = true` e `priceAmount IS NOT NULL` para não exibir
 * voltagens de variantes que a PDP não vende (hidden ou rascunho sem preço =
 * bloqueia compra, então o selo do card não pode anunciá-la).
 */
export async function getVoltagesByTool(
	toolIds: string[]
): Promise<Map<string, Voltage[]>> {
	const map = new Map<string, Voltage[]>();
	if (toolIds.length === 0) {
		return map;
	}

	const rows = await db
		.select({ toolId: toolVariant.toolId, voltage: toolVariant.voltage })
		.from(toolVariant)
		.where(
			and(
				inArray(toolVariant.toolId, toolIds),
				isNotNull(toolVariant.voltage),
				isNotNull(toolVariant.priceAmount),
				eq(toolVariant.visibleOnSite, true)
			)
		);

	for (const row of rows) {
		if (!row.voltage) {
			continue;
		}
		const current = map.get(row.toolId) ?? [];
		if (!current.includes(row.voltage)) {
			current.push(row.voltage);
		}
		map.set(row.toolId, current);
	}

	for (const list of map.values()) {
		list.sort((a, b) => VOLTAGE_ORDER.indexOf(a) - VOLTAGE_ORDER.indexOf(b));
	}

	return map;
}
