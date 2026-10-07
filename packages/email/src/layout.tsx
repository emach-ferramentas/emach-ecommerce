import {
	Body,
	Button,
	Container,
	Font,
	Head,
	Heading,
	Html,
	Img,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { Fragment, type ReactNode } from "react";

// Tokens do H3 (packages/ui/src/styles/globals.css) em hex, porque cliente de
// e-mail não lê CSS custom property.
export const color = {
	paper: "#ffffff",
	canteiro: "#f0f0ee",
	ink: "#16191d",
	inkMuted: "#5a6068",
	line: "#d8dad7",
	red: "#da291c",
} as const;

// Archivo variável (latin) do Google Fonts. Quem não carrega web font (Outlook,
// Gmail app) cai em Arial, que tem métrica próxima.
const ARCHIVO_WOFF2 =
	"https://fonts.gstatic.com/s/archivo/v25/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLydOxI.woff2";
const FONT_STACK = "Archivo, Arial, Helvetica, sans-serif";

// Mesmo CNPJ do rodapé do site (apps/web/src/components/site-footer.tsx).
const COMPANY = "EMACH Ferramentas";
const CNPJ = "04.128.615/0001-59";
const TAGLINE =
	"Ferramentas e acessórios para obra, organizados pelo serviço que você vai fazer.";

export interface EmailLayoutProps {
	children: ReactNode;
	/** Linhas de `loadCompanyAddress`; sem elas o rodapé omite o endereço. */
	companyAddress?: readonly string[] | null;
	preview: string;
	/** Origem da loja (ex.: https://emachferramentas.com.br); serve o logo PNG. */
	siteUrl: string;
}

export function EmailLayout({
	children,
	companyAddress,
	preview,
	siteUrl,
}: EmailLayoutProps) {
	return (
		<Html lang="pt-BR">
			<Head>
				<Font
					fallbackFontFamily={["Arial", "Helvetica", "sans-serif"]}
					fontFamily="Archivo"
					fontWeight="400 800"
					webFont={{ url: ARCHIVO_WOFF2, format: "woff2" }}
				/>
			</Head>
			<Body
				style={{
					backgroundColor: color.canteiro,
					color: color.ink,
					fontFamily: FONT_STACK,
					margin: 0,
					padding: "32px 12px",
				}}
			>
				<Preview>{preview}</Preview>
				<Container
					style={{
						backgroundColor: color.paper,
						border: `1px solid ${color.line}`,
						borderRadius: "5px",
						maxWidth: "560px",
					}}
				>
					<Section
						data-email-layout="header"
						style={{
							borderBottom: `1px solid ${color.line}`,
							padding: "24px 32px",
						}}
					>
						<Img
							alt={COMPANY}
							height="26"
							src={`${siteUrl}/images/email/emach-logo.png`}
							width="140"
						/>
					</Section>
					<Section data-email-layout="content" style={{ padding: "32px" }}>
						{children}
					</Section>
					<Section
						data-email-layout="footer"
						style={{
							backgroundColor: color.canteiro,
							borderRadius: "0 0 5px 5px",
							borderTop: `1px solid ${color.line}`,
							padding: "20px 32px",
						}}
					>
						<Text
							style={{
								color: color.inkMuted,
								fontSize: "13px",
								lineHeight: 1.6,
								margin: 0,
							}}
						>
							<strong style={{ color: color.ink }}>{COMPANY}</strong>
							<br />
							{TAGLINE}
							<br />
							{companyAddress?.map((line) => (
								<Fragment key={line}>
									{line}
									<br />
								</Fragment>
							))}
							{`CNPJ ${CNPJ}`}
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

export function EmailHeading({ children }: { children: ReactNode }) {
	return (
		<Heading
			style={{
				color: color.ink,
				fontSize: "26px",
				fontWeight: 800,
				lineHeight: 1.15,
				margin: "0 0 16px",
				textTransform: "uppercase",
			}}
		>
			{children}
		</Heading>
	);
}

export function EmailText({ children }: { children: ReactNode }) {
	return (
		<Text
			style={{
				color: color.ink,
				fontSize: "16px",
				lineHeight: 1.6,
				margin: "0 0 16px",
			}}
		>
			{children}
		</Text>
	);
}

export function EmailNote({ children }: { children: ReactNode }) {
	return (
		<Text
			style={{
				color: color.inkMuted,
				fontSize: "14px",
				lineHeight: 1.6,
				margin: 0,
			}}
		>
			{children}
		</Text>
	);
}

/** Variante `cta` do EmachButton: vermelho, uma vez por e-mail. */
export function EmailButton({
	children,
	href,
}: {
	children: ReactNode;
	href: string;
}) {
	return (
		<Section style={{ margin: "8px 0 28px" }}>
			<Button
				href={href}
				style={{
					backgroundColor: color.red,
					borderRadius: "3px",
					boxSizing: "border-box",
					color: "#ffffff",
					fontSize: "16px",
					fontWeight: 700,
					padding: "16px 28px",
					textDecoration: "none",
				}}
			>
				{children}
			</Button>
		</Section>
	);
}
