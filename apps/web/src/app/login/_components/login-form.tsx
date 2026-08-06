"use client";

import { Button } from "@emach/ui/components/button";
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
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import { LoginBrandPanel } from "./login-brand-panel";
import { PasswordInput } from "./password-input";

const TRIGGER_CLASS =
	"h-auto flex-1 whitespace-nowrap border-none px-0 py-3.5 font-semibold text-[14px] text-gray-60 hover:text-near-black data-active:text-near-black focus-visible:ring-0 focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emach-red";

function sanitizeRedirect(raw: string | null): string {
	if (!raw?.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
		return "/dashboard";
	}
	return raw;
}

export function LoginForm() {
	const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
	const [isGooglePending, setIsGooglePending] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectTo = sanitizeRedirect(searchParams.get("redirect"));
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
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{ email: value.email, password: value.password },
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
				email: string;
				password: string;
				name: string;
				phone?: string;
			} = {
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
		return (
			<main className="flex h-svh items-center justify-center bg-near-black">
				<Loader />
			</main>
		);
	}

	return (
		<main className="grid min-h-svh grid-cols-1 lg:grid-cols-[6fr_4fr]">
			<LoginBrandPanel />

			<div className="flex items-center justify-center bg-gray-10 px-6 py-12 sm:px-10 sm:py-16 lg:py-20">
				<div className="flex w-full flex-col items-center justify-center md:w-2/3">
					{/* Logo vermelho acima do form — só no mobile (no desktop o logo vive no painel esquerdo) */}
					<Image
						alt="EMACH"
						className="mb-8 h-9 w-auto lg:hidden"
						height={377}
						priority
						src="/emach-logo-red.svg"
						width={2041}
					/>
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
										<label className="emach-field" htmlFor={field.name}>
											<span className="emach-field__label">E-mail</span>
											<input
												className="emach-input"
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="seu@email.com"
												type="email"
												value={field.state.value}
											/>
											<div aria-atomic="true" aria-live="polite">
												{field.state.meta.errors.map((error) => (
													<span
														className="emach-field__error"
														key={error?.message}
													>
														{error?.message}
													</span>
												))}
											</div>
										</label>
									)}
								</signInForm.Field>

								<signInForm.Field name="password">
									{(field) => (
										<label className="emach-field" htmlFor={field.name}>
											<span className="emach-field__label">Senha</span>
											<PasswordInput
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={field.handleChange}
												placeholder="••••••••"
												value={field.state.value}
											/>
											<div aria-atomic="true" aria-live="polite">
												{field.state.meta.errors.map((error) => (
													<span
														className="emach-field__error"
														key={error?.message}
													>
														{error?.message}
													</span>
												))}
											</div>
										</label>
									)}
								</signInForm.Field>

								<div className="flex items-center justify-between">
									<label
										className="flex cursor-pointer items-center gap-2 text-sm"
										htmlFor="remember-me"
									>
										<Checkbox id="remember-me" />
										Lembrar de mim
									</label>
									<Link
										className="emach-ghost-btn font-semibold text-emach-red-hover text-sm"
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
										<label className="emach-field" htmlFor={field.name}>
											<span className="emach-field__label">Nome completo</span>
											<input
												className="emach-input"
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="João da Silva"
												value={field.state.value}
											/>
											<div aria-atomic="true" aria-live="polite">
												{field.state.meta.errors.map((error) => (
													<span
														className="emach-field__error"
														key={error?.message}
													>
														{error?.message}
													</span>
												))}
											</div>
										</label>
									)}
								</signUpForm.Field>

								<signUpForm.Field name="email">
									{(field) => (
										<label className="emach-field" htmlFor={field.name}>
											<span className="emach-field__label">E-mail</span>
											<input
												className="emach-input"
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="seu@email.com"
												type="email"
												value={field.state.value}
											/>
											<div aria-atomic="true" aria-live="polite">
												{field.state.meta.errors.map((error) => (
													<span
														className="emach-field__error"
														key={error?.message}
													>
														{error?.message}
													</span>
												))}
											</div>
										</label>
									)}
								</signUpForm.Field>

								<signUpForm.Field name="phone">
									{(field) => (
										<label className="emach-field" htmlFor={field.name}>
											<span className="emach-field__label">
												Telefone (opcional)
											</span>
											<input
												className="emach-input"
												id={field.name}
												inputMode="numeric"
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) =>
													field.handleChange(maskPhone(e.target.value))
												}
												placeholder="(11) 99999-9999"
												value={field.state.value}
											/>
											<div aria-atomic="true" aria-live="polite">
												{field.state.meta.errors.map((error) => (
													<span
														className="emach-field__error"
														key={error?.message}
													>
														{error?.message}
													</span>
												))}
											</div>
										</label>
									)}
								</signUpForm.Field>

								<signUpForm.Field name="password">
									{(field) => (
										<label className="emach-field" htmlFor={field.name}>
											<span className="emach-field__label">Senha</span>
											<PasswordInput
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={field.handleChange}
												placeholder="••••••••"
												value={field.state.value}
											/>
											<div aria-atomic="true" aria-live="polite">
												{field.state.meta.errors.map((error) => (
													<span
														className="emach-field__error"
														key={error?.message}
													>
														{error?.message}
													</span>
												))}
											</div>
										</label>
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

					{/* Divider */}
					<div className="my-5 flex items-center gap-3 text-[12px] text-gray-60">
						<Separator className="flex-1" />
						ou
						<Separator className="flex-1" />
					</div>

					{/* Social login */}
					<div className="flex w-full flex-col gap-2">
						<Button
							className="h-12 w-full"
							disabled={isGooglePending}
							onClick={handleGoogleSignIn}
							type="button"
							variant="outline"
						>
							<Image
								alt=""
								height={18}
								src="/images/logos/google.png"
								width={18}
							/>
							{isGooglePending ? "Redirecionando..." : "Continuar com Google"}
						</Button>
					</div>
				</div>
			</div>
		</main>
	);
}
