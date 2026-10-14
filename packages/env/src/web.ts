import { createEnv } from "@t3-oss/env-core";
import { clientSchema } from "./schemas";

export const env = createEnv({
	clientPrefix: "NEXT_PUBLIC_",
	client: clientSchema,
	runtimeEnv: {
		NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
		NEXT_PUBLIC_ECOMMERCE_AUTH_URL: process.env.NEXT_PUBLIC_ECOMMERCE_AUTH_URL,
		NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY:
			process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY,
	},
	emptyStringAsUndefined: true,
	// Só o `next typegen` do check-types liga isto: no CI não há `.env`, e o
	// next.config importa este módulo só para gerar os tipos de rota.
	skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
