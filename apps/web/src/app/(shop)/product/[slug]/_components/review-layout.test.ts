import { describe, expect, it } from "vitest";

import { lastRowStart, reviewLayoutMode, stretchLast } from "./review-layout";

describe("reviewLayoutMode", () => {
	it("n=1 vira depoimento único", () => {
		expect(reviewLayoutMode(1)).toBe("single");
	});

	it("n=2 e n=3 viram depoimentos lado a lado", () => {
		expect(reviewLayoutMode(2)).toBe("duo");
		expect(reviewLayoutMode(3)).toBe("duo");
	});

	it("n>=4 vira grid com resumo completo", () => {
		expect(reviewLayoutMode(4)).toBe("grid");
		expect(reviewLayoutMode(27)).toBe("grid");
	});
});

describe("lastRowStart", () => {
	it("count par: última linha completa começa em count-2", () => {
		expect(lastRowStart(4)).toBe(2);
		expect(lastRowStart(10)).toBe(8);
	});

	it("count ímpar: a sobra esticada é a última linha", () => {
		expect(lastRowStart(1)).toBe(0);
		expect(lastRowStart(5)).toBe(4);
	});
});

describe("stretchLast", () => {
	it("sobra ímpar estica full-width", () => {
		expect(stretchLast(3)).toBe(true);
		expect(stretchLast(5)).toBe(true);
	});

	it("count par não estica", () => {
		expect(stretchLast(2)).toBe(false);
		expect(stretchLast(4)).toBe(false);
	});
});
