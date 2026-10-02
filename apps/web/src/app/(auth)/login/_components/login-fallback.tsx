import Loader from "@/components/loader";
import { LoginShell } from "./login-shell";

export function LoginFallback() {
	return (
		<LoginShell>
			<Loader />
		</LoginShell>
	);
}
