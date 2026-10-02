"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EmachLinkButton } from "@/components/emach-button";
import { authClient } from "@/lib/auth-client";
import { AuthColumn } from "../../_components/auth-column";

const LINK_CLASS =
	"font-semibold text-[14px] text-ink-2 underline underline-offset-[3px] hover:text-ink";

type Status = "loading" | "success" | "error";

export function VerifyEmailContent() {
	const router = useRouter();
	const params = useSearchParams();
	const token = params.get("token");
	const [status, setStatus] = useState<Status>("loading");

	useEffect(() => {
		if (!token) {
			setStatus("error");
			return;
		}
		authClient
			.verifyEmail({ query: { token } })
			.then((res) => {
				if (res.error) {
					setStatus("error");
					return;
				}
				setStatus("success");
				setTimeout(() => router.push("/dashboard"), 1500);
			})
			.catch(() => setStatus("error"));
	}, [token, router]);

	return (
		<div aria-atomic="true" aria-live="polite">
			{status === "loading" && (
				<AuthColumn
					lede="Aguarde enquanto confirmamos seu e-mail."
					title="Verificando…"
				/>
			)}
			{status === "success" && (
				<AuthColumn
					lede="Redirecionando para o painel…"
					title="E-mail confirmado"
				>
					<Link className={LINK_CLASS} href={{ pathname: "/login" }}>
						Ir para o login agora
					</Link>
				</AuthColumn>
			)}
			{status === "error" && (
				<AuthColumn
					lede="Este link é inválido ou expirou. Faça login para reenviar o e-mail de confirmação."
					title="Link inválido"
				>
					<EmachLinkButton href="/login" variant="dark">
						Ir para o login
					</EmachLinkButton>
				</AuthColumn>
			)}
		</div>
	);
}
