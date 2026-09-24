import { db } from "@emach/db";
import type { OrderStatus } from "@emach/db/schema/orders";
import { order, orderItem } from "@emach/db/schema/orders";
import { Separator } from "@emach/ui/components/separator";
import { and, eq } from "drizzle-orm";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { emachButtonVariants } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";
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

const STATUS_LABEL: Record<OrderStatus, string> = {
	pending_payment: "Aguardando pagamento",
	paid: "Pago",
	preparing: "Em preparação",
	shipped: "Enviado",
	delivered: "Entregue",
	canceled: "Cancelado",
	refunded: "Reembolsado",
	payment_failed: "Pagamento falhou",
	returned: "Devolvido",
};

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
		<>
			<SiteHeader />
			<Suspense fallback={<OrderConfirmationSkeleton />}>
				<OrderConfirmationContent params={params} />
			</Suspense>
		</>
	);
}

// Mesma anatomia do conteúdo: cabeçalho com ações, lista de itens e as duas
// caixas laterais (resumo e entrega).
function OrderConfirmationSkeleton() {
	return (
		<main id="main-content">
			<PageContainer className="animate-pulse py-12">
				<div className="mb-8">
					<div className="h-10 w-72 max-w-full bg-gray-20" />
					<div className="mt-3 h-4 w-80 max-w-full bg-gray-20" />
					<div className="mt-3 h-4 w-full max-w-xl bg-gray-20" />
					<div className="mt-6 flex flex-col gap-3 sm:flex-row">
						<div className="h-13 w-full bg-gray-20 sm:w-52" />
						<div className="h-13 w-full border border-gray-20 sm:w-52" />
					</div>
				</div>
				<div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
					<section>
						<div className="h-3 w-12 bg-gray-20" />
						<div className="mt-3 h-px bg-border" />
						{ITEM_ROWS.map((row) => (
							<div
								className="grid grid-cols-[1fr_auto] gap-4 border-border border-b py-4"
								key={row}
							>
								<div className="space-y-2">
									<div className="h-4 w-3/5 bg-gray-20" />
									<div className="h-3 w-28 bg-gray-20" />
									<div className="h-3 w-36 bg-gray-20" />
								</div>
								<div className="h-4 w-20 bg-gray-20" />
							</div>
						))}
					</section>
					<aside className="space-y-6">
						<div className="border border-border p-5">
							<div className="h-3 w-16 bg-gray-20" />
							<div className="mt-3 h-px bg-border" />
							<div className="mt-3 space-y-3">
								{SUMMARY_ROWS.map((row) => (
									<div className="flex justify-between" key={row}>
										<div className="h-4 w-16 bg-gray-20" />
										<div className="h-4 w-20 bg-gray-20" />
									</div>
								))}
							</div>
						</div>
						<div className="border border-border p-5">
							<div className="h-3 w-16 bg-gray-20" />
							<div className="mt-3 h-px bg-border" />
							<div className="mt-3 space-y-1.5">
								{ADDRESS_ROWS.map((width) => (
									<div className={`h-3.5 bg-gray-20 ${width}`} key={width} />
								))}
							</div>
						</div>
					</aside>
				</div>
			</PageContainer>
		</main>
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

	return (
		<main id="main-content">
			<PageContainer className="py-12">
				<div className="mb-8">
					<h1 className="font-display font-medium text-[40px] leading-tight tracking-[-0.01em]">
						{headline?.title ?? `Pedido ${orderRow.number}`}
					</h1>
					<div className="mt-2 flex flex-wrap gap-3 text-[13px] text-gray-60">
						{headline ? (
							<>
								<span>
									Pedido <strong>{orderRow.number}</strong>
								</span>
								<span>·</span>
							</>
						) : null}
						<span>
							Status: <strong>{STATUS_LABEL[orderRow.status]}</strong>
						</span>
						<span>·</span>
						<span>
							Criado em{" "}
							{orderRow.createdAt.toLocaleString("pt-BR", {
								timeZone: "America/Sao_Paulo",
								dateStyle: "short",
								timeStyle: "short",
							})}
						</span>
					</div>
					{headline ? (
						<p className="mt-3 max-w-xl text-[15px] text-near-black">
							{headline.lead}
						</p>
					) : null}
					<div className="mt-6 flex flex-col gap-3 sm:flex-row">
						<Link
							className={emachButtonVariants({
								size: "lg",
								variant: "primary",
							})}
							href={accountOrderHref}
						>
							Ver pedido na conta
						</Link>
						<Link
							className={emachButtonVariants({
								size: "lg",
								variant: "outline",
							})}
							href="/catalog"
						>
							Continuar comprando
						</Link>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
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
	);
}
