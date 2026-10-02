// Texto da página /sobre, separado do layout para o teste de guarda
// (lib/seo/institutional-content.test.ts) ler exatamente o que vai para a tela.

export const ABOUT_DESCRIPTION =
	"Como escolhemos as ferramentas que vendemos, o atendimento antes e depois da compra e onde ficam nossas filiais.";

export const aboutPillars = [
	{
		id: "curadoria",
		label: "Curadoria",
		title: "Escolhidas pra trabalho pesado",
		description:
			"Cada ferramenta do catálogo aguenta rotina de obra e indústria, sem item de vitrine",
		tone: "light",
	},
	{
		id: "atendimento",
		label: "Atendimento",
		title: "Suporte de quem entende de ferramenta",
		description:
			"A gente ajuda a escolher a ferramenta certa para o serviço e responde as dúvidas de uso",
		tone: "dark",
	},
] as const;

export const sideNotes = [
	{
		id: "linha-profissional",
		label: "Linha profissional",
		text: "Feitas pra trabalhar todo dia, não pro fim de semana",
	},
	{
		id: "presenca-fisica",
		label: "Presença física",
		text: "Loja de verdade: você retira, testa e tira dúvida pessoalmente",
	},
] as const;
