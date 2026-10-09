import {
	EmailButton,
	EmailHeading,
	EmailLayout,
	EmailNote,
	EmailText,
} from "../layout";

export interface ResetPasswordEmailProps {
	companyAddress?: readonly string[] | null;
	name: string;
	url: string;
}

export function ResetPasswordEmail({
	companyAddress,
	name,
	url,
}: ResetPasswordEmailProps) {
	return (
		<EmailLayout
			companyAddress={companyAddress}
			preview="Redefina sua senha da conta EMACH"
			siteUrl={new URL(url).origin}
		>
			<EmailHeading>Redefinir sua senha</EmailHeading>
			<EmailText>
				Olá {name}, recebemos um pedido para redefinir a senha da sua conta
				EMACH. Clique no botão abaixo para criar uma nova senha.
			</EmailText>
			<EmailButton href={url}>Redefinir senha</EmailButton>
			<EmailNote>
				Este link expira em 1 hora. Se você não solicitou a redefinição, pode
				ignorar este e-mail. Sua senha atual não muda.
			</EmailNote>
		</EmailLayout>
	);
}

ResetPasswordEmail.PreviewProps = {
	companyAddress: [
		"Rua Pascoal Moreira Cabral Leme, 64, Loja Pinheiro, Nova Esperança",
		"Balneário Camboriú/SC, CEP 88336-310",
	],
	name: "Ana Souza",
	url: "https://emachferramentas.com.br/reset-password/preview?callbackURL=%2Fredefinir-senha",
} satisfies ResetPasswordEmailProps;

export default ResetPasswordEmail;
