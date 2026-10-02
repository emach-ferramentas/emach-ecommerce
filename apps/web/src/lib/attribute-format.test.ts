import { describe, expect, it } from "vitest";
import { type FormattableAttribute, specChips } from "./attribute-format";

function attr(
	inputType: FormattableAttribute["definition"]["inputType"],
	value: Partial<FormattableAttribute["value"]>,
	unit: string | null = null,
	options: FormattableAttribute["definition"]["options"] = null
): FormattableAttribute {
	return {
		definition: { inputType, options, unit },
		value: {
			valueBool: null,
			valueNumeric: null,
			valueNumericMax: null,
			valueText: null,
			...value,
		},
	};
}

describe("specChips", () => {
	it("mostra o rótulo da opção, não a chave guardada", () => {
		const material = attr("select", { valueText: "metal_duro" }, null, {
			kind: "select",
			options: [{ label: "Metal duro", value: "metal_duro" }],
		});
		expect(specChips([material], 3)).toEqual(["Metal duro"]);
	});

	it("pula Sim/Não e número sem unidade, respeita o limite", () => {
		const chips = specChips(
			[
				attr("boolean", { valueBool: true }),
				attr("number", { valueNumeric: "2" }),
				attr("number", { valueNumeric: "1200" }, "W"),
				attr(
					"numeric_range",
					{ valueNumeric: "0", valueNumericMax: "800" },
					"RPM"
				),
				attr("text", { valueText: "Brushless" }),
			],
			2
		);
		expect(chips).toEqual(["1.200 W", "até 800 RPM"]);
	});
});
