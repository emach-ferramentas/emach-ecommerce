"use client";

import { log } from "evlog/next/client";
import { useEffect } from "react";

import { EmachButton, EmachLinkButton } from "@/components/emach-button";
import { StatusScreen } from "@/components/status-screen";

export default function CheckoutError({
	error,
	retry,
}: {
	error: Error & { digest?: string };
	retry: () => void;
}) {
	useEffect(() => {
		log.error({
			action: "error-boundary",
			segment: "checkout",
			digest: error.digest,
			message: error.message,
		});
	}, [error]);

	return (
		<StatusScreen
			actions={
				<>
					<EmachButton onClick={retry} size="lg" variant="dark">
						Tentar de novo
					</EmachButton>
					<EmachLinkButton href="/cart" size="lg" variant="line">
						Voltar ao carrinho
					</EmachLinkButton>
				</>
			}
			footnote={error.digest ? `Código do erro: ${error.digest}` : undefined}
			lede="Seu carrinho continua salvo neste navegador. Tente de novo em alguns segundos. Se o problema continuar, volte ao carrinho e finalize mais tarde."
			title="Não foi possível carregar o checkout."
		/>
	);
}
