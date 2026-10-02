"use client";

import { log } from "evlog/next/client";
import { Archivo } from "next/font/google";
import { useEffect } from "react";

import { EmachButton, emachButtonVariants } from "@/components/emach-button";
import { StatusScreen } from "@/components/status-screen";
import "../index.css";

const archivo = Archivo({
	subsets: ["latin"],
	axes: ["wdth"],
	variable: "--font-archivo",
});

// Substitui o root layout inteiro: sem Providers, sem header, sem next/link.
// O link para a loja é <a> puro para forçar um carregamento completo.
export default function GlobalError({
	error,
	retry,
}: {
	error: Error & { digest?: string };
	retry: () => void;
}) {
	useEffect(() => {
		log.error({
			action: "error-boundary",
			segment: "global",
			digest: error.digest,
			message: error.message,
		});
	}, [error]);

	return (
		<html lang="pt-BR">
			<body className={`${archivo.variable} bg-paper text-ink antialiased`}>
				<title>Erro · EMACH</title>
				<main className="flex min-h-screen items-center">
					<StatusScreen
						actions={
							<>
								<EmachButton onClick={retry} size="lg" variant="dark">
									Tentar de novo
								</EmachButton>
								<a
									className={emachButtonVariants({
										size: "lg",
										variant: "line",
									})}
									href="/"
								>
									Página inicial
								</a>
							</>
						}
						footnote={
							error.digest ? `Código do erro: ${error.digest}` : undefined
						}
						lede="A loja não carregou agora. Tente de novo em alguns segundos. Se o problema continuar, volte para a página inicial."
						title="Algo deu errado"
					/>
				</main>
			</body>
		</html>
	);
}
