import { describe, expect, it } from "vitest";
import { navShortLabel } from "./nav-label";

describe("navShortLabel", () => {
	it("tira o prefixo Ferramentas e capitaliza o resto", () => {
		expect(navShortLabel("Ferramentas à bateria")).toBe("À bateria");
		expect(navShortLabel("Ferramentas Elétricas")).toBe("Elétricas");
	});

	it("mantém nomes sem o prefixo", () => {
		expect(navShortLabel("Acessórios")).toBe("Acessórios");
	});

	it("não esvazia o nome quando ele é só o prefixo", () => {
		expect(navShortLabel("Ferramentas")).toBe("Ferramentas");
	});
});
