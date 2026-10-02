import { requireCurrentClient } from "@/lib/session";
import { AccountNav } from "./account-nav";

export const ACCOUNT_GRID_CLASS =
	"shop-wrap grid grid-cols-1 gap-x-10 pb-16 md:grid-cols-[240px_minmax(0,1fr)]";

// Guarda P0 (#98) sob Suspense (exigência do cacheComponents): a validação
// real da sessão (`requireCurrentClient` → getSession + redirect) roda AQUI,
// dentro do boundary, e `{children}` só renderiza DEPOIS dela resolver; o
// não-autenticado vê apenas o skeleton e é redirecionado, sem vazar dados.
export async function DashboardChrome({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await requireCurrentClient();

	return (
		<div className={ACCOUNT_GRID_CLASS}>
			<AccountNav userEmail={session.user.email} userName={session.user.name} />
			<div className="min-w-0">{children}</div>
		</div>
	);
}
