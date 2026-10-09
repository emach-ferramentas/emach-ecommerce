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
			"O prazo mostrado é o da transportadora e começa a contar depois que o pedido sai da filial. A loja não soma prazo próprio ao da cotação.",
		],
	},
	{
		id: "frete-a-combinar",
		title: "Frete a combinar",
		paragraphs: [
			'Alguns itens grandes demais não cabem em nenhuma caixa padrão. Nesses casos o checkout mostra "Frete a combinar" em vez de um valor, e a compra não fecha pelo site. Para combinar o envio, fale com a filial.',
			"Se a cotação estiver fora do ar na hora da compra, o site cria o pedido mesmo assim e a equipe confere o frete antes de faturar.",
		],
	},
	{
		id: "comprar-na-filial",
		title: "Comprar na filial",
		paragraphs: [
			"Quem está perto de uma filial pode comprar no balcão, sem frete. Lá você vê a ferramenta, testa e tira dúvidas com a equipe. Os endereços e horários estão logo abaixo.",
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
