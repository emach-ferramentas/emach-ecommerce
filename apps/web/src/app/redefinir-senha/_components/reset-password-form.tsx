"use client";

import { cn } from "@emach/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";

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
			<main className="flex min-h-svh items-center justify-center bg-white px-6 py-20">
				<div className="w-full max-w-[400px]">
					<h1 className="font-display font-medium text-[32px] text-near-black leading-tight">
						Link inválido
					</h1>
					<p className="mt-3 text-[14px] text-gray-50">
						Este link está incompleto. Solicite um novo e-mail de redefinição.
					</p>
					<Link
						className="mt-6 inline-block text-[13px] text-emach-red hover:underline"
						href={{ pathname: "/esqueci-senha" }}
					>
						Solicitar novo link
					</Link>
				</div>
			</main>
		);
	}

	return (
		<main className="flex min-h-svh items-center justify-center bg-white px-6 py-20">
			<div className="w-full max-w-[400px]">
				<h1 className="font-display font-medium text-[32px] text-near-black leading-tight">
					Redefinir senha
				</h1>
				<p className="mt-3 text-[14px] text-gray-50">
					Crie uma nova senha para sua conta.
				</p>

				<form
					className="mt-8 flex flex-col gap-3.5"
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
							<button
								className={cn(
									"mt-2 w-full cursor-pointer rounded-[2px] border-0 bg-emach-red py-3 font-semibold text-[14px] text-white transition-all duration-180",
									canSubmit ? "opacity-100" : "opacity-65"
								)}
								disabled={!canSubmit || isSubmitting}
								type="submit"
							>
								{isSubmitting ? "Redefinindo…" : "Redefinir senha"}
							</button>
						)}
					</form.Subscribe>
				</form>
			</div>
		</main>
	);
}
