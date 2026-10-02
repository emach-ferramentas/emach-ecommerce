"use client";

import { log } from "evlog/next/client";
import { useEffect } from "react";

import { EmachButton, EmachLinkButton } from "@/components/emach-button";
import { StatusScreen } from "@/components/status-screen";

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
		<main className="flex min-h-screen items-center bg-paper" id="main-content">
			<StatusScreen
				actions={
					<>
						<EmachButton onClick={retry} size="lg" variant="dark">
							Tentar de novo
						</EmachButton>
						<EmachLinkButton href="/" size="lg" variant="line">
							Voltar para a loja
						</EmachLinkButton>
					</>
				}
				footnote={error.digest ? `Código do erro: ${error.digest}` : undefined}
				lede="Não conseguimos carregar esta página agora. Tente de novo em alguns segundos. Se o problema continuar, volte para a loja."
				title="Algo deu errado"
			/>
		</main>
	);
}
