import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";

import Providers from "@/components/providers";
import { Ticker } from "@/components/ticker";
import "../index.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  ),
  title: {
    default: "EMACH — Ferramentas Profissionais",
    template: "%s",
  },
  description:
    "Ferramentas elétricas e manuais de alta performance para profissionais.",
  applicationName: "EMACH",
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
        className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}
        suppressHydrationWarning
      >
        <Ticker />
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
