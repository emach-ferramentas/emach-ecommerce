import type { Metadata } from "next";

// A página é client component; o título da rota vive aqui.
export const metadata: Metadata = {
	title: "Recuperar senha",
	robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return children;
}
