"use client";

import type { ClientAddress } from "@emach/db/schema/client";
import {
	isValidCpfCnpj,
	isValidPhone,
	maskCpfCnpj,
	maskPhone,
	normalizeDocument,
	onlyDigits,
	onlyLetters,
} from "@emach/validators";
import { revalidateLogic, useForm, useStore } from "@tanstack/react-form";
import { CircleAlert } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { createOrderAction } from "@/app/checkout/_actions/create-order";
import { quoteShippingAction } from "@/app/checkout/_actions/quote-shipping";
import { revalidateCartAction } from "@/app/checkout/_actions/revalidate-cart";
import { ConsentField } from "@/app/checkout/_components/consent-field";
import {
	type AppliedCoupon,
	OrderSummary,
} from "@/app/checkout/_components/order-summary";
import {
	ShippingOptions,
	type ShippingStatus,
} from "@/app/checkout/_components/shipping-options";
import { EmachButton } from "@/components/emach-button";
import { errorMessages, Field, TextField } from "@/components/field";
import { Notice } from "@/components/notice";
import { PageHead } from "@/components/page-head";
import { Panel } from "@/components/panel";
import { authClient } from "@/lib/auth-client";
import { useCart } from "@/lib/cart-context";
import type { ShippingOption } from "@/lib/shipping/types";
import { useCepAutofill } from "@/lib/use-cep-autofill";
import { addressFieldsSchema } from "@/lib/validators/address";

const NEW_ADDRESS_ID = "__new__";
const CHECKOUT_FORM_ID = "checkout-form";

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
		phone: z.string().refine(isValidPhone, "Telefone inválido"),
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
	const {
		items,
		clear,
		reconcile,
		remove,
		hydrated,
		subtotalCents: subtotal,
	} = useCart();
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
				const unavailable = new Set(result.unavailable);
				for (const item of items) {
					if (unavailable.has(item.variantId)) {
						remove(item.variantId);
						toast.error(
							`${item.name} não está mais disponível e saiu do carrinho`
						);
					}
				}
				const fresh = new Map(
					result.prices.map((p) => [
						p.variantId,
						(p.finalPriceCents / 100).toFixed(2),
					])
				);
				reconcile(fresh);
			}
		})();
	}, [items, reconcile, remove]);

	const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

	const form = useForm({
		defaultValues: {
			name: clientName,
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
			// Recotação em voo (carrinho/CEP mudou): submeter agora enviaria o
			// shippingAmount da cotação ANTERIOR — o anti-fraude rejeitaria um
			// pedido legítimo. O botão já desabilita; guarda cobre submit implícito.
			if (shippingStatus === "loading") {
				toast.error("Aguarde o recálculo do frete");
				return;
			}
			if (selectedShippingCents === null) {
				toast.error("Selecione uma opção de frete");
				return;
			}
			const result = await createOrderAction({
				name: value.name.trim(),
				phone: onlyDigits(value.phone),
				document: normalizeDocument(value.document),
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
			toast.success(
				`Pedido ${result.orderNumber} recebido, aguardando pagamento`
			);
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: quoteNonce não é lido no corpo — é gatilho manual de re-cotação (botão "tentar novamente").
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
	}, [destinationCep, items, subtotal, quoteNonce]);

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

	const submitButton = (
		<form.Subscribe
			selector={(state) => ({
				canSubmit: state.canSubmit,
				isSubmitting: state.isSubmitting,
			})}
		>
			{({ canSubmit, isSubmitting }) => (
				<EmachButton
					disabled={
						!canSubmit ||
						isSubmitting ||
						!emailVerified ||
						shippingStatus === "loading"
					}
					form={CHECKOUT_FORM_ID}
					full
					size="lg"
					type="submit"
					variant="cta"
				>
					{isSubmitting ? "Processando…" : "Confirmar pedido"}
				</EmachButton>
			)}
		</form.Subscribe>
	);

	return (
		<div className="shop-wrap pb-16">
			<PageHead title="Finalizar compra">
				Confira seus dados e endereço de entrega
			</PageHead>
			<div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
				<div className="min-w-0 space-y-5">
					{emailVerified ? null : (
						<Notice
							action={
								<EmachButton
									disabled={resendingVerification}
									onClick={handleResendVerification}
									type="button"
									variant="line"
								>
									{resendingVerification ? "Enviando…" : "Reenviar e-mail"}
								</EmachButton>
							}
						>
							<p className="font-semibold text-ink">
								Confirme seu e-mail para finalizar o pedido
							</p>
							<p className="mt-0.5">
								Enviamos um link de confirmação para {clientEmail}.
							</p>
						</Notice>
					)}

					<form
						className="space-y-5"
						id={CHECKOUT_FORM_ID}
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<Panel title="Seus dados">
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<form.Field name="name">
									{(field) => (
										<TextField
											autoComplete="name"
											field={field}
											label="Nome completo"
											placeholder="Maria da Silva"
											transform={onlyLetters}
										/>
									)}
								</form.Field>
								<Field hint="E-mail da sua conta" id="email" label="E-mail">
									{(control) => (
										<input
											{...control}
											autoComplete="email"
											className="emach-input"
											readOnly
											type="email"
											value={clientEmail}
										/>
									)}
								</Field>
								<form.Field name="phone">
									{(field) => (
										<TextField
											autoComplete="tel"
											field={field}
											label="Telefone"
											placeholder="(11) 99999-9999"
											transform={maskPhone}
											type="tel"
										/>
									)}
								</form.Field>
								<form.Field name="document">
									{(field) => (
										<TextField
											autoComplete="off"
											field={field}
											label="CPF ou CNPJ"
											placeholder="000.000.000-00"
											transform={maskCpfCnpj}
										/>
									)}
								</form.Field>
							</div>
						</Panel>

						<Panel title="Entrega">
							<div className="space-y-4">
								<form.Field name="addressId">
									{(field) => (
										<Field
											error={errorMessages(field.state.meta.errors)}
											id="addressId"
											label="Endereço"
										>
											{(control) => (
												<select
													{...control}
													className="emach-select"
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													value={field.state.value}
												>
													{addresses.map((addr) => (
														<option key={addr.id} value={addr.id}>
															{formatAddressLabel(addr)}
														</option>
													))}
													<option value={NEW_ADDRESS_ID}>
														+ Novo endereço
													</option>
												</select>
											)}
										</Field>
									)}
								</form.Field>

								<form.Subscribe
									selector={(state) =>
										state.values.addressId === NEW_ADDRESS_ID
									}
								>
									{(showNew) =>
										showNew ? (
											<div className="space-y-4 border-line border-t pt-4">
												<div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
													<form.Field name="newAddress.zipCode">
														{(field) => (
															<div>
																<Field
																	error={errorMessages(field.state.meta.errors)}
																	id="zipCode"
																	label="CEP"
																>
																	{(control) => (
																		<input
																			{...control}
																			aria-busy={cepAutofill.loading}
																			autoComplete="postal-code"
																			className="emach-input"
																			inputMode="numeric"
																			onBlur={field.handleBlur}
																			onChange={(e) => {
																				const next = onlyDigits(
																					e.target.value
																				).slice(0, 8);
																				field.handleChange(next);
																				cepAutofill.maybeLookup(next);
																			}}
																			placeholder="00000000"
																			value={field.state.value}
																		/>
																	)}
																</Field>
																{cepAutofill.loading ? (
																	<p
																		aria-live="polite"
																		className="mt-1.5 text-[13px] text-ink-muted"
																	>
																		Buscando endereço…
																	</p>
																) : null}
																{cepAutofill.notFound ? (
																	<p
																		className="mt-1.5 flex items-start gap-1.5 text-[13px] text-error-text"
																		role="alert"
																	>
																		<CircleAlert
																			aria-hidden="true"
																			className="mt-0.5 size-3.5 shrink-0"
																		/>
																		CEP não encontrado — confira o número antes
																		de continuar
																	</p>
																) : null}
															</div>
														)}
													</form.Field>
													<form.Field name="newAddress.street">
														{(field) => (
															<TextField
																autoComplete="address-line1"
																field={field}
																label="Rua"
																placeholder="Rua 21 de Abril"
															/>
														)}
													</form.Field>
												</div>
												<div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
													<form.Field name="newAddress.number">
														{(field) => (
															<TextField
																autoComplete="address-line2"
																field={field}
																label="Número"
																placeholder="123"
																transform={onlyDigits}
															/>
														)}
													</form.Field>
													<form.Field name="newAddress.complement">
														{(field) => (
															<TextField
																autoComplete="off"
																field={field}
																label="Complemento"
																placeholder="Apto 101 (opcional)"
															/>
														)}
													</form.Field>
												</div>
												<form.Field name="newAddress.neighborhood">
													{(field) => (
														<TextField
															autoComplete="off"
															field={field}
															label="Bairro"
															placeholder="Centro"
														/>
													)}
												</form.Field>
												<div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
													<form.Field name="newAddress.city">
														{(field) => (
															<TextField
																autoComplete="address-level2"
																field={field}
																label="Cidade"
																placeholder="São Paulo"
																transform={onlyLetters}
															/>
														)}
													</form.Field>
													<form.Field name="newAddress.state">
														{(field) => (
															<TextField
																autoComplete="address-level1"
																field={field}
																label="Estado"
																placeholder="SP"
																transform={formatUf}
															/>
														)}
													</form.Field>
												</div>
											</div>
										) : null
									}
								</form.Subscribe>
							</div>
						</Panel>

						<Panel title="Frete">
							<div aria-atomic="true" aria-live="polite">
								<ShippingOptions
									onRetry={() => setQuoteNonce((n) => n + 1)}
									onSelect={setSelectedCarrierId}
									options={shippingOptions}
									selectedId={selectedCarrierId}
									status={shippingStatus}
								/>
							</div>
						</Panel>

						<Panel title="Revisão">
							<div className="space-y-1">
								<form.Field name="acceptTos">
									{(field) => (
										<ConsentField
											checked={field.state.value === true}
											errors={field.state.meta.errors}
											id="acceptTos"
											label="Li e aceito os Termos de Uso"
											onChange={(v) => field.handleChange(v)}
											required
											touched={field.state.meta.isTouched}
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
											touched={field.state.meta.isTouched}
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
											touched={field.state.meta.isTouched}
										/>
									)}
								</form.Field>
							</div>
						</Panel>
					</form>
				</div>

				<OrderSummary
					action={submitButton}
					coupon={coupon}
					items={items}
					onCouponApplied={setCoupon}
					onCouponRemoved={() => setCoupon(null)}
					shippingCents={selectedShippingCents}
					subtotalCents={subtotal}
				/>
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
