import {
	EmailButton,
	EmailHeading,
	EmailLayout,
	EmailNote,
	EmailText,
} from "../layout";

export interface VerifyEmailProps {
	name: string;
	url: string;
}

export function VerifyEmailEmail({ name, url }: VerifyEmailProps) {
	return (
		<EmailLayout
			preview="Confirme seu e-mail na EMACH"
			siteUrl={new URL(url).origin}
		>
			<EmailHeading>Confirme seu e-mail</EmailHeading>
			<EmailText>
				Olá {name}, falta só um passo. Confirme que este e-mail é seu para
				ativar sua conta EMACH.
			</EmailText>
			<EmailButton href={url}>Confirmar e-mail</EmailButton>
			<EmailNote>
				Se você não se cadastrou na EMACH, pode ignorar este e-mail com
				segurança.
			</EmailNote>
		</EmailLayout>
	);
}

VerifyEmailEmail.PreviewProps = {
	name: "Ana Souza",
	url: "https://emachferramentas.com.br/api/auth/verify-email?token=preview",
} satisfies VerifyEmailProps;

export default VerifyEmailEmail;
