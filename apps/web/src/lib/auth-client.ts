import type { authEcommerce } from "@emach/auth/ecommerce";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	// Em dev, deixar undefined faz o client usar same-origin (window.location),
	// então o login funciona em qualquer porta local. Em produção, fixar a URL.
	baseURL:
		process.env.NODE_ENV === "production"
			? process.env.NEXT_PUBLIC_ECOMMERCE_AUTH_URL
			: undefined,
	// `import type` some no build: o client só herda o tipo de
	// `user.additionalFields` do servidor (`phone`, `document`), sem código dele.
	plugins: [inferAdditionalFields<typeof authEcommerce>()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
