/**
 * Chips de especificação dos cards. Módulo server-only: importa `db`.
 *
 * `ToolListItem` (dashboard-owned) não traz atributos; esta leitura própria da
 * loja busca, num SELECT só, os atributos dos produtos da tela.
 */
import { db } from "@emach/db";
import {
	attributeDefinition,
	toolAttributeAssignment,
	toolAttributeValue,
} from "@emach/db/schema/attributes";
import { and, asc, eq, inArray } from "drizzle-orm";

import { type FormattableAttribute, specChips } from "@/lib/attribute-format";

export const CARD_SPEC_LIMIT = 3;

export async function getCardSpecsByTool(
	toolIds: string[]
): Promise<Map<string, string[]>> {
	const byTool = new Map<string, FormattableAttribute[]>();
	if (toolIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			inputType: attributeDefinition.inputType,
			options: attributeDefinition.options,
			toolId: toolAttributeAssignment.toolId,
			unit: attributeDefinition.unit,
			valueBool: toolAttributeValue.valueBool,
			valueNumeric: toolAttributeValue.valueNumeric,
			valueNumericMax: toolAttributeValue.valueNumericMax,
			valueText: toolAttributeValue.valueText,
		})
		.from(toolAttributeAssignment)
		.innerJoin(
			attributeDefinition,
			eq(attributeDefinition.id, toolAttributeAssignment.attributeId)
		)
		.innerJoin(
			toolAttributeValue,
			and(
				eq(toolAttributeValue.toolId, toolAttributeAssignment.toolId),
				eq(toolAttributeValue.attributeId, toolAttributeAssignment.attributeId)
			)
		)
		.where(inArray(toolAttributeAssignment.toolId, toolIds))
		.orderBy(
			asc(toolAttributeAssignment.toolId),
			asc(toolAttributeAssignment.sortOrder)
		);

	for (const row of rows) {
		const list = byTool.get(row.toolId) ?? [];
		list.push({
			definition: {
				inputType: row.inputType,
				options: row.options,
				unit: row.unit,
			},
			value: {
				valueBool: row.valueBool,
				valueNumeric: row.valueNumeric,
				valueNumericMax: row.valueNumericMax,
				valueText: row.valueText,
			},
		});
		byTool.set(row.toolId, list);
	}

	const chips = new Map<string, string[]>();
	for (const [toolId, attributes] of byTool) {
		chips.set(toolId, specChips(attributes, CARD_SPEC_LIMIT));
	}
	return chips;
}
