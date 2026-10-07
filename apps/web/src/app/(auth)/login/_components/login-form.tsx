"use client";

import { Checkbox } from "@emach/ui/components/checkbox";
import { Separator } from "@emach/ui/components/separator";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@emach/ui/components/tabs";
import { maskPhone, onlyDigits } from "@emach/validators";
import { useForm } from "@tanstack/react-form";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { EmachButton } from "@/components/emach-button";
import { TextField } from "@/components/field";
import { Notice } from "@/components/notice";
import { authClient } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/safe-redirect";
import { LoginFallback } from "./login-fallback";
import { LoginShell } from "./login-shell";

const TRIGGER_CLASS =
	"h-auto min-h-12 flex-1 whitespace-nowrap border-none px-0 font-semibold text-[15px] text-ink-muted hover:text-ink data-active:text-ink";

// Códigos que o Better Auth anexa ao `errorCallbackURL` do login social.
const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
	access_denied:
		"Login com Google cancelado. Tente de novo ou entre com e-mail e senha.",
	account_not_linked:
		"Este e-mail já tem cadastro com senha e ainda não foi confirmado. Entre com e-mail e senha ou confirme o e-mail antes de usar o Google.",
};
const GOOGLE_ERROR_FALLBACK =
	"Não foi possível entrar com o Google. Tente de novo ou entre com e-mail e senha.";

export function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [mode, setMode] = useState<"sign-in" | "sign-up">(() =>
		searchParams.get("modo") === "cadastro" ? "sign-up" : "sign-in"
	);
	const [isGooglePending, setIsGooglePending] = useState(false);
	const redirectTo = safeRedirect(searchParams.get("redirect"), "/dashboard");
	const googleErrorCode = searchParams.get("error");
	const googleError = googleErrorCode
		? (GOOGLE_ERROR_MESSAGES[googleErrorCode] ?? GOOGLE_ERROR_FALLBACK)
		: null;
	const { data: session, isPending } = authClient.useSession();

	useEffect(() => {
		if (session?.user) {
			router.replace(redirectTo as Route);
		}
	}, [session, router, redirectTo]);

	const handleGoogleSignIn = async () => {
		setIsGooglePending(true);
		try {
			const result = await authClient.signIn.social({
				callbackURL: redirectTo,
				errorCallbackURL: `/login?${new URLSearchParams({ redirect: redirectTo })}`,
				provider: "google",
			});

			if (result.error) {
				toast.error(result.error.message || result.error.statusText);
				setIsGooglePending(false);
			}
		} catch {
			toast.error("Não foi possível iniciar o login com Google.");
			setIsGooglePending(false);
		}
	};

	const signInForm = useForm({
		defaultValues: { email: "", password: "", rememberMe: true },
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
					rememberMe: value.rememberMe,
				},
				{
					onSuccess: () => {
						router.push(redirectTo as Route);
						toast.success("Login realizado com sucesso");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("E-mail inválido"),
				password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
				rememberMe: z.boolean(),
			}),
		},
	});

	const signUpForm = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			phone: "",
		},
		onSubmit: async ({ value }) => {
			const payload: {
				callbackURL: string;
				email: string;
				password: string;
				name: string;
				phone?: string;
			} = {
				callbackURL: redirectTo,
				email: value.email,
				password: value.password,
				name: value.name,
			};
			const phoneDigits = onlyDigits(value.phone);
			if (phoneDigits) {
				payload.phone = phoneDigits;
			}
			await authClient.signUp.email(payload, {
				onSuccess: () => {
					toast.success("Conta criada com sucesso");
					router.push(redirectTo as Route);
				},
				onError: (error) => {
					toast.error(error.error.message || error.error.statusText);
				},
			});
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "O nome deve ter no mínimo 2 caracteres"),
				email: z.email("E-mail inválido"),
				password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
				phone: z
					.string()
					.refine((v) => !v || onlyDigits(v).length >= 10, "Telefone inválido"),
			}),
		},
	});

	if (isPending || session?.user) {
		return <LoginFallback />;
	}

	return (
		<LoginShell>
			{googleError && (
				<div className="mb-6">
					<Notice tone="error">{googleError}</Notice>
				</div>
			)}
			<Tabs
				className="w-full gap-0"
				onValueChange={(v) => setMode(v as "sign-in" | "sign-up")}
				value={mode}
			>
				<TabsList className="w-full" variant="line">
					<TabsTrigger className={TRIGGER_CLASS} value="sign-in">
						Entrar
					</TabsTrigger>
					<TabsTrigger className={TRIGGER_CLASS} value="sign-up">
						Cadastrar
					</TabsTrigger>
				</TabsList>

				<TabsContent value="sign-in">
					<form
						aria-label="Entrar"
						className="flex flex-col gap-3.5 pt-8"
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							signInForm.handleSubmit();
						}}
					>
						<signInForm.Field name="email">
							{(field) => (
								<TextField
									field={field}
									label="E-mail"
									placeholder="seu@email.com"
									type="email"
								/>
							)}
						</signInForm.Field>

						<signInForm.Field name="password">
							{(field) => (
								<TextField
									field={field}
									label="Senha"
									placeholder="••••••••"
									type="password"
								/>
							)}
						</signInForm.Field>

						<div className="flex items-center justify-between">
							<signInForm.Field name="rememberMe">
								{(field) => (
									<label
										className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-ink"
										htmlFor="remember-me"
									>
										<Checkbox
											checked={field.state.value}
											id="remember-me"
											name={field.name}
											onCheckedChange={(checked) => field.handleChange(checked)}
										/>
										Lembrar de mim
									</label>
								)}
							</signInForm.Field>
							<Link
								className="flex min-h-11 items-center font-semibold text-[14px] text-ink-2 underline underline-offset-[3px] hover:text-ink"
								href={{ pathname: "/esqueci-senha" }}
							>
								Esqueci a senha
							</Link>
						</div>

						<signInForm.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{({ canSubmit, isSubmitting }) => (
								<AuthSubmitButton
									canSubmit={canSubmit}
									isSubmitting={isSubmitting}
									label="Entrar"
									pendingLabel="Entrando…"
								/>
							)}
						</signInForm.Subscribe>
					</form>
				</TabsContent>

				<TabsContent value="sign-up">
					<form
						aria-label="Criar conta"
						className="flex flex-col gap-3.5 pt-8"
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							signUpForm.handleSubmit();
						}}
					>
						<signUpForm.Field name="name">
							{(field) => (
								<TextField
									field={field}
									label="Nome completo"
									placeholder="João da Silva"
								/>
							)}
						</signUpForm.Field>

						<signUpForm.Field name="email">
							{(field) => (
								<TextField
									field={field}
									label="E-mail"
									placeholder="seu@email.com"
									type="email"
								/>
							)}
						</signUpForm.Field>

						<signUpForm.Field name="phone">
							{(field) => (
								<TextField
									field={field}
									inputMode="numeric"
									label="Telefone (opcional)"
									placeholder="(11) 99999-9999"
									transform={maskPhone}
								/>
							)}
						</signUpForm.Field>

						<signUpForm.Field name="password">
							{(field) => (
								<TextField
									field={field}
									label="Senha"
									placeholder="••••••••"
									type="password"
								/>
							)}
						</signUpForm.Field>

						<signUpForm.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{({ canSubmit, isSubmitting }) => (
								<AuthSubmitButton
									canSubmit={canSubmit}
									isSubmitting={isSubmitting}
									label="Criar conta"
									pendingLabel="Criando conta…"
								/>
							)}
						</signUpForm.Subscribe>
					</form>
				</TabsContent>
			</Tabs>

			<div className="my-5 flex items-center gap-3 text-[13px] text-ink-muted">
				<Separator className="flex-1" />
				ou
				<Separator className="flex-1" />
			</div>

			<EmachButton
				disabled={isGooglePending}
				full
				icon={
					<Image alt="" height={18} src="/images/logos/google.png" width={18} />
				}
				isLoading={isGooglePending}
				onClick={handleGoogleSignIn}
				variant="line"
			>
				{isGooglePending ? "Redirecionando..." : "Continuar com Google"}
			</EmachButton>
		</LoginShell>
	);
}
