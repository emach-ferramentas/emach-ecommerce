import { describe, expect, it } from "vitest";
import { branchMapsUrl, formatPhone } from "./branches";

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
