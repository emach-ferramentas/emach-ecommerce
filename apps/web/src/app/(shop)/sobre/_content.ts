// Texto da página /sobre, separado do layout para o teste de guarda
// (lib/seo/institutional-content.test.ts) ler exatamente o que vai para a tela.

export const ABOUT_DESCRIPTION =
	"Como escolhemos as ferramentas que vendemos, o atendimento antes e depois da compra e onde ficam nossas filiais.";

export const aboutPillars = [
	{
		id: "curadoria",
		label: "O que vendemos",
		title: "Só linha profissional",
		description:
			"O catálogo só tem ferramentas feitas para uso diário em obra e indústria.",
	},
	{
		id: "atendimento",
		label: "Atendimento",
		title: "Ajuda para escolher e usar",
		description:
			"A equipe das filiais indica a ferramenta para o serviço e tira dúvidas de uso.",
	},
] as const;

export const sideNotes = [
	{
		id: "presenca-fisica",
		label: "Lojas físicas",
		text: "Nas filiais você vê a ferramenta, testa e compra no balcão, sem frete.",
	},
] as const;
