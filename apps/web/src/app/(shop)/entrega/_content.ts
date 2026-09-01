import type { InstitutionalSection } from "@/components/institutional-page";

export const DELIVERY_UPDATED_AT = "2026-09-01";

export const DELIVERY_LEDE =
	"Como o frete é calculado, o que acontece com item grande demais para a caixa, e onde comprar sem pagar envio.";

export const deliverySections: InstitutionalSection[] = [
	{
		id: "como-calculamos",
		title: "Como o frete é calculado",
		paragraphs: [
			"O valor e o prazo vêm de uma cotação em tempo real com as transportadoras, feita pela Frenet a partir do seu CEP. Você vê as opções no checkout, depois de informar o CEP, com preço e prazo de cada transportadora, e escolhe a que preferir.",
			"Antes de cotar, agrupamos os itens do pedido em caixas reais, com o peso e as medidas de cada ferramenta. É por isso que duas furadeiras às vezes custam quase o mesmo frete que uma: cabem na mesma caixa.",
			"O prazo mostrado é o da transportadora e começa a contar depois que o pedido sai da filial. A gente não inventa prazo próprio: o que aparece na cotação é o que vale.",
		],
	},
	{
		id: "frete-a-combinar",
		title: "Frete a combinar",
		paragraphs: [
			'Alguns itens grandes demais não cabem em nenhuma caixa padrão. Nesses casos o checkout mostra "Frete a combinar" em vez de um valor e a compra não fecha ali: fale com a filial para combinar o envio.',
			"O mesmo acontece se a cotação ficar fora do ar no momento da compra: o pedido não trava. Ele é criado normalmente e a equipe confere o frete antes de faturar.",
		],
	},
	{
		id: "comprar-na-filial",
		title: "Comprar na filial",
		paragraphs: [
			"Quem está perto de uma filial pode comprar no balcão, sem frete. Lá você vê a ferramenta, testa e tira dúvida com quem entende. Os endereços e horários estão logo abaixo.",
		],
	},
	{
		id: "acompanhamento",
		title: "Acompanhar o pedido",
		paragraphs: [
			"Cada mudança de status aparece na sua conta, em Meus pedidos. Quando o pedido sai da filial, o código de rastreio da transportadora fica no detalhe do pedido.",
		],
	},
	{
		id: "duvidas",
		title: "Ficou dúvida?",
		paragraphs: [
			"Fale com qualquer filial. Os telefones e horários estão na página Sobre.",
		],
	},
];
