import { authEcommerce } from "@emach/auth/ecommerce";
import {
	type BetterAuthInstance,
	createAuthMiddleware,
} from "evlog/better-auth";
import { useLogger as getEvlogLogger } from "@/lib/evlog";

const identifyClient = createAuthMiddleware(
	authEcommerce as unknown as BetterAuthInstance,
	{
		exclude: ["/api/auth/**"],
		maskEmail: true,
	}
);

export async function identifyEvlogClient(request: Request) {
	await identifyClient(
		getEvlogLogger(),
		request.headers,
		new URL(request.url).pathname
	);
}
