"use client";

import type { ClientAddress } from "@emach/db/schema/client";
import { Button } from "@emach/ui/components/button";
import { Checkbox } from "@emach/ui/components/checkbox";
import { Input } from "@emach/ui/components/input";
import { Label } from "@emach/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@emach/ui/components/select";
import { Separator } from "@emach/ui/components/separator";
import { useForm } from "@tanstack/react-form";
import type { Route } from "next";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { createOrderAction } from "@/app/checkout/_actions/create-order";
import { useCart } from "@/lib/cart-context";
import { fmtBRL, numericToCents } from "@/lib/format";
import {
	isValidCpfCnpj,
	maskCpfCnpj,
	maskPhone,
	onlyDigits,
} from "@/lib/validators/cpf-cnpj";

const NEW_ADDRESS_ID = "__new__";
const FREE_SHIPPING_CENTS = 29_900;
const STANDARD_SHIPPING_CENTS = 2990;

const addressFieldsSchema = z.object({
	zipCode: z.string(),
	street: z.string(),
	number: z.string(),
	complement: z.string(),
	neighborhood: z.string(),
	city: z.string(),
	state: z.string(),
});

const checkoutSchema = z
	.object({
		name: z.string().min(2, "Nome é obrigatório"),
		email: z.email("E-mail inválido"),
		phone: z
			.string()
			.refine((v) => onlyDigits(v).length >= 10, "Telefone inválido"),
		document: z.string().refine(isValidCpfCnpj, "CPF ou CNPJ inválido"),
		addressId: z.string().min(1, "Selecione ou cadastre um endereço"),
		newAddress: addressFieldsSchema,
		acceptTos: z.literal(true, {
			error: () => ({ message: "Aceite os termos para continuar" }),
		}),
		acceptPrivacy: z.literal(true, {
			error: () => ({ message: "Aceite a política de privacidade" }),
		}),
		acceptMarketing: z.boolean(),
	})
	.superRefine((data, ctx) => {
		if (data.addressId !== NEW_ADDRESS_ID) {
			return;
		}
		const a = data.newAddress;
		if (onlyDigits(a.zipCode).length !== 8) {
			ctx.addIssue({
				code: "custom",
				path: ["newAddress", "zipCode"],
				message: "CEP inválido",
			});
		}
		if (a.street.trim().length < 2) {
			ctx.addIssue({
				code: "custom",
				path: ["newAddress", "street"],
				message: "Rua é obrigatória",
			});
		}
		if (a.number.trim().length < 1) {
			ctx.addIssue({
				code: "custom",
				path: ["newAddress", "number"],
				message: "Número é obrigatório",
			});
		}
		if (a.neighborhood.trim().length < 2) {
			ctx.addIssue({
				code: "custom",
				path: ["newAddress", "neighborhood"],
				message: "Bairro é obrigatório",
			});
		}
		if (a.city.trim().length < 2) {
			ctx.addIssue({
				code: "custom",
				path: ["newAddress", "city"],
				message: "Cidade é obrigatória",
			});
		}
		if (a.state.trim().length < 2) {
			ctx.addIssue({
				code: "custom",
				path: ["newAddress", "state"],
				message: "Estado é obrigatório",
			});
		}
	});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;

interface CheckoutContentProps {
	addresses: ClientAddress[];
	clientDocument: string | null;
	clientEmail: string;
	clientName: string;
	clientPhone: string;
}

export function CheckoutContent({
	addresses,
	clientDocument,
	clientEmail,
	clientName,
	clientPhone,
}: CheckoutContentProps) {
	const router = useRouter();
	const { items, clear } = useCart();
	const submittedRef = useRef(false);

	const defaultAddressId =
		addresses.find((a) => a.isDefault)?.id ??
		addresses[0]?.id ??
		NEW_ADDRESS_ID;

	useEffect(() => {
		if (items.length === 0 && !submittedRef.current) {
			router.replace("/cart");
		}
	}, [items.length, router]);

	const { orderItems, subtotal, shipping, total } = useMemo(() => {
		const sub = items.reduce(
			(sum, item) => sum + numericToCents(item.priceAmount) * item.quantity,
			0
		);
		const ship =
			sub >= FREE_SHIPPING_CENTS || sub === 0 ? 0 : STANDARD_SHIPPING_CENTS;
		return {
			orderItems: items,
			subtotal: sub,
			shipping: ship,
			total: sub + ship,
		};
	}, [items]);

	const form = useForm({
		defaultValues: {
			name: clientName,
			email: clientEmail,
			phone: clientPhone ? maskPhone(clientPhone) : "",
			document: clientDocument ? maskCpfCnpj(clientDocument) : "",
			addressId: defaultAddressId,
			newAddress: {
				zipCode: "",
				street: "",
				number: "",
				complement: "",
				neighborhood: "",
				city: "",
				state: "",
			},
			acceptTos: false as boolean,
			acceptPrivacy: false as boolean,
			acceptMarketing: false,
		},
		validators: {
			onSubmit: checkoutSchema,
		},
		onSubmit: async ({ value }) => {
			const result = await createOrderAction({
				name: value.name.trim(),
				email: value.email.trim().toLowerCase(),
				phone: onlyDigits(value.phone),
				document: onlyDigits(value.document),
				addressId: value.addressId === NEW_ADDRESS_ID ? null : value.addressId,
				newAddress:
					value.addressId === NEW_ADDRESS_ID
						? {
								zipCode: onlyDigits(value.newAddress.zipCode),
								street: value.newAddress.street.trim(),
								number: value.newAddress.number.trim(),
								complement: value.newAddress.complement.trim(),
								neighborhood: value.newAddress.neighborhood.trim(),
								city: value.newAddress.city.trim(),
								state: value.newAddress.state.trim().toUpperCase(),
							}
						: null,
				acceptMarketing: value.acceptMarketing,
				cartItems: items.map((i) => ({
					toolId: i.toolId,
					variantId: i.variantId,
					quantity: i.quantity,
					priceAmount: i.priceAmount,
				})),
				shippingAmount: (shipping / 100).toFixed(2),
			});

			if (!result.ok) {
				toast.error(result.error);
				return;
			}

			submittedRef.current = true;
			clear();
			toast.success(`Pedido ${result.orderNumber} confirmado`);
			router.push(`/pedidos/${result.orderNumber}` as Route);
		},
	});

	return (
		<div className="mx-auto max-w-6xl px-20 py-10">
			<div className="flex flex-row gap-15">
				<div className="flex-1">
					<h1 className="font-medium text-2xl">Dados Pessoais</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Confira seus dados e endereço de entrega
					</p>

					<form
						className="mt-8 space-y-6"
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="grid grid-cols-2 gap-4">
							<TextField
								form={form}
								label="Nome completo"
								name="name"
								placeholder="Maria da Silva"
							/>
							<TextField
								form={form}
								label="E-mail"
								name="email"
								placeholder="seu@email.com"
								type="email"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<form.Field name="phone">
								{(field) => (
									<FieldShell
										errors={field.state.meta.errors}
										htmlFor="phone"
										label="Telefone"
									>
										<Input
											className="mt-2 h-11 rounded-none"
											id="phone"
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(maskPhone(e.target.value))
											}
											placeholder="(11) 99999-9999"
											type="tel"
											value={field.state.value}
										/>
									</FieldShell>
								)}
							</form.Field>

							<form.Field name="document">
								{(field) => (
									<FieldShell
										errors={field.state.meta.errors}
										htmlFor="document"
										label="CPF ou CNPJ"
									>
										<Input
											className="mt-2 h-11 rounded-none"
											id="document"
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(maskCpfCnpj(e.target.value))
											}
											placeholder="000.000.000-00"
											value={field.state.value}
										/>
									</FieldShell>
								)}
							</form.Field>
						</div>

						<Separator />

						<h2 className="font-medium text-lg">Endereço de Entrega</h2>

						<form.Field name="addressId">
							{(field) => (
								<FieldShell
									errors={field.state.meta.errors}
									htmlFor="addressId"
									label="Endereço"
								>
									<Select
										onValueChange={(v) => field.handleChange(v ?? "")}
										value={field.state.value}
									>
										<SelectTrigger
											className="mt-2 h-11 w-full rounded-none"
											id="addressId"
										>
											<SelectValue placeholder="Selecione um endereço" />
										</SelectTrigger>
										<SelectContent>
											{addresses.map((addr) => (
												<SelectItem key={addr.id} value={addr.id}>
													{formatAddressLabel(addr)}
												</SelectItem>
											))}
											<SelectItem value={NEW_ADDRESS_ID}>
												+ Novo endereço
											</SelectItem>
										</SelectContent>
									</Select>
								</FieldShell>
							)}
						</form.Field>

						<form.Subscribe
							selector={(state) => state.values.addressId === NEW_ADDRESS_ID}
						>
							{(showNew) =>
								showNew ? (
									<div className="space-y-4 border border-border p-5">
										<div className="grid grid-cols-[140px_1fr] gap-4">
											<form.Field name="newAddress.zipCode">
												{(field) => (
													<FieldShell
														errors={field.state.meta.errors}
														htmlFor="zipCode"
														label="CEP"
													>
														<Input
															className="mt-2 h-11 rounded-none"
															id="zipCode"
															onBlur={field.handleBlur}
															onChange={(e) =>
																field.handleChange(
																	onlyDigits(e.target.value).slice(0, 8)
																)
															}
															placeholder="00000000"
															value={field.state.value}
														/>
													</FieldShell>
												)}
											</form.Field>
											<TextField
												form={form}
												label="Rua"
												name="newAddress.street"
												placeholder="Rua 21 de Abril"
											/>
										</div>
										<div className="grid grid-cols-[160px_1fr] gap-4">
											<TextField
												form={form}
												label="Número"
												name="newAddress.number"
												placeholder="123"
											/>
											<TextField
												form={form}
												label="Complemento"
												name="newAddress.complement"
												placeholder="Apto 101 (opcional)"
											/>
										</div>
										<TextField
											form={form}
											label="Bairro"
											name="newAddress.neighborhood"
											placeholder="Centro"
										/>
										<div className="grid grid-cols-[1fr_120px] gap-4">
											<TextField
												form={form}
												label="Cidade"
												name="newAddress.city"
												placeholder="São Paulo"
											/>
											<TextField
												form={form}
												label="Estado"
												name="newAddress.state"
												placeholder="SP"
											/>
										</div>
									</div>
								) : null
							}
						</form.Subscribe>

						<Separator />

						<div className="space-y-3">
							<form.Field name="acceptTos">
								{(field) => (
									<ConsentField
										checked={field.state.value === true}
										errors={field.state.meta.errors}
										id="acceptTos"
										label="Li e aceito os Termos de Uso"
										onChange={(v) => field.handleChange(v)}
										required
									/>
								)}
							</form.Field>
							<form.Field name="acceptPrivacy">
								{(field) => (
									<ConsentField
										checked={field.state.value === true}
										errors={field.state.meta.errors}
										id="acceptPrivacy"
										label="Li e aceito a Política de Privacidade"
										onChange={(v) => field.handleChange(v)}
										required
									/>
								)}
							</form.Field>
							<form.Field name="acceptMarketing">
								{(field) => (
									<ConsentField
										checked={field.state.value}
										errors={field.state.meta.errors}
										id="acceptMarketing"
										label="Quero receber ofertas e novidades por e-mail"
										onChange={(v) => field.handleChange(v)}
									/>
								)}
							</form.Field>
						</div>

						<div className="flex items-center justify-between pt-4">
							<Button
								className="h-12 rounded-none"
								nativeButton={false}
								render={<Link href="/cart" />}
								variant="outline"
							>
								Voltar ao Carrinho
							</Button>
							<form.Subscribe
								selector={(state) => ({
									canSubmit: state.canSubmit,
									isSubmitting: state.isSubmitting,
								})}
							>
								{({ canSubmit, isSubmitting }) => (
									<Button
										className="h-12 rounded-none"
										disabled={!canSubmit || isSubmitting}
										type="submit"
									>
										{isSubmitting ? "Processando..." : "Confirmar pedido"}
									</Button>
								)}
							</form.Subscribe>
						</div>
					</form>
				</div>

				<div className="w-[380px]">
					<div className="sticky top-10 space-y-4 border border-border p-6">
						<h2 className="font-display font-semibold text-xs uppercase tracking-wider">
							Resumo do Pedido
						</h2>
						<Separator />

						{orderItems.map((item) => (
							<div className="flex gap-4" key={item.variantId}>
								<div className="relative size-16 shrink-0 overflow-hidden bg-muted">
									{item.imageUrl ? (
										<NextImage
											alt={item.name}
											className="object-cover"
											fill
											sizes="64px"
											src={item.imageUrl}
										/>
									) : (
										<div className="absolute inset-0 bg-(--gray-10)" />
									)}
								</div>
								<div className="flex-1 text-sm">
									<p className="font-medium">{item.name}</p>
									<p className="text-muted-foreground">Qtd: {item.quantity}</p>
								</div>
								<span className="font-medium text-sm">
									{fmtBRL(numericToCents(item.priceAmount) * item.quantity)}
								</span>
							</div>
						))}

						<Separator />

						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Subtotal</span>
								<span>{fmtBRL(subtotal)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Frete</span>
								<span>{shipping === 0 ? "Grátis" : fmtBRL(shipping)}</span>
							</div>
						</div>

						<Separator />

						<div className="flex justify-between font-bold text-base">
							<span>Total</span>
							<span>{fmtBRL(total)}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function formatAddressLabel(addr: ClientAddress): string {
	const parts = [
		`${addr.street}, ${addr.number}`,
		addr.neighborhood,
		`${addr.city}/${addr.state}`,
	];
	const label = addr.label ? `${addr.label} — ` : "";
	const def = addr.isDefault ? " ★" : "";
	return `${label}${parts.join(" · ")}${def}`;
}

interface FieldShellProps {
	children: React.ReactNode;
	errors: ReadonlyArray<{ message?: string } | undefined>;
	htmlFor: string;
	label: string;
}

function FieldShell({ children, errors, htmlFor, label }: FieldShellProps) {
	return (
		<div>
			<Label
				className="font-display text-xs uppercase tracking-wider"
				htmlFor={htmlFor}
			>
				{label}
			</Label>
			{children}
			{errors.map((error, idx) =>
				error?.message ? (
					<p
						className="mt-1 text-destructive text-xs"
						key={`${error.message}-${idx}`}
					>
						{error.message}
					</p>
				) : null
			)}
		</div>
	);
}

interface TextFieldProps {
	// biome-ignore lint/suspicious/noExplicitAny: tanstack form generic
	form: any;
	label: string;
	name: string;
	placeholder?: string;
	type?: string;
}

function TextField({ form, label, name, placeholder, type }: TextFieldProps) {
	return (
		<form.Field name={name}>
			{(field: {
				state: {
					value: string;
					meta: {
						errors: ReadonlyArray<{ message?: string } | undefined>;
					};
				};
				handleBlur: () => void;
				handleChange: (v: string) => void;
			}) => (
				<FieldShell
					errors={field.state.meta.errors}
					htmlFor={name}
					label={label}
				>
					<Input
						className="mt-2 h-11 rounded-none"
						id={name}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						placeholder={placeholder}
						type={type}
						value={field.state.value}
					/>
				</FieldShell>
			)}
		</form.Field>
	);
}

interface ConsentFieldProps {
	checked: boolean;
	errors: ReadonlyArray<{ message?: string } | undefined>;
	id: string;
	label: string;
	onChange: (v: boolean) => void;
	required?: boolean;
}

function ConsentField({
	checked,
	errors,
	id,
	label,
	onChange,
	required = false,
}: ConsentFieldProps) {
	const [touched, setTouched] = useState(false);
	return (
		<div>
			<label
				className="flex cursor-pointer items-center gap-3 text-sm"
				htmlFor={id}
			>
				<Checkbox
					checked={checked}
					id={id}
					onCheckedChange={(v) => {
						setTouched(true);
						onChange(v === true);
					}}
				/>
				<span>
					{label}
					{required && <span className="ml-1 text-destructive">*</span>}
				</span>
			</label>
			{touched &&
				errors.map((error, idx) =>
					error?.message ? (
						<p
							className="mt-1 text-destructive text-xs"
							key={`${error.message}-${idx}`}
						>
							{error.message}
						</p>
					) : null
				)}
		</div>
	);
}
