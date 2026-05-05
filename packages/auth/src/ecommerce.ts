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
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createGoogleProviderConfig } from "./google";

const db = createDb();
const schema = { client, clientSession, clientAccount, clientVerification };

export const authEcommerce = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	trustedOrigins: [env.ECOMMERCE_ORIGIN],
	emailAndPassword: {
		enabled: true,
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
		sendOnSignUp: false,
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
	databaseHooks: {
		user: {
			create: {
				before: async (user) => ({
					data: { ...user, emailVerified: true },
				}),
			},
		},
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
	session: {
		modelName: "clientSession",
	},
	account: {
		modelName: "clientAccount",
	},
	verification: {
		modelName: "clientVerification",
	},
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL_ECOMMERCE,
	advanced: {
		cookiePrefix: "ecommerce",
	},
	plugins: [nextCookies()],
});

export type EcommerceSession = typeof authEcommerce.$Infer.Session;
