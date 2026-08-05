import { describe, expect, it } from "vitest";

import { toDescriptionParagraphs } from "./description-paragraphs";

const texts = (input: string | null | undefined) =>
	toDescriptionParagraphs(input).map((p) => p.text);

describe("toDescriptionParagraphs", () => {
	it("descrição ausente ou vazia: nenhum parágrafo", () => {
		expect(toDescriptionParagraphs(null)).toEqual([]);
		expect(toDescriptionParagraphs(undefined)).toEqual([]);
		expect(toDescriptionParagraphs("")).toEqual([]);
		expect(toDescriptionParagraphs("   \n\n  ")).toEqual([]);
	});

	it("texto sem quebra nenhuma continua sendo um parágrafo só", () => {
		expect(texts("Furadeira de impacto 650 W.")).toEqual([
			"Furadeira de impacto 650 W.",
		]);
	});

	it("linha em branco separa parágrafo", () => {
		expect(texts("Primeiro.\n\nSegundo.\n\nTerceiro.")).toEqual([
			"Primeiro.",
			"Segundo.",
			"Terceiro.",
		]);
	});

	it("quebra simples vira espaço (não cria parágrafo)", () => {
		expect(texts("Motor de 1100 W\ncom 6 níveis.")).toEqual([
			"Motor de 1100 W com 6 níveis.",
		]);
	});

	it("linhas em branco extras e espaços não geram parágrafo vazio", () => {
		expect(texts("Um.\n\n\n\n   \n\nDois.")).toEqual(["Um.", "Dois."]);
	});

	it("normaliza CRLF do texto colado do fornecedor", () => {
		expect(texts("Um.\r\n\r\nDois.")).toEqual(["Um.", "Dois."]);
	});

	it("preserva o texto cru: não interpreta bullet, título nem seção", () => {
		const blob = [
			"Diferenciais:",
			"- Motor de alta potência de 1100W.",
			">>> Especificações Técnicas",
			"- Tensão: 127V ou 220V",
		].join("\n\n");

		expect(texts(blob)).toEqual([
			"Diferenciais:",
			"- Motor de alta potência de 1100W.",
			">>> Especificações Técnicas",
			"- Tensão: 127V ou 220V",
		]);
	});

	it("chave é posicional e estável para o mesmo texto", () => {
		expect(toDescriptionParagraphs("Um.\n\nDois.")).toEqual([
			{ key: "p0", text: "Um.", tight: false },
			{ key: "p1", text: "Dois.", tight: false },
		]);
	});

	describe("tight (só espaçamento, nunca muda o texto)", () => {
		const tights = (input: string) =>
			toDescriptionParagraphs(input).map((p) => p.tight);

		it("item de lista depois de outro item fica colado", () => {
			expect(tights("- Um\n\n- Dois\n\n- Três")).toEqual([false, true, true]);
		});

		it("o primeiro item depois de prosa mantém o respiro", () => {
			expect(tights("Diferenciais:\n\n- Um\n\n- Dois")).toEqual([
				false,
				false,
				true,
			]);
		});

		it("prosa depois de lista volta ao espaçamento normal", () => {
			expect(tights("- Um\n\n- Dois\n\nIdeal para profissionais.")).toEqual([
				false,
				true,
				false,
			]);
		});

		it("aceita hífen, travessão, bullet e asterisco", () => {
			expect(tights("- Um\n\n– Dois\n\n• Três\n\n* Quatro")).toEqual([
				false,
				true,
				true,
				true,
			]);
		});

		it("aceita lista numerada do conteúdo da embalagem", () => {
			expect(
				tights("01 Desempenadeira\n\n01 Disco de Lixa\n\n01 Disco Estriado")
			).toEqual([false, true, true]);
		});

		it("aceita numeração com ponto ou parêntese", () => {
			expect(tights("1. Manual\n\n2) Chave\n\n3 Maleta")).toEqual([
				false,
				true,
				true,
			]);
		});

		it("mistura bullet e número continua colando", () => {
			expect(tights("- Disco de lixa\n\n01 Manual")).toEqual([false, true]);
		});

		it("marca sem espaço depois não é item (faixa, potência, temperatura)", () => {
			expect(tights("-40 °C\n\n-20 °C")).toEqual([false, false]);
			expect(tights("1100W de potência\n\n2200W de pico")).toEqual([
				false,
				false,
			]);
		});

		it("marca de lista não é removida do texto", () => {
			expect(texts("- Motor de 1100W")).toEqual(["- Motor de 1100W"]);
		});
	});
});
