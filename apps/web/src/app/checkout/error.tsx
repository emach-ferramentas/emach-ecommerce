"use client";

import { log } from "evlog/next/client";
import Link from "next/link";
import { useEffect } from "react";

import { EmachButton, emachButtonVariants } from "@/components/emach-button";

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
		<div className="mx-auto flex w-full max-w-5xl flex-col items-start px-4 py-24 sm:px-6 lg:px-10">
			<h1 className="text-balance font-display font-medium text-[36px] text-near-black leading-[1.05]">
				Não foi possível carregar o checkout.
			</h1>
			<p className="mt-4 max-w-[520px] text-[15px] text-gray-60 leading-[1.6]">
				Seu carrinho continua salvo neste navegador. Tente de novo em alguns
				segundos. Se o problema continuar, volte ao carrinho e finalize mais
				tarde.
			</p>
			<div className="mt-8 flex flex-wrap gap-3">
				<EmachButton onClick={retry} size="lg" variant="primary">
					Tentar de novo
				</EmachButton>
				<Link
					className={emachButtonVariants({ size: "lg", variant: "outline" })}
					href="/cart"
				>
					Voltar ao carrinho
				</Link>
			</div>
			{error.digest ? (
				<p className="mt-10 text-[12px] text-gray-60 tabular-nums">
					Código do erro: {error.digest}
				</p>
			) : null}
		</div>
	);
}
