import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthColumn } from "../_components/auth-column";
import { ResetPasswordForm } from "./_components/reset-password-form";

export const metadata: Metadata = {
	title: "Redefinir senha",
	robots: { index: false, follow: false },
};

function ResetPasswordFallback() {
	return <AuthColumn lede="Carregando…" title="Redefinir senha" />;
}

export default function ResetPasswordPage() {
	return (
		<Suspense fallback={<ResetPasswordFallback />}>
			<ResetPasswordForm />
		</Suspense>
	);
}
