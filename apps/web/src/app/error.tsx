"use client";

import { log } from "evlog/next/client";
import Link from "next/link";
import { useEffect } from "react";

import { EmachButton, emachButtonVariants } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";

export default function RootError({
	error,
	retry,
}: {
	error: Error & { digest?: string };
	retry: () => void;
}) {
	useEffect(() => {
		log.error({
			action: "error-boundary",
			segment: "root",
			digest: error.digest,
			message: error.message,
		});
	}, [error]);

	return (
		<PageContainer
			as="main"
			className="flex min-h-screen flex-col items-center justify-center py-32 text-center"
		>
			<h1 className="text-balance font-display font-medium text-[clamp(48px,7vw,96px)] text-near-black leading-none tracking-[-0.01em]">
				Algo deu errado.
			</h1>
			<p className="mt-6 max-w-[440px] text-[15px] text-gray-60 leading-[1.6]">
				Não conseguimos carregar esta página agora. Tente de novo em alguns
				segundos. Se o problema continuar, volte para a loja.
			</p>
			<div className="mt-8 flex flex-wrap justify-center gap-3">
				<EmachButton onClick={retry} size="lg" variant="primary">
					Tentar de novo
				</EmachButton>
				<Link
					className={emachButtonVariants({ size: "lg", variant: "outline" })}
					href="/"
				>
					Voltar para a loja
				</Link>
			</div>
			{error.digest ? (
				<p className="mt-10 text-[12px] text-gray-60 tabular-nums">
					Código do erro: {error.digest}
				</p>
			) : null}
		</PageContainer>
	);
}
