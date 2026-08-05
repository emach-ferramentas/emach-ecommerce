// apps/web/src/app/(shop)/product/[slug]/_components/description-paragraphs.ts

/** Parágrafo da descrição. `key` é posicional porque parágrafo não tem id. */
export interface DescriptionParagraph {
	key: string;
	text: string;
	/** Colado no anterior: item de lista logo depois de outro item. */
	tight: boolean;
}

const CRLF = /\r\n?/g;
const BLANK_LINE = /\n[ \t]*\n/;
const SOFT_BREAK = /[ \t]*\n[ \t]*/g;
/**
 * Único formato reconhecido: linha aberta por bullet (`- item`) ou por número
 * (`01 Disco`, `1. Manual`, `2) Chave`) — os dois jeitos que fornecedor usa pra
 * listar. Exige espaço depois da marca, então `-40 °C` e `1100W` não entram.
 * Só afeta espaçamento; o texto nunca é alterado.
 */
const LIST_MARK = /^(?:[-–—•*]|\d{1,3}[.)]?)\s/;

/**
 * Quebra a descrição crua em parágrafos. Regra única: **linha em branco separa
 * parágrafo**; quebra simples vira espaço.
 *
 * Deliberadamente não interpreta títulos nem seções — a descrição vem do
 * dashboard (`tool.description`, ADR-0009) colada de fornecedor/marketplace e não
 * tem formato garantido entre produtos. Texto sem quebra nenhuma continua saindo
 * como um parágrafo só, igual a hoje.
 *
 * A única leitura de formato é `tight`: item de lista logo depois de outro item
 * fica colado. O texto **não** é alterado — o hífen continua onde o fornecedor
 * escreveu; o sinal serve só para o espaçamento.
 */
export function toDescriptionParagraphs(
	description: string | null | undefined
): DescriptionParagraph[] {
	if (!description) {
		return [];
	}

	const blocks = description
		.replace(CRLF, "\n")
		.split(BLANK_LINE)
		.map((block) => block.replace(SOFT_BREAK, " ").trim())
		.filter((text) => text.length > 0);

	return blocks.map((text, index) => ({
		key: `p${index}`,
		text,
		tight:
			index > 0 && LIST_MARK.test(text) && LIST_MARK.test(blocks[index - 1]),
	}));
}
