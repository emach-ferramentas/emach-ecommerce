import { Suspense } from "react";
import { ResetPasswordForm } from "./_components/reset-password-form";

function ResetPasswordFallback() {
	return (
		<main className="flex min-h-svh items-center justify-center bg-white px-6 py-20">
			<div className="w-full max-w-[400px]">
				<h1 className="font-display font-medium text-[32px] text-near-black leading-tight">
					Redefinir senha
				</h1>
				<p className="mt-3 text-[14px] text-gray-50">Carregando…</p>
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
