import { env } from "@emach/env/web";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Suspense } from "react";

import { NavigationProgress } from "@/components/navigation-progress";
import Providers from "@/components/providers";
import "../index.css";

// Fonte variável: o eixo de largura (wdth 62–125) dá os títulos condensados
// com a mesma família do corpo (ver --font-display em globals.css).
const archivo = Archivo({
	subsets: ["latin"],
	axes: ["wdth"],
	variable: "--font-archivo",
});

export const metadata: Metadata = {
	metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
	title: {
		default: "EMACH Ferramentas — Furadeiras, Serras e EPIs",
		template: "%s · EMACH",
	},
	description:
		"Furadeiras, serras, equipamentos de medição e EPIs para obra e oficina. Compra direta na EMACH, com envio para todo o Brasil.",
	applicationName: "EMACH",
	openGraph: {
		siteName: "EMACH",
		type: "website",
		locale: "pt_BR",
		images: ["/images/og-default.png"],
	},
	twitter: {
		card: "summary_large_image",
		images: ["/images/og-default.png"],
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#000000" },
		{ media: "(prefers-color-scheme: dark)", color: "#000000" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="pt-BR">
			<body
				className={`${archivo.variable} antialiased`}
				suppressHydrationWarning
			>
				<Providers>{children}</Providers>
				{/* useSearchParams (sinal de chegada) exige o Suspense próprio. */}
				<Suspense fallback={null}>
					<NavigationProgress />
				</Suspense>
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
