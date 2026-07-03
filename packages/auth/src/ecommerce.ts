import { createDb } from "@emach/db";
import {
	client,
	clientAccount,
	clientSession,
	clientVerification,
} from "@emach/db/schema/client";
import { sendEmail } from "@emach/email/send";
import { ResetPasswordEmail } from "@emach/email/templates/reset-password";
import { VerifyEmailEmail } from "@emach/email/templates/verify-email";
import { env } from "@emach/env/server";
import { RATE_LIMIT_WINDOW_SECONDS } from "@emach/redis";
import { isValidCpfCnpj, isValidPhone, onlyDigits } from "@emach/validators";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { createGoogleProviderConfig } from "./google";
import { createRateLimitStorage } from "./rate-limit-storage";

const db = createDb();
const schema = { client, clientSession, clientAccount, clientVerification };

const isProd = env.NODE_ENV === "production";

// Em produção, a URL é fixa e determinística (segurança: sem inferência de
// host arbitrário). Em dev, o host é derivado da request e validado contra
// `localhost:*`, permitindo rodar em qualquer porta sem editar o .env —
// útil quando a 3001 está ocupada por outro projeto. As portas locais ainda
// precisam estar nas "Authorized redirect URIs" do OAuth (Google não aceita
// wildcard de porta).
const ecommerceBaseURL = isProd
	? env.BETTER_AUTH_URL_ECOMMERCE
	: { allowedHosts: ["localhost:*"], protocol: "http" as const };

// Validação server-side de CPF/CNPJ (#92). A política client-side (Zod) é só
// UX; requests diretos aos endpoints do Better Auth (sign-up, updateUser)
// bypassam o cliente. Lança `APIError` (não `Error` plano) porque só ela
// propaga a mensagem ao cliente. Retorno tri-estado:
//   - `undefined`: campo não veio no payload → o hook não mexe no documento.
//   - `null`: campo veio vazio → limpar (grava NULL, **não** "" — string vazia
//     colidiria no unique `client_document_unique` no 2º cliente que limpasse,
//     e violaria a invariante "só dígitos" do schema).
//   - `string`: CPF/CNPJ normalizado (só dígitos) e válido.
function normalizeDocumentForWrite(raw: unknown): string | null | undefined {
	if (typeof raw !== "string") {
		return;
	}
	const trimmed = raw.trim();
	if (trimmed === "") {
		return null;
	}
	const document = onlyDigits(trimmed);
	if (!isValidCpfCnpj(document)) {
		throw new APIError("BAD_REQUEST", {
			message: "CPF ou CNPJ inválido.",
		});
	}
	return document;
}

// Mesmo tri-estado do document, para o `phone` (#100). `phone` NÃO é unique no
// schema (text("phone")), então o motivo do '' → null aqui é a invariante "só
// dígitos" da coluna, não colisão de unique. Validação client-side (Zod) é só UX.
function normalizePhoneForWrite(raw: unknown): string | null | undefined {
	if (typeof raw !== "string") {
		return;
	}
	const trimmed = raw.trim();
	if (trimmed === "") {
		return null;
	}
	const phone = onlyDigits(trimmed);
	if (!isValidPhone(phone)) {
		throw new APIError("BAD_REQUEST", {
			message: "Telefone inválido.",
		});
	}
	return phone;
}

// Aplica a normalização de todos os additionalFields graváveis num único lugar,
// consumido por create.before e update.before. `undefined` = campo ausente no
// payload → não mexe; `null`/string = grava.
function normalizeUserForWrite<T>(data: T): T {
	const document = normalizeDocumentForWrite(
		(data as { document?: unknown }).document
	);
	const phone = normalizePhoneForWrite((data as { phone?: unknown }).phone);
	let out = data;
	if (document !== undefined) {
		out = { ...out, document };
	}
	if (phone !== undefined) {
		out = { ...out, phone };
	}
	return out;
}

export const authEcommerce = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	trustedOrigins: isProd ? [env.ECOMMERCE_ORIGIN] : ["http://localhost:*"],
	emailAndPassword: {
		enabled: true,
		// Enforce server-side do mínimo de senha (#92). O Zod no cliente é só UX;
		// requests diretos ao endpoint bypassariam essa regra sem isto.
		minPasswordLength: 8,
		requireEmailVerification: false,
		autoSignIn: true,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Redefinir sua senha — EMACH",
				react: ResetPasswordEmail({ name: user.name, url }),
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Confirme seu e-mail — EMACH",
				react: VerifyEmailEmail({ name: user.name, url }),
			});
		},
	},
	socialProviders: {
		google: createGoogleProviderConfig({
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		}),
	},
	user: {
		modelName: "client",
		additionalFields: {
			phone: {
				type: "string",
				required: false,
				input: true,
			},
			document: {
				type: "string",
				required: false,
				input: true,
			},
		},
	},
	databaseHooks: {
		user: {
			create: {
				before: async (user) => ({ data: normalizeUserForWrite(user) }),
			},
			update: {
				before: async (userData) => ({ data: normalizeUserForWrite(userData) }),
			},
		},
	},
	session: {
		modelName: "clientSession",
		// Cache de sessão em cookie assinado (#perf-dashboard): sem isto, cada
		// `getSession`/`useSession` faz round-trip ao Supabase. O dashboard valida
		// a sessão 3× por navegação (layout + page server-side, header client-side)
		// — com o cache, viram leitura de cookie. Trade-off: revogação de sessão
		// só vale após `maxAge` (5 min); endpoints sensíveis (troca de senha etc.)
		// já forçam `disableCookieCache` internamente no Better Auth.
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},
	account: {
		modelName: "clientAccount",
	},
	verification: {
		modelName: "clientVerification",
	},
	secret: env.BETTER_AUTH_SECRET,
	baseURL: ecommerceBaseURL,
	rateLimit: {
		// `enabled: true` liga inclusive em dev (o Better Auth só ativa em prod
		// por default), permitindo testar o 429 localmente. Limite global frouxo;
		// regras agressivas nos paths sensíveis logo abaixo.
		enabled: true,
		window: RATE_LIMIT_WINDOW_SECONDS,
		max: 100,
		customStorage: createRateLimitStorage(),
		customRules: {
			"/sign-in/email": { window: RATE_LIMIT_WINDOW_SECONDS, max: 5 },
			"/sign-up/email": { window: RATE_LIMIT_WINDOW_SECONDS, max: 5 },
			// O endpoint email/password real no Better Auth 1.6.11 é
			// `/request-password-reset` (envia o e-mail) — NÃO `/forget-password`
			// (que é do plugin email-OTP, não usado aqui; seria dead code). E
			// `/reset-password` é a troca efetiva com o token. Os customRules
			// usam `p === path` (match exato), por isso o path tem que ser exato.
			"/request-password-reset": { window: RATE_LIMIT_WINDOW_SECONDS, max: 3 },
			"/reset-password": { window: RATE_LIMIT_WINDOW_SECONDS, max: 5 },
		},
	},
	advanced: {
		cookiePrefix: "ecommerce",
		// Atrás da Vercel o IP do cliente chega em x-forwarded-for. Sem declarar
		// o header, o Better Auth não resolve o IP e pula o rate limit. Na Vercel
		// esse header é setado pela infra (não é user-controlled).
		ipAddress: {
			ipAddressHeaders: ["x-forwarded-for"],
		},
		// Cookie de sessão (#96B): flags fixadas explicitamente em vez de depender
		// dos defaults implícitos do Better Auth. `secure` só em prod (https) —
		// em dev (http localhost) o cookie não setaria com secure. Sem `domain`:
		// subdomínios isolam por host (invariante P0 — não vazar sessão entre apps).
		defaultCookieAttributes: {
			httpOnly: true,
			sameSite: "lax",
			secure: isProd,
		},
	},
	plugins: [nextCookies()],
});

export type EcommerceSession = typeof authEcommerce.$Infer.Session;
