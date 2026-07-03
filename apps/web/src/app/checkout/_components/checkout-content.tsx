"use client";

import type { ClientAddress } from "@emach/db/schema/client";
import { Checkbox } from "@emach/ui/components/checkbox";
import { Separator } from "@emach/ui/components/separator";
import {
	isValidCpfCnpj,
	maskCpfCnpj,
	maskPhone,
	onlyDigits,
	onlyLetters,
} from "@emach/validators";
import { revalidateLogic, useForm, useStore } from "@tanstack/react-form";
import type { Route } from "next";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { createOrderAction } from "@/app/checkout/_actions/create-order";
import { quoteShippingAction } from "@/app/checkout/_actions/quote-shipping";
import { revalidateCartAction } from "@/app/checkout/_actions/revalidate-cart";
import { CouponField } from "@/app/checkout/_components/coupon-field";
import {
	ShippingOptions,
	type ShippingStatus,
} from "@/app/checkout/_components/shipping-options";
import { EmachButton, emachButtonVariants } from "@/components/emach-button";
import { authClient } from "@/lib/auth-client";
import { useCart } from "@/lib/cart-context";
import { fmtBRL, numericToCents } from "@/lib/format";
import type { ShippingOption } from "@/lib/shipping/types";
import { useCepAutofill } from "@/lib/use-cep-autofill";
import { addressFieldsSchema } from "@/lib/validators/address";

const NEW_ADDRESS_ID = "__new__";

const formatUf = (raw: string): string =>
	onlyLetters(raw).toUpperCase().slice(0, 2);

const newAddressFormShape = z.object({
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
		newAddress: newAddressFormShape,
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
		const result = addressFieldsSchema.safeParse(data.newAddress);
		if (result.success) {
			return;
		}
		for (const issue of result.error.issues) {
			ctx.addIssue({
				code: "custom",
				path: ["newAddress", ...issue.path],
				message: issue.message,
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
	emailVerified: boolean;
}

export function CheckoutContent({
	addresses,
	clientDocument,
	clientEmail,
	clientName,
	clientPhone,
	emailVerified,
}: CheckoutContentProps) {
	const router = useRouter();
	const { items, clear, reconcile, hydrated } = useCart();
	const submittedRef = useRef(false);
	const revalidatedRef = useRef(false);
	const [resendingVerification, setResendingVerification] = useState(false);

	const [shippingStatus, setShippingStatus] = useState<ShippingStatus>("idle");
	const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
	const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(
		null
	);
	const [destinationCep, setDestinationCep] = useState("");
	const [quoteNonce, setQuoteNonce] = useState(0);

	const selectedShippingCents =
		shippingOptions.find((o) => o.carrierId === selectedCarrierId)
			?.priceCents ?? null;

	const defaultAddressId =
		addresses.find((a) => a.isDefault)?.id ??
		addresses[0]?.id ??
		NEW_ADDRESS_ID;

	useEffect(() => {
		// Só redireciona depois do carrinho hidratar do localStorage — senão o
		// primeiro render (items=[] antes da hidratação) jogaria pro /cart mesmo
		// com itens salvos, quebrando o acesso direto / refresh do checkout.
		if (hydrated && items.length === 0 && !submittedRef.current) {
			router.replace("/cart");
		}
	}, [hydrated, items.length, router]);

	// Revalida os preços do carrinho ao entrar no checkout: o snapshot do
	// localStorage pode estar defasado (ex.: auto-promo expirou após adicionar ao
	// carrinho). Reconcilia display + snapshot silenciosamente, alinhando ao que o
	// place-order vai aceitar. Roda uma única vez (guard via ref → sem loop, mesmo
	// com `items` na dep array após o reconcile).
	useEffect(() => {
		if (revalidatedRef.current || items.length === 0) {
			return;
		}
		revalidatedRef.current = true;
		(async () => {
			const result = await revalidateCartAction({
				cartItems: items.map((i) => ({
					toolId: i.toolId,
					variantId: i.variantId,
				})),
			});
			if (result.ok) {
				const fresh = new Map(
					result.prices.map((p) => [
						p.variantId,
						(p.finalPriceCents / 100).toFixed(2),
					])
				);
				reconcile(fresh);
			}
		})();
	}, [items, reconcile]);

	// React Compiler memoiza derivações automaticamente — sem useMemo manual.
	const orderItems = items;
	const subtotal = items.reduce(
		(sum, item) => sum + numericToCents(item.priceAmount) * item.quantity,
		0
	);

	const shipping = selectedShippingCents ?? 0;
	const [coupon, setCoupon] = useState<{
		code: string;
		discountCents: number;
	} | null>(null);
	const discount = coupon?.discountCents ?? 0;
	const total = Math.max(0, subtotal - discount + shipping);

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
		validationLogic: revalidateLogic(),
		validators: {
			onDynamic: checkoutSchema,
		},
		onSubmit: async ({ value }) => {
			if (selectedShippingCents === null) {
				toast.error("Selecione uma opção de frete");
				return;
			}
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
				shippingAmount: (selectedShippingCents / 100).toFixed(2),
				shippingServiceCode: selectedCarrierId ?? undefined,
				couponCode: coupon?.code,
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

	// Autofill por CEP (#191): preenche só o que a Frenet devolveu não-vazio
	// (CEP rural pode vir sem rua/bairro) — campos continuam editáveis.
	const cepAutofill = useCepAutofill((address) => {
		if (address.street) {
			form.setFieldValue("newAddress.street", address.street);
		}
		if (address.neighborhood) {
			form.setFieldValue("newAddress.neighborhood", address.neighborhood);
		}
		form.setFieldValue("newAddress.city", address.city);
		form.setFieldValue("newAddress.state", address.state);
	});

	const watchedAddressId = useStore(form.store, (s) => s.values.addressId);
	const watchedNewCep = useStore(
		form.store,
		(s) => s.values.newAddress.zipCode
	);
	useEffect(() => {
		const saved = addresses.find((a) => a.id === watchedAddressId);
		const cepRaw =
			watchedAddressId === NEW_ADDRESS_ID
				? watchedNewCep
				: (saved?.zipCode ?? "");
		setDestinationCep(onlyDigits(cepRaw).slice(0, 8));
	}, [watchedAddressId, watchedNewCep, addresses]);

	useEffect(() => {
		if (destinationCep.length !== 8 || items.length === 0) {
			setShippingStatus("idle");
			setShippingOptions([]);
			setSelectedCarrierId(null);
			return;
		}
		let cancelled = false;
		setShippingStatus("loading");
		const handle = setTimeout(async () => {
			const result = await quoteShippingAction({
				destinationCep,
				items: items.map((i) => ({ toolId: i.toolId, quantity: i.quantity })),
				declaredValueCents: subtotal,
			});
			if (cancelled) {
				return;
			}
			if (result.ok) {
				setShippingOptions(result.options);
				setSelectedCarrierId(result.options[0]?.carrierId ?? null);
				setShippingStatus(result.negotiate ? "negotiate" : "ready");
			} else {
				setShippingOptions([]);
				setSelectedCarrierId(null);
				setShippingStatus("error");
			}
		}, 600);
		return () => {
			cancelled = true;
			clearTimeout(handle);
		};
	}, [destinationCep, items, quoteNonce]);

	// Reenvia o e-mail de verificação (#93). Replica o fluxo do cadastro; o
	// callbackURL traz o cliente de volta ao checkout após confirmar. O botão é
	// `disabled` durante o envio (sem guard manual); try/finally garante que o
	// estado de loading se solta mesmo se sendVerificationEmail lançar.
	const handleResendVerification = async () => {
		setResendingVerification(true);
		try {
			const { error } = await authClient.sendVerificationEmail({
				email: clientEmail,
				callbackURL: "/checkout",
			});
			if (error) {
				toast.error("Não foi possível reenviar agora. Tente novamente.");
				return;
			}
			toast.success(
				"E-mail de confirmação reenviado. Verifique sua caixa de entrada."
			);
		} finally {
			setResendingVerification(false);
		}
	};

	return (
		<div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
			<div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
				<div>
					<h1 className="font-display font-medium text-[28px] tracking-[-0.01em]">
						Dados Pessoais
					</h1>
					<p className="mt-1 text-gray-60 text-sm">
						Confira seus dados e endereço de entrega
					</p>

					{emailVerified ? null : (
						<div className="mt-6 flex flex-col gap-3 border border-gray-20 p-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="font-semibold text-near-black text-sm">
									Confirme seu e-mail para finalizar o pedido
								</p>
								<p className="mt-0.5 text-gray-60 text-sm">
									Enviamos um link de confirmação para {clientEmail}.
								</p>
							</div>
							<EmachButton
								className="shrink-0"
								disabled={resendingVerification}
								onClick={handleResendVerification}
								size="sm"
								type="button"
								variant="outline"
							>
								{resendingVerification ? "Enviando…" : "Reenviar e-mail"}
							</EmachButton>
						</div>
					)}

					<form
						className="mt-8 space-y-6"
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<TextField
								autoComplete="name"
								form={form}
								label="Nome completo"
								name="name"
								placeholder="Maria da Silva"
								transform={onlyLetters}
							/>
							<TextField
								autoComplete="email"
								form={form}
								label="E-mail"
								name="email"
								placeholder="seu@email.com"
								type="email"
							/>
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<form.Field name="phone">
								{(field) => (
									<FieldShell
										errors={field.state.meta.errors}
										htmlFor="phone"
										label="Telefone"
									>
										<input
											autoComplete="tel"
											className="emach-input"
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
										<input
											autoComplete="off"
											className="emach-input"
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

						<h2 className="font-display font-medium text-xl tracking-[-0.01em]">
							Endereço de Entrega
						</h2>

						<form.Field name="addressId">
							{(field) => (
								<FieldShell
									errors={field.state.meta.errors}
									htmlFor="addressId"
									label="Endereço"
								>
									<select
										className="emach-select"
										id="addressId"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										value={field.state.value}
									>
										{addresses.map((addr) => (
											<option key={addr.id} value={addr.id}>
												{formatAddressLabel(addr)}
											</option>
										))}
										<option value={NEW_ADDRESS_ID}>+ Novo endereço</option>
									</select>
								</FieldShell>
							)}
						</form.Field>

						<form.Subscribe
							selector={(state) => state.values.addressId === NEW_ADDRESS_ID}
						>
							{(showNew) =>
								showNew ? (
									<div className="space-y-4 border border-gray-20 p-5">
										<div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
											<form.Field name="newAddress.zipCode">
												{(field) => (
													<div>
														<FieldShell
															errors={field.state.meta.errors}
															htmlFor="zipCode"
															label="CEP"
														>
															<input
																aria-busy={cepAutofill.loading}
																autoComplete="postal-code"
																className="emach-input"
																id="zipCode"
																onBlur={field.handleBlur}
																onChange={(e) => {
																	const next = onlyDigits(e.target.value).slice(
																		0,
																		8
																	);
																	field.handleChange(next);
																	cepAutofill.maybeLookup(next);
																}}
																placeholder="00000000"
																value={field.state.value}
															/>
														</FieldShell>
														{cepAutofill.loading ? (
															<p
																aria-live="polite"
																className="mt-1 text-gray-60 text-xs"
															>
																Buscando endereço…
															</p>
														) : null}
													</div>
												)}
											</form.Field>
											<TextField
												autoComplete="address-line1"
												form={form}
												label="Rua"
												name="newAddress.street"
												placeholder="Rua 21 de Abril"
											/>
										</div>
										<div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
											<TextField
												autoComplete="address-line2"
												form={form}
												label="Número"
												name="newAddress.number"
												placeholder="123"
												transform={onlyDigits}
											/>
											<TextField
												autoComplete="off"
												form={form}
												label="Complemento"
												name="newAddress.complement"
												placeholder="Apto 101 (opcional)"
											/>
										</div>
										<TextField
											autoComplete="off"
											form={form}
											label="Bairro"
											name="newAddress.neighborhood"
											placeholder="Centro"
										/>
										<div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
											<TextField
												autoComplete="address-level2"
												form={form}
												label="Cidade"
												name="newAddress.city"
												placeholder="São Paulo"
												transform={onlyLetters}
											/>
											<TextField
												autoComplete="address-level1"
												form={form}
												label="Estado"
												name="newAddress.state"
												placeholder="SP"
												transform={formatUf}
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

						<div className="flex flex-col-reverse items-stretch gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
							<Link
								className={emachButtonVariants({
									size: "lg",
									variant: "outline",
								})}
								href="/cart"
							>
								Voltar ao Carrinho
							</Link>
							<form.Subscribe
								selector={(state) => ({
									canSubmit: state.canSubmit,
									isSubmitting: state.isSubmitting,
								})}
							>
								{({ canSubmit, isSubmitting }) => (
									<EmachButton
										disabled={!canSubmit || isSubmitting || !emailVerified}
										size="lg"
										type="submit"
										variant="primary"
									>
										{isSubmitting ? "Processando..." : "Confirmar pedido"}
									</EmachButton>
								)}
							</form.Subscribe>
						</div>
					</form>
				</div>

				<div>
					<div className="space-y-4 border border-gray-20 p-6 lg:sticky lg:top-10">
						<h2 className="font-display font-semibold text-xs uppercase tracking-[0.14em]">
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
										<div className="absolute inset-0 bg-gray-10" />
									)}
								</div>
								<div className="flex-1 text-sm">
									<p className="font-medium">{item.name}</p>
									<p className="text-gray-60">Qtd: {item.quantity}</p>
								</div>
								<span className="font-medium text-sm">
									{fmtBRL(numericToCents(item.priceAmount) * item.quantity)}
								</span>
							</div>
						))}

						<Separator />

						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-gray-60">Subtotal</span>
								<span>{fmtBRL(subtotal)}</span>
							</div>
							<CouponField
								applied={coupon}
								cartItems={items.map((i) => ({
									toolId: i.toolId,
									variantId: i.variantId,
									quantity: i.quantity,
								}))}
								onApplied={setCoupon}
								onRemoved={() => setCoupon(null)}
							/>
							{discount > 0 ? (
								<div className="flex justify-between">
									<span className="text-gray-60">Desconto</span>
									<span>−{fmtBRL(discount)}</span>
								</div>
							) : null}
							<div aria-atomic="true" aria-live="polite" className="space-y-2">
								<span className="text-gray-60 text-sm">Frete</span>
								<ShippingOptions
									onRetry={() => setQuoteNonce((n) => n + 1)}
									onSelect={setSelectedCarrierId}
									options={shippingOptions}
									selectedId={selectedCarrierId}
									status={shippingStatus}
								/>
							</div>
						</div>

						<Separator />

						<div className="flex justify-between font-bold text-base">
							<span>Total</span>
							<span>
								{selectedShippingCents === null ? "A calcular" : fmtBRL(total)}
							</span>
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
	const label = addr.label ? ` — ${addr.label}` : "";
	const def = addr.isDefault ? " ★" : "";
	return `${parts.join(" · ")}${label}${def}`;
}

interface FieldShellProps {
	children: React.ReactNode;
	errors: ReadonlyArray<{ message?: string } | undefined>;
	htmlFor: string;
	label: string;
}

function FieldShell({ children, errors, htmlFor, label }: FieldShellProps) {
	const errorId = `${htmlFor}-error`;
	const hasError = errors.some((e) => e?.message);
	return (
		<div className="emach-field">
			<label className="emach-field__label" htmlFor={htmlFor}>
				{label}
			</label>
			{hasError
				? React.cloneElement(
						children as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
						{
							"aria-describedby": errorId,
						}
					)
				: children}
			{errors.map((error, idx) =>
				error?.message ? (
					<span
						aria-live="polite"
						className="emach-field__error"
						id={idx === 0 ? errorId : undefined}
						key={`${error.message}-${idx}`}
						role="alert"
					>
						{error.message}
					</span>
				) : null
			)}
		</div>
	);
}

interface TextFieldProps {
	autoComplete?: string;
	// biome-ignore lint/suspicious/noExplicitAny: tanstack form generic
	form: any;
	label: string;
	name: string;
	placeholder?: string;
	/** Sanitiza o valor digitado a cada tecla (ex.: só letras, só dígitos). */
	transform?: (raw: string) => string;
	type?: string;
}

function TextField({
	form,
	label,
	name,
	autoComplete,
	placeholder,
	type,
	transform,
}: TextFieldProps) {
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
					<input
						autoComplete={autoComplete}
						className="emach-input"
						id={name}
						onBlur={field.handleBlur}
						onChange={(e) =>
							field.handleChange(
								transform ? transform(e.target.value) : e.target.value
							)
						}
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
					{required && (
						<span
							aria-label="obrigatório"
							className="ml-1 text-emach-red-hover"
							role="img"
						>
							*
						</span>
					)}
				</span>
			</label>
			{touched &&
				errors.map((error, idx) =>
					error?.message ? (
						<p
							className="mt-1 text-emach-red-hover text-xs"
							key={`${error.message}-${idx}`}
						>
							{error.message}
						</p>
					) : null
				)}
		</div>
	);
}
