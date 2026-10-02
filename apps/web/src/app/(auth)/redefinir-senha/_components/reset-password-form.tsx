"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { EmachLinkButton } from "@/components/emach-button";
import { authClient } from "@/lib/auth-client";
import { AuthColumn } from "../../_components/auth-column";

export function ResetPasswordForm() {
	const router = useRouter();
	const params = useSearchParams();
	const token = params.get("token") ?? "";

	const form = useForm({
		defaultValues: { password: "", confirm: "" },
		onSubmit: async ({ value }) => {
			if (!token) {
				toast.error("Token ausente ou inválido.");
				return;
			}
			await authClient.resetPassword(
				{ newPassword: value.password, token },
				{
					onSuccess: () => {
						toast.success("Senha redefinida. Faça login novamente.");
						router.push({
							pathname: "/login",
							query: { reset: "ok" },
						} as never);
					},
					onError: (error) => {
						toast.error(error.error.message || "Link inválido ou expirado.");
					},
				}
			);
		},
		validators: {
			onSubmit: z
				.object({
					password: z
						.string()
						.min(8, "A senha deve ter no mínimo 8 caracteres"),
					confirm: z.string(),
				})
				.refine((v) => v.password === v.confirm, {
					message: "As senhas não coincidem",
					path: ["confirm"],
				}),
		},
	});

	if (!token) {
		return (
			<AuthColumn
				lede="Este link está incompleto. Solicite um novo e-mail de redefinição."
				title="Link inválido"
			>
				<EmachLinkButton href="/esqueci-senha" variant="dark">
					Solicitar novo link
				</EmachLinkButton>
			</AuthColumn>
		);
	}

	return (
		<AuthColumn
			lede="Crie uma nova senha para sua conta."
			title="Redefinir senha"
		>
			<form
				className="flex flex-col gap-3.5"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="password">
					{(field) => (
						<label className="emach-field" htmlFor={field.name}>
							<span className="emach-field__label">Nova senha</span>
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
								<span className="emach-field__error" key={error?.message}>
									{error?.message}
								</span>
							))}
						</label>
					)}
				</form.Field>

				<form.Field name="confirm">
					{(field) => (
						<label className="emach-field" htmlFor={field.name}>
							<span className="emach-field__label">Confirmar senha</span>
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
							label="Redefinir senha"
							pendingLabel="Redefinindo…"
						/>
					)}
				</form.Subscribe>
			</form>
		</AuthColumn>
	);
}
