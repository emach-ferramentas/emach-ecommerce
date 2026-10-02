/** Dados extras dos cards de produto. Módulo server-only: importa `db`. */
import type { Voltage } from "@emach/db/schema/tools";

import { getCardSpecsByTool } from "@/lib/card-specs";
import { getVoltagesByTool } from "@/lib/variant-voltages";

export interface CardExtras {
	specs: string[];
	/** Voltagens vendáveis; duas ou mais pedem escolha antes de adicionar. */
	voltages: Voltage[];
}

/** Objeto simples (serializável no `use cache` e na fronteira server/client). */
export type CardExtrasByTool = Record<string, CardExtras>;

export async function getCardExtras(
	toolIds: string[]
): Promise<CardExtrasByTool> {
	const ids = [...new Set(toolIds)];
	const [voltages, specs] = await Promise.all([
		getVoltagesByTool(ids),
		getCardSpecsByTool(ids),
	]);
	const extras: CardExtrasByTool = {};
	for (const id of ids) {
		extras[id] = {
			specs: specs.get(id) ?? [],
			voltages: voltages.get(id) ?? [],
		};
	}
	return extras;
}
