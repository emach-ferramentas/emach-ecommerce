import Loader from "@/components/loader";

// Único fallback do /login: loading.tsx, o Suspense do page.tsx e o form
// enquanto a sessão carrega mostram a mesma tela, sem salto de layout.
export function LoginFallback() {
	return (
		<main className="flex h-svh items-center justify-center bg-near-black text-white">
			<Loader />
		</main>
	);
}
