"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

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
		<main className="flex min-h-svh items-center justify-center bg-white px-6 py-20">
			<div className="w-full max-w-[400px] text-center">
				{status === "loading" && (
					<>
						<h1 className="font-display font-medium text-[28px] text-near-black">
							Verificando…
						</h1>
						<p className="mt-3 text-[14px] text-gray-50">
							Aguarde enquanto confirmamos seu e-mail.
						</p>
					</>
				)}
				{status === "success" && (
					<>
						<h1 className="font-display font-medium text-[28px] text-near-black">
							E-mail confirmado
						</h1>
						<p className="mt-3 text-[14px] text-gray-50">
							Redirecionando para o painel…
						</p>
					</>
				)}
				{status === "error" && (
					<>
						<h1 className="font-display font-medium text-[28px] text-near-black">
							Link inválido
						</h1>
						<p className="mt-3 text-[14px] text-gray-50">
							Este link é inválido ou expirou. Faça login para reenviar o e-mail
							de confirmação.
						</p>
						<Link
							className="mt-6 inline-block text-[13px] text-emach-red hover:underline"
							href={{ pathname: "/login" }}
						>
							Ir para o login
						</Link>
					</>
				)}
			</div>
		</main>
	);
}
