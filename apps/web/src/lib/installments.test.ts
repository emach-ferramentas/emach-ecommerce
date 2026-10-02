import { describe, expect, it } from "vitest";
import {
	installmentLabel,
	installmentPlan,
	installmentText,
} from "./installments";

describe("installmentPlan", () => {
	it("divide em 12x quando cada parcela fica em pelo menos R$ 10", () => {
		expect(installmentPlan(53_618)).toEqual({ count: 12, valueCents: 4468 });
		expect(installmentPlan(12_000)).toEqual({ count: 12, valueCents: 1000 });
	});

	it("reduz o número de parcelas para manter o mínimo de R$ 10", () => {
		expect(installmentPlan(5932)).toEqual({ count: 5, valueCents: 1186 });
		expect(installmentPlan(11_999)).toEqual({ count: 11, valueCents: 1091 });
	});

	it("abaixo de R$ 20 não parcela", () => {
		expect(installmentPlan(1999)).toBeNull();
		expect(installmentPlan(2000)).toEqual({ count: 2, valueCents: 1000 });
		expect(installmentPlan(0)).toBeNull();
	});
});

describe("installmentLabel e installmentText", () => {
	it("escreve 12x direto e as demais como 'em até'", () => {
		expect(installmentLabel(53_618)).toBe("12x de R$ 44,68");
		expect(installmentLabel(5932)).toBe("em até 5x de R$ 11,86");
	});

	it("cai em 'À vista' quando não parcela", () => {
		expect(installmentLabel(1440)).toBeNull();
		expect(installmentText(1440)).toBe("À vista");
		expect(installmentText(53_618)).toBe("12x de R$ 44,68 sem juros");
	});
});
