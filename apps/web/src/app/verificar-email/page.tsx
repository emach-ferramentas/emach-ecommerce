import { Suspense } from "react";
import { VerifyEmailContent } from "./_components/verify-email-content";

function VerifyEmailFallback() {
	return (
		<main className="flex min-h-svh items-center justify-center bg-white px-6 py-20">
			<div className="w-full max-w-[400px] text-center">
				<h1 className="font-display font-medium text-[28px] text-near-black">
					Verificando…
				</h1>
				<p className="mt-3 text-[14px] text-gray-50">
					Aguarde enquanto confirmamos seu e-mail.
				</p>
			</div>
		</main>
	);
}

export default function VerifyEmailPage() {
	return (
		<Suspense fallback={<VerifyEmailFallback />}>
			<VerifyEmailContent />
		</Suspense>
	);
}
