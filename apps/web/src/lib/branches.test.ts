import type { BranchBusinessHoursPeriod } from "@emach/db/schema/inventory";
import { describe, expect, it } from "vitest";
import {
	branchMapsUrl,
	formatBusinessPeriod,
	formatPhone,
	getBusinessHoursRows,
} from "./branches";

const openPeriod: BranchBusinessHoursPeriod = {
	isOpen: true,
	opensAt: "08:00",
	closesAt: "18:00",
	breakStart: null,
	breakEnd: null,
};

describe("formatBusinessPeriod", () => {
	it("renderiza dois turnos com intervalo completo", () => {
		expect(
			formatBusinessPeriod({
				...openPeriod,
				breakStart: "12:00",
				breakEnd: "13:00",
			})
		).toBe("08:00–12:00 · 13:00–18:00");
	});
	it("renderiza turno único sem intervalo", () => {
		expect(formatBusinessPeriod(openPeriod)).toBe("08:00–18:00");
	});
	it("retorna Fechado quando isOpen é false", () => {
		expect(formatBusinessPeriod({ ...openPeriod, isOpen: false })).toBe(
			"Fechado"
		);
	});
	it("retorna Fechado com horários nulos", () => {
		expect(formatBusinessPeriod({ ...openPeriod, opensAt: null })).toBe(
			"Fechado"
		);
		expect(formatBusinessPeriod({ ...openPeriod, closesAt: null })).toBe(
			"Fechado"
		);
	});
	it("retorna Fechado para período ausente", () => {
		expect(formatBusinessPeriod(undefined)).toBe("Fechado");
		expect(formatBusinessPeriod(null)).toBe("Fechado");
	});
	it.each([
		["só breakStart", "12:00", null],
		["só breakEnd", null, "13:00"],
	])("ignora intervalo parcial (%s)", (_label, breakStart, breakEnd) => {
		expect(formatBusinessPeriod({ ...openPeriod, breakStart, breakEnd })).toBe(
			"08:00–18:00"
		);
	});
});

describe("getBusinessHoursRows", () => {
	it("retorna null sem businessHours", () => {
		expect(getBusinessHoursRows(null)).toBeNull();
	});
	it("retorna as 3 linhas na ordem seg-sex, sábado, feriados", () => {
		expect(
			getBusinessHoursRows({
				weekdays: { ...openPeriod, breakStart: "12:00", breakEnd: "13:00" },
				saturday: { ...openPeriod, closesAt: "13:00" },
				holidays: { ...openPeriod, isOpen: false },
			})
		).toEqual([
			{ label: "Seg–sex", value: "08:00–12:00 · 13:00–18:00" },
			{ label: "Sábado", value: "08:00–13:00" },
			{ label: "Feriados", value: "Fechado" },
		]);
	});
});

describe("formatPhone", () => {
	it("formata celular de 11 dígitos", () => {
		expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
	});
	it("formata fixo de 10 dígitos", () => {
		expect(formatPhone("4136100000")).toBe("(41) 3610-0000");
	});
	it("retorna null sem telefone", () => {
		expect(formatPhone(null)).toBeNull();
	});
});

describe("branchMapsUrl", () => {
	it("monta url de busca do Google Maps com o endereço encodado", () => {
		const url = branchMapsUrl({
			street: "Av. Paulista",
			streetNumber: "1578",
			neighborhood: "Bela Vista",
			city: "São Paulo",
			state: "SP",
		});
		expect(url).toContain("https://www.google.com/maps/search/?api=1&query=");
		expect(url).toContain(encodeURIComponent("Av. Paulista"));
		expect(url).toContain(encodeURIComponent("São Paulo/SP"));
	});
});
