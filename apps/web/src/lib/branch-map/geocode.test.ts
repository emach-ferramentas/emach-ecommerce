import { describe, expect, it } from "vitest";
import { cityToXY } from "./geocode";

describe("cityToXY", () => {
	it("acha cidade conhecida e retorna [x,y] no viewBox", () => {
		const xy = cityToXY("São Paulo", "SP");
		if (!xy) {
			throw new Error("esperava coordenadas para cidade conhecida");
		}
		const [x, y] = xy;
		expect(x).toBeGreaterThan(0);
		expect(x).toBeLessThan(560);
		expect(y).toBeGreaterThan(0);
		expect(y).toBeLessThan(580);
	});

	it("normaliza acento e caixa", () => {
		expect(cityToXY("sao paulo", "sp")).toEqual(cityToXY("São Paulo", "SP"));
	});

	it("cai no centroide da UF quando a cidade não existe na base", () => {
		const fallback = cityToXY("Cidade Inexistente", "BA");
		expect(fallback).not.toBeNull();
		expect(fallback).toEqual(cityToXY("__qualquer__", "BA"));
	});

	it("retorna null para UF inválida sem fallback", () => {
		expect(cityToXY("Qualquer", "ZZ")).toBeNull();
	});
});
