"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { toast } from "sonner";
import z from "zod";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { TextField } from "@/components/field";
import { authClient } from "@/lib/auth-client";
import { AuthColumn } from "../_components/auth-column";

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
		<AuthColumn
			lede="Informe seu e-mail. Se houver uma conta, enviaremos um link para redefinir sua senha."
			title="Esqueci a senha"
		>
			<form
				className="flex flex-col gap-3.5"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="email">
					{(field) => (
						<TextField
							field={field}
							label="E-mail"
							placeholder="seu@email.com"
							type="email"
						/>
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

			<div className="mt-6">
				<Link
					className="font-semibold text-[14px] text-ink-2 underline underline-offset-[3px] hover:text-ink"
					href={{ pathname: "/login" }}
				>
					Voltar para o login
				</Link>
			</div>
		</AuthColumn>
	);
}
