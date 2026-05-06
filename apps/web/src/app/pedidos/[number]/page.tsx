import { db } from "@emach/db";
import type { OrderStatus, PaymentStatus } from "@emach/db/schema/orders";
import { order, orderItem } from "@emach/db/schema/orders";
import { Separator } from "@emach/ui/components/separator";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page-container";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { fmtNumericBRL } from "@/lib/format";
import { requireCurrentClient } from "@/lib/session";

export const metadata: Metadata = {
	title: "Pedido — EMACH",
};

interface AddressSnapshot {
	city?: string;
	complement?: string | null;
	country?: string;
	neighborhood?: string;
	number?: string;
	recipient?: string;
	state?: string;
	street?: string;
	zipCode?: string;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
	pending_payment: "Aguardando pagamento",
	paid: "Pago",
	preparing: "Em preparação",
	shipped: "Enviado",
	delivered: "Entregue",
	canceled: "Cancelado",
	refunded: "Reembolsado",
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
	pending: "Pendente",
	authorized: "Autorizado",
	paid: "Pago",
	failed: "Falhou",
	refunded: "Reembolsado",
};

export default async function OrderConfirmationPage({
	params,
}: {
	params: Promise<{ number: string }>;
}) {
	const { number } = await params;
	const session = await requireCurrentClient();

	const orderRows = await db
		.select()
		.from(order)
		.where(and(eq(order.number, number), eq(order.clientId, session.user.id)))
		.limit(1);
	const orderRow = orderRows[0];
	if (!orderRow) {
		notFound();
	}

	const items = await db
		.select()
		.from(orderItem)
		.where(eq(orderItem.orderId, orderRow.id));

	const address = (orderRow.shippingAddress ?? {}) as AddressSnapshot;

	return (
		<>
			<SiteHeader />
			<main>
				<PageContainer className="py-12">
					<div className="mb-8">
						<div className="font-display font-semibold text-[11px] text-emach-red uppercase tracking-[0.14em]">
							Pedido confirmado
						</div>
						<h1 className="mt-2 font-display font-medium text-[40px] tracking-[-0.01em]">
							{orderRow.number}
						</h1>
						<div className="mt-2 flex flex-wrap gap-3 text-[13px] text-gray-60">
							<span>
								Status: <strong>{STATUS_LABEL[orderRow.status]}</strong>
							</span>
							<span>·</span>
							<span>
								Pagamento:{" "}
								<strong>{PAYMENT_LABEL[orderRow.paymentStatus]}</strong>
							</span>
							<span>·</span>
							<span>
								Criado em{" "}
								{orderRow.createdAt.toLocaleString("pt-BR", {
									dateStyle: "short",
									timeStyle: "short",
								})}
							</span>
						</div>
					</div>

					<div className="grid grid-cols-[1fr_360px] gap-10">
						<section>
							<h2 className="font-display font-semibold text-xs uppercase tracking-wider">
								Itens
							</h2>
							<Separator className="mt-3" />
							<ul className="divide-y">
								{items.map((it) => (
									<li
										className="grid grid-cols-[1fr_auto] gap-4 py-4"
										key={it.id}
									>
										<div>
											<div className="font-medium text-[15px]">{it.name}</div>
											<div className="mt-0.5 text-[12px] text-gray-60">
												SKU {it.sku}
												{it.voltage && ` · ${it.voltage}`}
											</div>
											<div className="mt-1 text-[13px] text-gray-60">
												Qtd {it.quantity} × {fmtNumericBRL(it.unitPrice)}
											</div>
										</div>
										<div className="self-start font-bold tabular-nums">
											{fmtNumericBRL(it.lineTotal)}
										</div>
									</li>
								))}
							</ul>
						</section>

						<aside className="space-y-6">
							<div className="border border-border p-5">
								<h2 className="font-display font-semibold text-xs uppercase tracking-wider">
									Resumo
								</h2>
								<Separator className="mt-3" />
								<div className="mt-3 space-y-2 text-sm">
									<div className="flex justify-between">
										<span className="text-gray-60">Subtotal</span>
										<span className="tabular-nums">
											{fmtNumericBRL(orderRow.subtotalAmount)}
										</span>
									</div>
									{Number(orderRow.discountAmount) > 0 && (
										<div className="flex justify-between text-success">
											<span>Desconto</span>
											<span className="tabular-nums">
												−{fmtNumericBRL(orderRow.discountAmount)}
											</span>
										</div>
									)}
									<div className="flex justify-between">
										<span className="text-gray-60">Frete</span>
										<span className="tabular-nums">
											{Number(orderRow.shippingAmount) === 0
												? "Grátis"
												: fmtNumericBRL(orderRow.shippingAmount)}
										</span>
									</div>
									<Separator />
									<div className="flex justify-between font-bold">
										<span>Total</span>
										<span className="tabular-nums">
											{fmtNumericBRL(orderRow.totalAmount)}
										</span>
									</div>
								</div>
							</div>

							<div className="border border-border p-5">
								<h2 className="font-display font-semibold text-xs uppercase tracking-wider">
									Entrega
								</h2>
								<Separator className="mt-3" />
								<address className="mt-3 space-y-0.5 text-[13px] not-italic">
									{address.recipient && (
										<div className="font-medium">{address.recipient}</div>
									)}
									{address.street && (
										<div>
											{address.street}, {address.number}
											{address.complement && ` — ${address.complement}`}
										</div>
									)}
									{address.neighborhood && <div>{address.neighborhood}</div>}
									{address.city && (
										<div>
											{address.city} / {address.state} · {address.zipCode}
										</div>
									)}
								</address>
							</div>
						</aside>
					</div>
				</PageContainer>
			</main>
			<SiteFooter />
		</>
	);
}
