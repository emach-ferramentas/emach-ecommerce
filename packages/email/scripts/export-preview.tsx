// Exporta a prévia HTML de cada template, sem enviar nada. O logo é copiado
// para a pasta de saída e o HTML aponta para a cópia, para a prévia abrir
// offline antes do PNG existir no domínio da loja.
// Uso: bun run --filter=@emach/email preview <pasta-de-saída>
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { render } from "@react-email/render";
import { OrderReceivedEmail } from "../src/templates/order-received";
import { ResetPasswordEmail } from "../src/templates/reset-password";
import { VerifyEmailEmail } from "../src/templates/verify-email";

const LOGO_PATH = "images/email/emach-logo.png";
const LOGO_SOURCE = resolve(
	import.meta.dir,
	"../../../apps/web/public",
	LOGO_PATH
);

const outDir = resolve(process.argv[2] ?? "email-preview");

const previews = [
	{
		name: "verify-email",
		url: VerifyEmailEmail.PreviewProps.url,
		element: <VerifyEmailEmail {...VerifyEmailEmail.PreviewProps} />,
	},
	{
		name: "order-received",
		url: OrderReceivedEmail.PreviewProps.orderUrl,
		element: <OrderReceivedEmail {...OrderReceivedEmail.PreviewProps} />,
	},
	{
		name: "reset-password",
		url: ResetPasswordEmail.PreviewProps.url,
		element: <ResetPasswordEmail {...ResetPasswordEmail.PreviewProps} />,
	},
];

await mkdir(join(outDir, "images/email"), { recursive: true });
await copyFile(LOGO_SOURCE, join(outDir, LOGO_PATH));
for (const { name, url, element } of previews) {
	const html = await render(element, { pretty: true });
	const file = join(outDir, `${name}.html`);
	await writeFile(
		file,
		html.replaceAll(`${new URL(url).origin}/${LOGO_PATH}`, LOGO_PATH)
	);
	process.stdout.write(`${file}\n`);
}
