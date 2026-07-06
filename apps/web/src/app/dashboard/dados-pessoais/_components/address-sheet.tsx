"use client";

import type { ClientAddress } from "@emach/db/schema/client";
import { Button } from "@emach/ui/components/button";
import { Checkbox } from "@emach/ui/components/checkbox";
import { Input } from "@emach/ui/components/input";
import { Label } from "@emach/ui/components/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@emach/ui/components/sheet";
import { cn } from "@emach/ui/lib/utils";
import { onlyDigits } from "@emach/validators";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	createAddressAction,
	deleteAddressAction,
	updateAddressAction,
} from "@/app/dashboard/dados-pessoais/_actions/addresses";
import { useCepAutofill } from "@/lib/use-cep-autofill";
import {
	type AddressInput,
	addressInputSchema,
} from "@/lib/validators/address";

const RE_CEP = /^(\d{5})(\d)/;
const maskCep = (v: string): string => {
	const d = onlyDigits(v).slice(0, 8);
	return d.length > 5 ? d.replace(RE_CEP, "$1-$2") : d;
};

export type AddressSheetMode =
	| { kind: "create"; hasOthers: boolean }
	| { kind: "edit"; address: ClientAddress }
	| null;

interface AddressSheetProps {
	mode: AddressSheetMode;
	onClose: () => void;
}

const emptyDefaults: AddressInput = {
	label: "",
	zipCode: "",
	street: "",
	number: "",
	complement: "",
	neighborhood: "",
	city: "",
	state: "",
	isDefault: false,
};

function defaultsFor(mode: AddressSheetMode): AddressInput {
	if (mode?.kind === "edit") {
		const a = mode.address;
		return {
			label: a.label ?? "",
			zipCode: maskCep(a.zipCode),
			street: a.street,
			number: a.number,
			complement: a.complement ?? "",
			neighborhood: a.neighborhood,
			city: a.city,
			state: a.state,
			isDefault: a.isDefault,
		};
	}
	return emptyDefaults;
}

export function AddressSheet({ mode, onClose }: AddressSheetProps) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	useEffect(() => {
		if (mode === null) {
			setConfirmingDelete(false);
		}
	}, [mode]);

	const isEdit = mode?.kind === "edit";
	const showIsDefaultToggle =
		(mode?.kind === "create" && mode.hasOthers) ||
		(mode?.kind === "edit" && !mode.address.isDefault);

	const form = useForm({
		defaultValues: defaultsFor(mode),
		validators: { onSubmit: addressInputSchema },
		onSubmit: async ({ value }) => {
			const result = isEdit
				? await updateAddressAction({ id: mode.address.id, ...value })
				: await createAddressAction(value);

			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			toast.success(isEdit ? "Endereço atualizado" : "Endereço cadastrado");
			router.refresh();
			onClose();
		},
	});

	// Autofill por CEP (#191): preenche só o que veio não-vazio (CEP rural
	// pode não ter rua/bairro) — campos continuam editáveis.
	const cepAutofill = useCepAutofill((address) => {
		if (address.street) {
			form.setFieldValue("street", address.street);
		}
		if (address.neighborhood) {
			form.setFieldValue("neighborhood", address.neighborhood);
		}
		form.setFieldValue("city", address.city);
		form.setFieldValue("state", address.state);
	});

	const handleDelete = async () => {
		if (!isEdit) {
			return;
		}
		if (!confirmingDelete) {
			setConfirmingDelete(true);
			return;
		}
		setIsDeleting(true);
		const result = await deleteAddressAction({ id: mode.address.id });
		setIsDeleting(false);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		toast.success("Endereço removido");
		router.refresh();
		onClose();
	};

	return (
		<Sheet
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={mode !== null}
		>
			<SheetContent className="flex w-full flex-col gap-0 rounded-none sm:max-w-md">
				<SheetHeader className="border-border border-b p-6">
					<SheetTitle className="font-semibold text-[20px] text-near-black">
						{isEdit ? "Editar endereço" : "Novo endereço"}
					</SheetTitle>
					<SheetDescription className="text-[13px] text-gray-60">
						Preencha os dados de entrega.
					</SheetDescription>
				</SheetHeader>

				<form
					className="flex flex-1 flex-col overflow-y-auto"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<div className="space-y-4 p-6">
						<form.Field name="label">
							{(field) => (
								<FieldShell
									errors={field.state.meta.errors}
									htmlFor="label"
									label="Apelido (opcional)"
								>
									<Input
										className="mt-2 h-11 rounded-none"
										id="label"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Casa, Trabalho, Galpão..."
										value={field.state.value ?? ""}
									/>
								</FieldShell>
							)}
						</form.Field>

						<div className="grid grid-cols-[140px_1fr] gap-4">
							<form.Field name="zipCode">
								{(field) => (
									<div>
										<FieldShell
											errors={field.state.meta.errors}
											htmlFor="zipCode"
											label="CEP"
										>
											<Input
												aria-busy={cepAutofill.loading}
												className="mt-2 h-11 rounded-none"
												id="zipCode"
												onBlur={field.handleBlur}
												onChange={(e) => {
													const next = maskCep(e.target.value);
													field.handleChange(next);
													cepAutofill.maybeLookup(next);
												}}
												placeholder="00000-000"
												value={field.state.value}
											/>
										</FieldShell>
										{cepAutofill.loading ? (
											<p
												aria-live="polite"
												className="mt-1 text-muted-foreground text-xs"
											>
												Buscando endereço…
											</p>
										) : null}
										{cepAutofill.notFound ? (
											<p className="mt-1 text-destructive text-xs" role="alert">
												CEP não encontrado — confira o número antes de salvar
											</p>
										) : null}
									</div>
								)}
							</form.Field>
							<form.Field name="street">
								{(field) => (
									<FieldShell
										errors={field.state.meta.errors}
										htmlFor="street"
										label="Rua"
									>
										<Input
											className="mt-2 h-11 rounded-none"
											id="street"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="Rua das Ferramentas"
											value={field.state.value}
										/>
									</FieldShell>
								)}
							</form.Field>
						</div>

						<div className="grid grid-cols-[160px_1fr] gap-4">
							<form.Field name="number">
								{(field) => (
									<FieldShell
										errors={field.state.meta.errors}
										htmlFor="number"
										label="Número"
									>
										<Input
											className="mt-2 h-11 rounded-none"
											id="number"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="123"
											value={field.state.value}
										/>
									</FieldShell>
								)}
							</form.Field>
							<form.Field name="complement">
								{(field) => (
									<FieldShell
										errors={field.state.meta.errors}
										htmlFor="complement"
										label="Complemento"
									>
										<Input
											className="mt-2 h-11 rounded-none"
											id="complement"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="Apto 101 (opcional)"
											value={field.state.value}
										/>
									</FieldShell>
								)}
							</form.Field>
						</div>

						<form.Field name="neighborhood">
							{(field) => (
								<FieldShell
									errors={field.state.meta.errors}
									htmlFor="neighborhood"
									label="Bairro"
								>
									<Input
										className="mt-2 h-11 rounded-none"
										id="neighborhood"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Centro"
										value={field.state.value}
									/>
								</FieldShell>
							)}
						</form.Field>

						<div className="grid grid-cols-[1fr_120px] gap-4">
							<form.Field name="city">
								{(field) => (
									<FieldShell
										errors={field.state.meta.errors}
										htmlFor="city"
										label="Cidade"
									>
										<Input
											className="mt-2 h-11 rounded-none"
											id="city"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="São Paulo"
											value={field.state.value}
										/>
									</FieldShell>
								)}
							</form.Field>
							<form.Field name="state">
								{(field) => (
									<FieldShell
										errors={field.state.meta.errors}
										htmlFor="state"
										label="Estado"
									>
										<Input
											className="mt-2 h-11 rounded-none uppercase"
											id="state"
											maxLength={2}
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(e.target.value.toUpperCase())
											}
											placeholder="SP"
											value={field.state.value}
										/>
									</FieldShell>
								)}
							</form.Field>
						</div>

						{showIsDefaultToggle && (
							<form.Field name="isDefault">
								{(field) => (
									<label
										className="flex cursor-pointer items-center gap-3 pt-2 text-[14px] text-near-black"
										htmlFor="isDefault"
									>
										<Checkbox
											checked={field.state.value === true}
											id="isDefault"
											onCheckedChange={(v) => field.handleChange(v === true)}
										/>
										<span>Definir como endereço padrão</span>
									</label>
								)}
							</form.Field>
						)}
					</div>

					<SheetFooter className="border-border border-t p-6">
						<div className="flex w-full items-center justify-between gap-2">
							{isEdit ? (
								<Button
									className={cn(
										"rounded-none text-emach-red hover:bg-emach-red/5 hover:text-emach-red",
										confirmingDelete &&
											"bg-emach-red text-white hover:bg-emach-red/90 hover:text-white"
									)}
									disabled={isDeleting}
									onClick={handleDelete}
									type="button"
									variant={confirmingDelete ? "default" : "ghost"}
								>
									{deleteButtonLabel(isDeleting, confirmingDelete)}
								</Button>
							) : (
								<span />
							)}
							<div className="flex gap-2">
								<Button
									className="rounded-none"
									onClick={onClose}
									type="button"
									variant="outline"
								>
									Cancelar
								</Button>
								<form.Subscribe
									selector={(state) => ({
										canSubmit: state.canSubmit,
										isSubmitting: state.isSubmitting,
									})}
								>
									{({ canSubmit, isSubmitting }) => (
										<Button
											className="rounded-none bg-emach-red hover:bg-emach-red/90"
											disabled={!canSubmit || isSubmitting}
											type="submit"
										>
											{isSubmitting ? "Salvando..." : "Salvar"}
										</Button>
									)}
								</form.Subscribe>
							</div>
						</div>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}

interface FieldShellProps {
	children: React.ReactNode;
	errors: ReadonlyArray<{ message?: string } | undefined>;
	htmlFor: string;
	label: string;
}

function deleteButtonLabel(deleting: boolean, confirming: boolean): string {
	if (deleting) {
		return "Removendo...";
	}
	if (confirming) {
		return "Confirmar remoção";
	}
	return "Remover";
}

function FieldShell({ children, errors, htmlFor, label }: FieldShellProps) {
	const error = errors.find((e) => e?.message);
	return (
		<div>
			<Label
				className={cn(
					"font-display font-semibold text-[11px] uppercase tracking-[0.14em]",
					error ? "text-destructive" : "text-gray-60"
				)}
				htmlFor={htmlFor}
			>
				{label}
			</Label>
			{children}
			{error?.message ? (
				<p className="mt-1 text-[12px] text-destructive">{error.message}</p>
			) : null}
		</div>
	);
}
