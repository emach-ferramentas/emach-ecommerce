import { z } from "zod";

/**
 * Fonte única dos schemas de env, separada de `server.ts`/`web.ts` para poder
 * ser importada SEM disparar `createEnv` (que valida no nível do módulo e
 * abortaria fora do runtime). O drift-check (`scripts/check-vercel-env.ts`)
 * deriva as obrigatórias daqui via `safeParse(undefined)` — fiel à validação
 * real, sem parsear texto.
 */

export const serverSchema = {
	DATABASE_URL: z.string().min(1),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url(),
	CORS_ORIGIN: z.url(),
	BETTER_AUTH_URL_ECOMMERCE: z.url(),
	ECOMMERCE_ORIGIN: z.url(),
	GOOGLE_CLIENT_ID: z.string().min(1),
	GOOGLE_CLIENT_SECRET: z.string().min(1),
	RESEND_API_KEY: z.string().min(1),
	EMAIL_FROM: z.string().min(3),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
	NEXT_PUBLIC_SUPABASE_URL: z.url(),
	// Upstash Redis (REST) — storage do rate limit serverless (#91 auth,
	// #94 checkout). Opcionais: ausentes → fallback in-memory em dev/local;
	// obrigatórias na prática em produção (Vercel).
	UPSTASH_REDIS_REST_URL: z.url().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
	// Frenet — cotação de frete (spec 2026-07-02-frenet-cotacao-design.md).
	// TOKEN vem do painel (painel.frenet.com.br > Dados Cadastrais); SELLER_CEP é
	// o CEP de origem do despacho (v1 fixo em env; dashboard exporá via
	// storeSettings depois). BASE_URL com default → fora das obrigatórias do
	// check:env.
	FRENET_TOKEN: z.string().min(1),
	FRENET_SELLER_CEP: z.string().regex(/^\d{8}$/, "CEP de origem: 8 dígitos"),
	FRENET_BASE_URL: z.url().default("https://api.frenet.com.br"),
} as const;

export const clientSchema = {
	NEXT_PUBLIC_SITE_URL: z.url(),
	NEXT_PUBLIC_ECOMMERCE_AUTH_URL: z.url(),
	NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY: z.string().min(1).optional(),
} as const;
