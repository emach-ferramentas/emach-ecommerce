import { env } from "@emach/env/server";
import { render } from "@react-email/render";
import { log } from "evlog";
import type { ReactElement } from "react";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

export interface SendEmailArgs {
	react: ReactElement;
	subject: string;
	to: string;
}

// Não logamos o destinatário em texto plano (PII). Mascara o local-part
// mantendo o domínio, suficiente para diagnóstico de entregabilidade.
function maskEmail(email: string): string {
	const at = email.indexOf("@");

	if (at <= 0) {
		return "***";
	}

	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	// Locais de ≤2 chars não mostram prefixo — senão "a@x.com" viraria
	// "a***@x.com" e o e-mail inteiro vazaria sem mascaramento real.
	const head = local.length > 2 ? local.slice(0, 2) : "";

	return `${head}***@${domain}`;
}

export async function sendEmail({ to, subject, react }: SendEmailArgs) {
	const html = await render(react);

	const { data, error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject,
		html,
	});

	if (error) {
		log.error({
			action: "email-send",
			msg: "Resend send failed",
			to: maskEmail(to),
			subject,
			from: env.EMAIL_FROM,
			error,
		});
		throw new Error(
			`Resend send failed: ${error.name ?? "unknown"} — ${error.message ?? JSON.stringify(error)}`
		);
	}

	log.info({
		action: "email-send",
		msg: "sent",
		to: maskEmail(to),
		subject,
		id: data?.id,
	});

	return data;
}
