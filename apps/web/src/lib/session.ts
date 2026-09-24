import { authEcommerce, type EcommerceSession } from "@emach/auth/ecommerce";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { safeRedirect } from "./safe-redirect";

// `cache()` deduplica chamadas dentro da mesma request render: o `/dashboard`
// resolve a sessão no layout (DashboardChrome) e na page (requireCurrentClient),
// e sem isto seriam dois `getSession` no mesmo render. Combinado com o
// `cookieCache` do auth, a sessão é resolvida uma vez e sem hit no DB.
export const getCurrentClient = cache(
	async (): Promise<EcommerceSession | null> =>
		authEcommerce.api.getSession({ headers: await headers() })
);

// `returnTo` volta pelo mesmo parâmetro `redirect` que o proxy.ts monta no
// edge. O layout não sabe o caminho da página, então só quem sabe o passa.
export const requireCurrentClient = async (
	returnTo?: string
): Promise<EcommerceSession> => {
	const session = await getCurrentClient();
	if (!session?.user) {
		const target = safeRedirect(returnTo, "");
		if (target) {
			redirect(`/login?${new URLSearchParams({ redirect: target })}`);
		}
		redirect("/login");
	}
	return session;
};
