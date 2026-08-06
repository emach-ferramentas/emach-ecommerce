"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { toast } from "sonner";
import z from "zod";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			await authClient.requestPasswordReset(
				{ email: value.email, redirectTo: "/redefinir-senha" },
				{
					onSuccess: () => {
						toast.success(
							"Se a conta existir, enviamos um link para redefinir sua senha."
						);
					},
					onError: () => {
						toast.success(
							"Se a conta existir, enviamos um link para redefinir sua senha."
						);
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("E-mail inválido"),
			}),
		},
	});

	return (
		<main className="flex min-h-svh items-center justify-center bg-gray-10 px-6 py-20">
			<div className="w-full max-w-[400px]">
				<h1 className="font-display font-medium text-[32px] text-near-black leading-tight">
					Esqueci a senha
				</h1>
				<p className="mt-3 text-[14px] text-gray-60">
					Informe seu e-mail. Se houver uma conta, enviaremos um link para
					redefinir sua senha.
				</p>

				<form
					className="mt-8 flex flex-col gap-3.5"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<form.Field name="email">
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
									<span className="emach-field__error" key={error?.message}>
										{error?.message}
									</span>
								))}
							</label>
						)}
					</form.Field>

					<form.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
						})}
					>
						{({ canSubmit, isSubmitting }) => (
							<AuthSubmitButton
								canSubmit={canSubmit}
								isSubmitting={isSubmitting}
								label="Enviar link"
								pendingLabel="Enviando…"
							/>
						)}
					</form.Subscribe>
				</form>

				<div className="mt-6 text-[13px]">
					<Link
						className="text-emach-red-hover hover:underline"
						href={{ pathname: "/login" }}
					>
						Voltar para o login
					</Link>
				</div>
			</div>
		</main>
	);
}
