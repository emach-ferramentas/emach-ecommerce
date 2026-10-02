import type {
	AttributeDefinition,
	AttributeOptions,
} from "@emach/db/schema/attributes";

import { fmtSpecNumber, fmtSpecRange } from "@/lib/format";

/** Recorte de atributo que a formatação usa (definição + valor do produto). */
export interface FormattableAttribute {
	definition: {
		inputType: AttributeDefinition["inputType"];
		options: AttributeOptions | null;
		unit: string | null;
	};
	value: {
		valueBool: boolean | null;
		valueNumeric: string | null;
		valueNumericMax: string | null;
		valueText: string | null;
	};
}

export const EMPTY_ATTRIBUTE = "—";

/** Select e cor guardam a chave ("metal_duro"); a tela mostra o rótulo. */
function optionLabel(options: AttributeOptions | null, value: string): string {
	if (options?.kind === "select") {
		return options.options.find((o) => o.value === value)?.label ?? value;
	}
	if (options?.kind === "color") {
		return options.swatches.find((s) => s.value === value)?.label ?? value;
	}
	return value;
}

export function formatAttribute(item: FormattableAttribute): string {
	const { definition, value } = item;
	const unit = definition.unit ?? "";
	switch (definition.inputType) {
		case "boolean": {
			if (value.valueBool == null) {
				return EMPTY_ATTRIBUTE;
			}
			return value.valueBool ? "Sim" : "Não";
		}
		case "numeric_range":
			return fmtSpecRange(value.valueNumeric, value.valueNumericMax, unit);
		case "number":
			return fmtSpecNumber(value.valueNumeric, unit);
		case "select": {
			// Opções de select podem ter unidade ("Diâmetro do disco: 185" + mm).
			if (!value.valueText) {
				return EMPTY_ATTRIBUTE;
			}
			const label = optionLabel(definition.options, value.valueText);
			return unit ? `${label} ${unit}` : label;
		}
		case "color":
			return value.valueText
				? optionLabel(definition.options, value.valueText)
				: EMPTY_ATTRIBUTE;
		default:
			return value.valueText ?? EMPTY_ATTRIBUTE;
	}
}

/**
 * Chips curtos de especificação ("800 W", "até 800 RPM"): os primeiros
 * atributos com valor, na ordem do cadastro. Sem o rótulo ao lado, Sim/Não e
 * número sem unidade ("2") não dizem nada, então ficam de fora; texto longo
 * também.
 */
export function specChips(
	attributes: FormattableAttribute[],
	max: number
): string[] {
	const chips: string[] = [];
	for (const attribute of attributes) {
		if (chips.length >= max) {
			break;
		}
		const { inputType, unit } = attribute.definition;
		const numeric = inputType === "number" || inputType === "numeric_range";
		if (inputType === "boolean" || (numeric && !unit)) {
			continue;
		}
		const text = formatAttribute(attribute);
		if (text !== EMPTY_ATTRIBUTE && text.length <= 24) {
			chips.push(text);
		}
	}
	return chips;
}
