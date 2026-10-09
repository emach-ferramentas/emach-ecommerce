import { db } from "@emach/db";
import type { OrderStatus } from "@emach/db/schema/orders";
import { order, orderItem } from "@emach/db/schema/orders";
import { and, eq } from "drizzle-orm";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
	OrderNumber,
	OrderReceived,
} from "@/app/(shop)/pedidos/_components/order-received";
import { OrderStatusBadge } from "@/app/dashboard/pedidos/_components/order-status-badge";
import { EmachLinkButton } from "@/components/emach-button";
import { PageHead } from "@/components/page-head";
import { Panel, SummaryRow } from "@/components/panel";
import { fmtNumericBRL } from "@/lib/format";
import { requireCurrentClient } from "@/lib/session";

// Rota autenticada e sempre dinâmica (lê sessão): não há prerender. `params` e
// `headers` são acessados só dentro do Suspense (OrderConfirmationContent), o que
// satisfaz o cacheComponents sem generateStaticParams. Metadata é estática
// porque generateMetadata não pode acessar params dinâmicos fora de um boundary.
export const metadata: Metadata = {
	title: "Detalhes do pedido",
	robots: { index: false, follow: false },
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

// O checkout cai aqui com o pedido em pending_payment: o título diz o que
// falta em vez de "confirmado", e o pagamento mora no detalhe da conta.
const HEADLINE: Partial<Record<OrderStatus, { title: string; lead: string }>> =
	{
		pending_payment: {
			title: "Pedido recebido",
			lead: "Falta o pagamento para o pedido seguir para separação e envio. Você paga pela página do pedido na sua conta.",
		},
		payment_failed: {
			title: "Pagamento não aprovado",
			lead: "O pedido continua aberto. Tente pagar de novo pela página do pedido na sua conta.",
		},
	};

const ITEM_ROWS = ["item-a", "item-b"] as const;
const SUMMARY_ROWS = ["subtotal", "frete", "total"] as const;
const ADDRESS_ROWS = ["w-40", "w-56", "w-32", "w-44"] as const;

export default function OrderConfirmationPage({
	params,
}: {
	params: Promise<{ number: string }>;
}) {
	return (
		<Suspense fallback={<OrderConfirmationSkeleton />}>
			<OrderConfirmationContent params={params} />
		</Suspense>
	);
}

function OrderConfirmationSkeleton() {
	return (
		<div className="shop-wrap animate-pulse pt-6 pb-16 md:pt-10">
			<div className="h-4 w-56 max-w-full rounded-[3px] bg-canteiro" />
			<div className="mt-4 h-12 w-80 max-w-full rounded-[3px] bg-canteiro" />
			<div className="mt-3 h-4 w-full max-w-xl rounded-[3px] bg-canteiro" />
			<div className="mt-6 flex flex-col gap-3 sm:flex-row">
				<div className="h-13 w-full rounded-[3px] bg-canteiro sm:w-52" />
				<div className="h-13 w-full rounded-[3px] border-[1.5px] border-line sm:w-52" />
			</div>
			<div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
				<div className="rounded-[5px] border border-line p-5 md:p-6">
					<div className="h-5 w-16 rounded-[3px] bg-canteiro" />
					{ITEM_ROWS.map((row) => (
						<div
							className="grid grid-cols-[1fr_auto] gap-4 border-line border-b py-4 last:border-b-0"
							key={row}
						>
							<div className="space-y-2">
								<div className="h-4 w-3/5 rounded-[3px] bg-canteiro" />
								<div className="h-3 w-28 rounded-[3px] bg-canteiro" />
								<div className="h-3 w-36 rounded-[3px] bg-canteiro" />
							</div>
							<div className="h-4 w-20 rounded-[3px] bg-canteiro" />
						</div>
					))}
				</div>
				<div className="space-y-6">
					<div className="space-y-3 rounded-[5px] border border-line bg-canteiro p-5 md:p-6">
						<div className="h-5 w-20 rounded-[3px] bg-paper" />
						{SUMMARY_ROWS.map((row) => (
							<div className="flex justify-between" key={row}>
								<div className="h-4 w-16 rounded-[3px] bg-paper" />
								<div className="h-4 w-20 rounded-[3px] bg-paper" />
							</div>
						))}
					</div>
					<div className="space-y-2 rounded-[5px] border border-line p-5 md:p-6">
						<div className="h-5 w-20 rounded-[3px] bg-canteiro" />
						{ADDRESS_ROWS.map((width) => (
							<div
								className={`h-3.5 rounded-[3px] bg-canteiro ${width}`}
								key={width}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

// Lê params + sessão (headers) — sob Suspense por exigência do cacheComponents.
// Guarda P0 (requireCurrentClient) antes de qualquer dado do pedido.
async function OrderConfirmationContent({
	params,
}: {
	params: Promise<{ number: string }>;
}) {
	const { number } = await params;
	const session = await requireCurrentClient(`/pedidos/${number}`);

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
	const headline = HEADLINE[orderRow.status];
	const accountOrderHref = `/dashboard/pedidos/${orderRow.id}` as Route;
	const current = `Pedido ${orderRow.number}`;
	const status = <OrderStatusBadge status={orderRow.status} />;
	const createdAt = orderRow.createdAt.toLocaleString("pt-BR", {
		timeZone: "America/Sao_Paulo",
		dateStyle: "short",
		timeStyle: "short",
	});
	const actions = (
		<>
			<EmachLinkButton href={accountOrderHref} size="lg" variant="dark">
				Ver pedido na conta
			</EmachLinkButton>
			<EmachLinkButton href="/catalog" size="lg" variant="line">
				Continuar comprando
			</EmachLinkButton>
		</>
	);

	return (
		<div className="shop-wrap pb-16">
			{orderRow.status === "pending_payment" && headline ? (
				<div className="pt-6 md:pt-10">
					<OrderReceived
						actions={actions}
						meta={
							<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
								<OrderNumber number={orderRow.number} />
								{status}
								<span className="text-[14px] text-ink-muted tabular-nums">
									Criado em {createdAt}
								</span>
							</div>
						}
						title={headline.title}
					>
						{headline.lead}
					</OrderReceived>
				</div>
			) : (
				<>
					<PageHead aside={status} title={headline?.title ?? current}>
						<p className="tabular-nums">
							{headline ? (
								<>
									Pedido <strong className="text-ink">{orderRow.number}</strong>{" "}
									·{" "}
								</>
							) : null}
							Criado em {createdAt}
						</p>
						{headline ? (
							<p className="mt-2 max-w-[60ch] text-ink">{headline.lead}</p>
						) : null}
					</PageHead>
					<div className="flex flex-wrap gap-3">{actions}</div>
				</>
			)}

			<div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
				<Panel className="lg:self-start" flush title="Itens">
					<ul className="divide-y divide-line border-line border-t">
						{items.map((it) => (
							<li
								className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 md:px-6"
								key={it.id}
							>
								<div>
									<p className="font-semibold text-[15px] text-ink">
										{it.name}
									</p>
									<p className="mt-0.5 text-[13.5px] text-ink-muted">
										SKU {it.sku}
										{it.voltage && ` · ${it.voltage}`}
									</p>
									<p className="mt-1 text-[14px] text-ink-2 tabular-nums">
										Qtd {it.quantity} × {fmtNumericBRL(it.unitPrice)}
									</p>
								</div>
								<p className="font-bold text-ink tabular-nums">
									{fmtNumericBRL(it.lineTotal)}
								</p>
							</li>
						))}
					</ul>
				</Panel>

				<div className="space-y-6 lg:self-start">
					<Panel title="Resumo" tone="canteiro">
						<SummaryRow label="Subtotal">
							{fmtNumericBRL(orderRow.subtotalAmount)}
						</SummaryRow>
						{Number(orderRow.discountAmount) > 0 && (
							<SummaryRow label="Desconto" tone="discount">
								−{fmtNumericBRL(orderRow.discountAmount)}
							</SummaryRow>
						)}
						<SummaryRow label="Frete">
							{Number(orderRow.shippingAmount) === 0
								? "Grátis"
								: fmtNumericBRL(orderRow.shippingAmount)}
						</SummaryRow>
						<SummaryRow label="Total" total>
							{fmtNumericBRL(orderRow.totalAmount)}
						</SummaryRow>
					</Panel>

					<Panel title="Entrega">
						<address className="space-y-0.5 text-[15px] text-ink-2 not-italic">
							{address.recipient && (
								<div className="font-semibold text-ink">
									{address.recipient}
								</div>
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
					</Panel>
				</div>
			</div>
		</div>
	);
}
