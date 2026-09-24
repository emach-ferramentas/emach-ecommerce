"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";

const SIGN_OUT_ERROR = "Não foi possível sair. Tente de novo.";

export function useSignOut() {
	const router = useRouter();

	return async () => {
		try {
			const { error } = await signOut();
			if (error) {
				toast.error(SIGN_OUT_ERROR);
				return;
			}
		} catch {
			toast.error(SIGN_OUT_ERROR);
			return;
		}
		toast.success("Sessão encerrada");
		router.push("/");
		// Sem o refresh, Server Components em cache seguem com os dados de quem saiu.
		router.refresh();
	};
}
