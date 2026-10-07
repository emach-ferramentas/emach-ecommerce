// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuyerInfo } from "./buyer-info";

const BUYER = {
	name: "Ana",
	email: "ana@example.com",
	phone: null,
};

const renderDocument = (document: string | null) =>
	renderToStaticMarkup(<BuyerInfo buyer={{ ...BUYER, document }} />);

describe("BuyerInfo", () => {
	it("mascara CPF", () => {
		expect(renderDocument("52998224725")).toContain("***.***.247-25");
	});

	it("mascara CNPJ numérico", () => {
		expect(renderDocument("11222333000181")).toContain("**.***.***/0001-81");
	});

	it("mascara CNPJ alfanumérico", () => {
		expect(renderDocument("12ABC34501DE35")).toContain("**.***.***/01DE-35");
	});
});
