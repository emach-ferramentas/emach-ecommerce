import type { InstitutionalSection } from "@/components/institutional-page";

export const PRIVACY_UPDATED_AT = "2026-09-01";

export const PRIVACY_LEDE =
	"O que a EMACH guarda sobre você, por quê, e como pedir para ver, corrigir ou apagar.";

export const privacySections: InstitutionalSection[] = [
	{
		id: "quem-somos",
		title: "Quem trata os seus dados",
		paragraphs: [
			"A EMACH Ferramentas (CNPJ 04.128.615/0001-59) é a controladora dos dados pessoais coletados neste site. Esta página vale para a loja virtual. Nas filiais o atendimento é presencial e segue as mesmas regras.",
			"Tratamos dados conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Se algo aqui não estiver claro, pergunte em qualquer filial: os telefones estão na página Sobre.",
		],
	},
	{
		id: "o-que-coletamos",
		title: "O que coletamos",
		paragraphs: [
			"Só o necessário para vender, entregar e atender. Nada de formulário com dez campos que ninguém usa.",
		],
		bullets: [
			"Cadastro: nome, e-mail, telefone e CPF ou CNPJ. O documento é guardado só com os dígitos e serve para emitir a nota fiscal.",
			"Endereços de entrega que você cadastra na sua conta.",
			"Login com Google: recebemos nome, e-mail e foto do perfil. Não recebemos sua senha do Google.",
			"Sessão: um cookie de login (ecommerce.session_token), com endereço IP e navegador registrados para segurança.",
			"Pedidos: itens, valores, forma de entrega e o histórico de status.",
			"Consentimentos: ao fechar um pedido, registramos que você aceitou os termos e esta política, e se optou por receber e-mails de ofertas, com data, versão do texto, IP e navegador.",
			"Carrinho: fica no seu navegador (localStorage), junto com um identificador aleatório de visitante. Usamos isso para entender abandono de carrinho de forma agregada. Quando você está logado, esses eventos ficam ligados à sua conta.",
		],
	},
	{
		id: "para-que-usamos",
		title: "Para que usamos",
		paragraphs: ["Usamos os dados para quatro coisas:"],
		bullets: [
			"Cumprir o contrato de compra: separar, faturar e entregar o pedido, e responder quando você perguntar sobre ele.",
			"Obrigação legal: nota fiscal e guarda de documentos fiscais pelo prazo que a lei exige.",
			"Segurança: detectar acesso indevido à sua conta e fraude em pedidos.",
			"Ofertas por e-mail: só se você marcou a opção no checkout. Para parar de receber, peça em qualquer filial.",
		],
	},
	{
		id: "com-quem-compartilhamos",
		title: "Com quem compartilhamos",
		paragraphs: [
			"Não vendemos dados. Compartilhamos o mínimo com quem precisa para o serviço funcionar:",
		],
		bullets: [
			"Frenet (cotação de frete): recebe o CEP de destino, o peso e as medidas dos volumes e o valor declarado do pedido. Não recebe seu nome nem documento.",
			"Transportadoras: recebem nome, endereço e telefone para entregar o pedido.",
			"Resend (envio de e-mail): recebe seu e-mail para mandar confirmação de cadastro e redefinição de senha, sempre a partir de nao-responder@emachferramentas.com.br.",
			"Google: só se você escolher entrar com a conta Google.",
			"Vercel (hospedagem e medição de desempenho): estatísticas de acesso agregadas, sem cookie e sem identificar você.",
			"Autoridades, quando a lei obrigar.",
		],
	},
	{
		id: "cookies",
		title: "Cookies e armazenamento no navegador",
		paragraphs: [
			"Usamos um cookie de sessão para manter você logado. Não usamos cookies de publicidade nem de rastreamento entre sites.",
			"O carrinho e o identificador de visitante ficam no armazenamento local do seu navegador. Limpar os dados do site apaga os dois.",
		],
	},
	{
		id: "por-quanto-tempo",
		title: "Por quanto tempo guardamos",
		bullets: [
			"Conta e endereços: enquanto a conta existir.",
			"Pedidos e notas fiscais: pelo prazo legal de guarda de documentos fiscais, mesmo depois de encerrar a conta.",
			"Registros de consentimento e de segurança (IP, navegador): pelo tempo necessário para comprovar o consentimento e investigar incidentes.",
			"E-mails de ofertas: até você cancelar.",
		],
		paragraphs: [],
	},
	{
		id: "seus-direitos",
		title: "Seus direitos",
		paragraphs: [
			"A LGPD garante, e a gente atende, os pedidos abaixo. Faça o pedido em qualquer filial, com um documento que comprove que a conta é sua. Respondemos em até 15 dias.",
		],
		bullets: [
			"Confirmar se tratamos seus dados e acessar o que temos.",
			"Corrigir dado incompleto ou desatualizado. Nome, telefone e endereços você mesmo edita na sua conta.",
			"Pedir a exclusão da conta. Dados de pedidos e notas ficam guardados só pelo prazo fiscal.",
			"Receber seus dados em formato legível por máquina (portabilidade).",
			"Retirar o consentimento para e-mails de ofertas.",
			"Saber com quem compartilhamos seus dados.",
		],
	},
	{
		id: "seguranca",
		title: "Como protegemos",
		paragraphs: [
			"Guardamos senhas com hash, nunca em texto puro. O site roda só em HTTPS. Só a equipe que atende você acessa o banco de dados.",
		],
	},
	{
		id: "mudancas",
		title: "Mudanças nesta política",
		paragraphs: [
			"Quando mudar algo relevante, atualizamos a data no topo desta página. Vale conferir de vez em quando.",
		],
	},
];
