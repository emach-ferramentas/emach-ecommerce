"use client";

import { log } from "evlog/next/client";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { useEffect } from "react";

import { EmachButton, emachButtonVariants } from "@/components/emach-button";
import "../index.css";

const barlow = Barlow({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
	subsets: ["latin"],
	weight: ["500", "600", "700"],
	variable: "--font-barlow-condensed",
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
			<body
				className={`${barlow.variable} ${barlowCondensed.variable} bg-gray-10 antialiased`}
			>
				<title>Erro · EMACH</title>
				<main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col items-center justify-center px-5 py-32 text-center sm:px-8 lg:px-10">
					<h1 className="text-balance font-display font-medium text-[clamp(48px,7vw,96px)] text-near-black leading-none tracking-[-0.01em]">
						Algo deu errado.
					</h1>
					<p className="mt-6 max-w-[440px] text-[15px] text-gray-60 leading-[1.6]">
						A loja não carregou agora. Tente de novo em alguns segundos. Se o
						problema continuar, volte para a página inicial.
					</p>
					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<EmachButton onClick={retry} size="lg" variant="primary">
							Tentar de novo
						</EmachButton>
						<a
							className={emachButtonVariants({
								size: "lg",
								variant: "outline",
							})}
							href="/"
						>
							Página inicial
						</a>
					</div>
					{error.digest ? (
						<p className="mt-10 text-[12px] text-gray-60 tabular-nums">
							Código do erro: {error.digest}
						</p>
					) : null}
				</main>
			</body>
		</html>
	);
}
