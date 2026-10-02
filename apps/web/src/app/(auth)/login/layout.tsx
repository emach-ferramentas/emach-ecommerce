import type { Metadata } from "next";

// A página é client component; o título da rota vive aqui.
export const metadata: Metadata = {
	title: "Entrar",
	description: "Acesse sua conta EMACH ou crie seu cadastro.",
	robots: { index: false, follow: false },
};

export default function LoginLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return children;
}
