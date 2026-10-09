"use client";

import type { ClientAddress } from "@emach/db/schema/client";
import { Checkbox } from "@emach/ui/components/checkbox";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@emach/ui/components/sheet";
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
import { EmachButton } from "@/components/emach-button";
import { errorMessages, Field, TextField } from "@/components/field";
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
			<SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
				<SheetHeader>
					<SheetTitle>
						{isEdit ? "Editar endereço" : "Novo endereço"}
					</SheetTitle>
					<SheetDescription>Preencha os dados de entrega.</SheetDescription>
				</SheetHeader>

				<form
					className="flex flex-1 flex-col overflow-y-auto"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<div className="space-y-4 px-5 py-5">
						<form.Field name="label">
							{(field) => (
								<Field
									error={errorMessages(field.state.meta.errors)}
									id="label"
									label="Apelido (opcional)"
								>
									{(control) => (
										<input
											{...control}
											className="emach-input"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="Casa, Trabalho, Galpão..."
											value={field.state.value ?? ""}
										/>
									)}
								</Field>
							)}
						</form.Field>

						<div className="grid grid-cols-[140px_1fr] gap-4">
							<form.Field name="zipCode">
								{(field) => (
									<div className="space-y-1">
										<Field
											error={errorMessages(field.state.meta.errors)}
											id="zipCode"
											label="CEP"
										>
											{(control) => (
												<input
													{...control}
													aria-busy={cepAutofill.loading}
													className="emach-input"
													inputMode="numeric"
													onBlur={field.handleBlur}
													onChange={(e) => {
														const next = maskCep(e.target.value);
														field.handleChange(next);
														cepAutofill.maybeLookup(next);
													}}
													placeholder="00000-000"
													value={field.state.value}
												/>
											)}
										</Field>
										{cepAutofill.loading ? (
											<p aria-live="polite" className="emach-field__hint">
												Buscando endereço…
											</p>
										) : null}
										{cepAutofill.notFound ? (
											<p className="emach-field__error" role="alert">
												CEP não encontrado. Confira o número antes de salvar.
											</p>
										) : null}
									</div>
								)}
							</form.Field>
							<form.Field name="street">
								{(field) => (
									<TextField
										field={field}
										label="Rua"
										placeholder="Rua das Ferramentas"
									/>
								)}
							</form.Field>
						</div>

						<div className="grid grid-cols-[140px_1fr] gap-4">
							<form.Field name="number">
								{(field) => (
									<TextField field={field} label="Número" placeholder="123" />
								)}
							</form.Field>
							<form.Field name="complement">
								{(field) => (
									<TextField
										field={field}
										label="Complemento"
										placeholder="Apto 101 (opcional)"
									/>
								)}
							</form.Field>
						</div>

						<form.Field name="neighborhood">
							{(field) => (
								<TextField field={field} label="Bairro" placeholder="Centro" />
							)}
						</form.Field>

						<div className="grid grid-cols-[1fr_100px] gap-4">
							<form.Field name="city">
								{(field) => (
									<TextField
										field={field}
										label="Cidade"
										placeholder="São Paulo"
									/>
								)}
							</form.Field>
							<form.Field name="state">
								{(field) => (
									<TextField
										className="uppercase"
										field={field}
										label="Estado"
										maxLength={2}
										placeholder="SP"
										transform={(raw) => raw.toUpperCase()}
									/>
								)}
							</form.Field>
						</div>

						{showIsDefaultToggle && (
							<form.Field name="isDefault">
								{(field) => (
									<label
										className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink"
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

					<SheetFooter className="border-line border-t bg-canteiro px-5">
						<div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
							{isEdit ? (
								<EmachButton
									disabled={isDeleting}
									isLoading={isDeleting}
									onClick={handleDelete}
									variant={confirmingDelete ? "danger" : "link"}
								>
									{deleteButtonLabel(isDeleting, confirmingDelete)}
								</EmachButton>
							) : (
								<span />
							)}
							<div className="flex items-center gap-4">
								<EmachButton onClick={onClose} variant="link">
									Cancelar
								</EmachButton>
								<form.Subscribe
									selector={(state) => ({
										canSubmit: state.canSubmit,
										isSubmitting: state.isSubmitting,
									})}
								>
									{({ canSubmit, isSubmitting }) => (
										<EmachButton
											disabled={!canSubmit || isSubmitting}
											isLoading={isSubmitting}
											type="submit"
											variant="dark"
										>
											{isSubmitting ? "Salvando..." : "Salvar"}
										</EmachButton>
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

function deleteButtonLabel(deleting: boolean, confirming: boolean): string {
	if (deleting) {
		return "Removendo...";
	}
	if (confirming) {
		return "Confirmar remoção";
	}
	return "Remover";
}
