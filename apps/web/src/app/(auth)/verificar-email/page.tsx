import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthColumn } from "../_components/auth-column";
import { VerifyEmailContent } from "./_components/verify-email-content";

export const metadata: Metadata = {
	title: "Verificar e-mail",
	robots: { index: false, follow: false },
};

function VerifyEmailFallback() {
	return (
		<AuthColumn
			lede="Aguarde enquanto confirmamos seu e-mail."
			title="Verificando…"
		/>
	);
}

export default function VerifyEmailPage() {
	return (
		<Suspense fallback={<VerifyEmailFallback />}>
			<VerifyEmailContent />
		</Suspense>
	);
}
