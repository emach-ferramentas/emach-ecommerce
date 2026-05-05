"use client";

import { Button } from "@emach/ui/components/button";
import { Separator } from "@emach/ui/components/separator";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@emach/ui/components/tabs";
import { cn } from "@emach/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import { maskPhone, onlyDigits } from "@/lib/validators/cpf-cnpj";

const TRIGGER_CLASS =
	"h-auto flex-1 whitespace-nowrap border-none px-0 py-3.5 font-semibold text-[14px] text-gray-50 hover:text-near-black data-active:text-near-black focus-visible:ring-0 focus-visible:border-transparent";

export default function LoginPage() {
	const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
	const [isGooglePending, setIsGooglePending] = useState(false);
	const router = useRouter();
	const { isPending } = authClient.useSession();

	const handleGoogleSignIn = async () => {
		setIsGooglePending(true);
		try {
			const result = await authClient.signIn.social({
				callbackURL: "/dashboard",
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
						router.push("/dashboard");
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
					toast.success(
						"Conta criada. Verifique seu e-mail para ativar a conta."
					);
					setMode("sign-in");
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

	if (isPending) {
		return (
			<main className="flex h-svh items-center justify-center bg-near-black">
				<Loader />
			</main>
		);
	}

	const isSignIn = mode === "sign-in";

	return (
		<main className="grid min-h-svh grid-cols-[6fr_4fr]">
			{/* Left — cinematic dark panel */}
			<div className="relative isolate flex flex-col justify-between overflow-hidden bg-[#0d0d0d] px-[80px] py-20 text-white">
				{/* Key light — Ferrari Red, bottom-left */}
				<div
					aria-hidden="true"
					className="emach-bg-login-key pointer-events-none absolute bottom-[-30%] left-[-20%] z-0 h-[90%] w-[90%]"
				/>
				{/* Rim light — Deep Red, top-right */}
				<div
					aria-hidden="true"
					className="emach-bg-login-rim pointer-events-none absolute top-[-20%] right-[-15%] z-0 h-[60%] w-[60%]"
				/>
				{/* Atmospheric vignette */}
				<div
					aria-hidden="true"
					className="emach-bg-login-vignette pointer-events-none absolute inset-0 z-1"
				/>

				<span className="relative z-2 font-display font-semibold text-[12px] text-white/65 uppercase tracking-[0.2em]">
					EMACH Profissional
				</span>

				<div className="relative z-2 max-w-[580px]">
					{isSignIn ? (
						<h2 className="font-display font-medium text-[clamp(48px,5.5vw,78px)] leading-[0.98] tracking-[-0.02em]">
							Acesse sua
							<br />
							<span className="text-emach-red">conta</span>.
						</h2>
					) : (
						<h2 className="font-display font-medium text-[clamp(48px,5.5vw,78px)] leading-[0.98] tracking-[-0.02em]">
							Crie sua
							<br />
							conta <span className="text-emach-red">EMACH</span>.
						</h2>
					)}
					<p className="mt-6 max-w-[440px] text-[15px] text-white/70 leading-relaxed">
						{isSignIn
							? "Acompanhe pedidos, gerencie endereços e desbloqueie descontos exclusivos para profissionais cadastrados."
							: "Cadastre-se para acompanhar pedidos, gerenciar endereços e acessar descontos exclusivos para profissionais."}
					</p>
				</div>

				<div className="relative z-2 font-display font-semibold text-[11px] text-white/40 uppercase tracking-[0.2em]">
					© 2026 EMACH FERRAMENTAS
				</div>
			</div>

			{/* Right — white form panel */}
			<div className="flex items-center justify-center bg-white px-[60px] py-20">
				<div className="w-full max-w-[400px]">
					<Tabs
						className="mb-8 gap-0"
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
											{field.state.meta.errors.map((error) => (
												<span
													className="emach-field__error"
													key={error?.message}
												>
													{error?.message}
												</span>
											))}
										</label>
									)}
								</signInForm.Field>

								<signInForm.Field name="password">
									{(field) => (
										<label className="emach-field" htmlFor={field.name}>
											<span className="emach-field__label">Senha</span>
											<input
												className="emach-input"
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="••••••••"
												type="password"
												value={field.state.value}
											/>
											{field.state.meta.errors.map((error) => (
												<span
													className="emach-field__error"
													key={error?.message}
												>
													{error?.message}
												</span>
											))}
										</label>
									)}
								</signInForm.Field>

								<div className="flex items-center justify-between">
									<label className="emach-check-label flex items-center gap-2 text-sm">
										<input className="emach-check" type="checkbox" />
										Lembrar de mim
									</label>
									<Link
										className="emach-ghost-btn font-semibold text-emach-red text-sm"
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
										<button
											className={cn(
												"mt-2 w-full cursor-pointer rounded-[2px] border-0 bg-emach-red py-3 font-semibold text-[14px] text-white transition-all duration-180",
												canSubmit ? "opacity-100" : "opacity-65"
											)}
											disabled={!canSubmit || isSubmitting}
											type="submit"
										>
											{isSubmitting ? "Entrando…" : "Entrar"}
										</button>
									)}
								</signInForm.Subscribe>
							</form>
						</TabsContent>

						<TabsContent value="sign-up">
							<form
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
											{field.state.meta.errors.map((error) => (
												<span
													className="emach-field__error"
													key={error?.message}
												>
													{error?.message}
												</span>
											))}
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
											{field.state.meta.errors.map((error) => (
												<span
													className="emach-field__error"
													key={error?.message}
												>
													{error?.message}
												</span>
											))}
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
											{field.state.meta.errors.map((error) => (
												<span
													className="emach-field__error"
													key={error?.message}
												>
													{error?.message}
												</span>
											))}
										</label>
									)}
								</signUpForm.Field>

								<signUpForm.Field name="password">
									{(field) => (
										<label className="emach-field" htmlFor={field.name}>
											<span className="emach-field__label">Senha</span>
											<input
												className="emach-input"
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="••••••••"
												type="password"
												value={field.state.value}
											/>
											{field.state.meta.errors.map((error) => (
												<span
													className="emach-field__error"
													key={error?.message}
												>
													{error?.message}
												</span>
											))}
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
										<button
											className={cn(
												"mt-2 w-full cursor-pointer rounded-[2px] border-0 bg-emach-red py-3 font-semibold text-[14px] text-white transition-all duration-180",
												canSubmit ? "opacity-100" : "opacity-65"
											)}
											disabled={!canSubmit || isSubmitting}
											type="submit"
										>
											{isSubmitting ? "Criando conta…" : "Criar conta"}
										</button>
									)}
								</signUpForm.Subscribe>
							</form>
						</TabsContent>
					</Tabs>

					{/* Divider */}
					<div className="my-7 flex items-center gap-3 text-[12px] text-gray-50">
						<Separator className="flex-1" />
						ou
						<Separator className="flex-1" />
					</div>

					{/* Social login */}
					<div className="flex flex-col gap-2">
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
