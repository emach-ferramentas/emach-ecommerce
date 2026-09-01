import { describe, expect, it } from "vitest";
import { isModifiedClick } from "./is-modified-click";

const plain = {
	altKey: false,
	button: 0,
	ctrlKey: false,
	metaKey: false,
	shiftKey: false,
};

describe("isModifiedClick", () => {
	it("clique primário sem modificador é navegação normal", () => {
		expect(isModifiedClick(plain)).toBe(false);
	});
	it("cada modificador marca o clique como do browser", () => {
		expect(isModifiedClick({ ...plain, metaKey: true })).toBe(true);
		expect(isModifiedClick({ ...plain, ctrlKey: true })).toBe(true);
		expect(isModifiedClick({ ...plain, shiftKey: true })).toBe(true);
		expect(isModifiedClick({ ...plain, altKey: true })).toBe(true);
	});
	it("botão do meio (1) abre em nova aba", () => {
		expect(isModifiedClick({ ...plain, button: 1 })).toBe(true);
	});
});
