import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountSectionSkeleton } from "@/app/dashboard/_components/account-section-skeleton";
import { PageHead } from "@/components/page-head";
import { getClientOrderDetail } from "@/lib/orders/queries";
import { requireCurrentClient } from "@/lib/session";
import { PaymentMethods } from "./_components/payment-methods";

export const metadata: Metadata = {
	title: "Pagamento",
};

interface PageProps {
	params: Promise<{ id: string }>;
}

export default function PagarPage({ params }: PageProps) {
	return (
		<Suspense
			fallback={
				<div className="pt-6 md:pt-10">
					<AccountSectionSkeleton />
				</div>
			}
		>
			<Payment params={params} />
		</Suspense>
	);
}

async function Payment({ params }: PageProps) {
	const { id } = await params;
	const session = await requireCurrentClient();
	const detail = await getClientOrderDetail(session.user.id, id);
	if (!detail) {
		notFound();
	}
	const { order } = detail;
	if (order.status !== "pending_payment" && order.status !== "payment_failed") {
		redirect(`/dashboard/pedidos/${id}`);
	}
	return (
		<div className="pb-12">
			<PageHead title="Pagamento">Pedido #{order.number}</PageHead>
			<PaymentMethods
				orderNumber={order.number}
				shipping={order.shippingAmount}
				subtotal={order.subtotalAmount}
				total={order.totalAmount}
			/>
		</div>
	);
}
