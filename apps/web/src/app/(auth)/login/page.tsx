import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginFallback } from "./_components/login-fallback";
import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = {
	title: "Entrar",
};

export default function LoginPage() {
	return (
		<Suspense fallback={<LoginFallback />}>
			<LoginForm />
		</Suspense>
	);
}
