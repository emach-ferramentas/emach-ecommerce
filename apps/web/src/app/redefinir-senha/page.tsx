import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHomeLogo } from "@/app/login/_components/auth-home-logo";
import { ResetPasswordForm } from "./_components/reset-password-form";

export const metadata: Metadata = {
	title: "Redefinir senha",
	robots: { index: false, follow: false },
};

function ResetPasswordFallback() {
	return (
		<main className="flex min-h-svh items-center justify-center bg-gray-10 px-6 py-20">
			<div className="w-full max-w-[400px]">
				<AuthHomeLogo className="mb-10 h-8" tone="red" />
				<h1 className="font-display font-medium text-[32px] text-near-black leading-tight">
					Redefinir senha
				</h1>
				<p className="mt-3 text-[14px] text-gray-60">Carregando…</p>
			</div>
		</main>
	);
}

export default function ResetPasswordPage() {
	return (
		<Suspense fallback={<ResetPasswordFallback />}>
			<ResetPasswordForm />
		</Suspense>
	);
}
