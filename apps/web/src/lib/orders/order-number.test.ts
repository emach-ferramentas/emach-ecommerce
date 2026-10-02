import { describe, expect, it } from "vitest";
import { formatOrderNumber, parseOrderNumber } from "./order-number";

describe("parseOrderNumber", () => {
	it("aceita o formato ano-sequência", () => {
		expect(parseOrderNumber("2026-000123")).toBe("2026-000123");
		expect(parseOrderNumber("2026-1234567")).toBe("2026-1234567");
	});

	it("aceita o que formatOrderNumber gera", () => {
		const number = formatOrderNumber(42);
		expect(parseOrderNumber(number)).toBe(number);
	});

	it.each([
		["ausente", undefined],
		["vazio", ""],
		["texto livre", "Seu pedido foi aprovado, ligue 0800"],
		["HTML", "<b>2026-000123</b>"],
		["número com espaço", "2026-000123 "],
		["espaço no meio", "2026 -000123"],
		["sequência curta", "2026-12345"],
		["ano curto", "26-000123"],
	])("recusa %s", (_label, raw) => {
		expect(parseOrderNumber(raw)).toBeNull();
	});
});
