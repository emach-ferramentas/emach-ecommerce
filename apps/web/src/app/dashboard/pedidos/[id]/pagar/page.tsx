import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import {
	ACCOUNT_TRAIL,
	ORDERS_CRUMB,
} from "@/app/dashboard/_components/account-trail";
import { PageHead } from "@/components/page-head";
import { getClientOrderDetail } from "@/lib/orders/queries";
import { requireCurrentClient } from "@/lib/session";
import { PaymentMethods } from "./_components/payment-methods";

export const metadata: Metadata = {
	title: "Pagamento",
};

export default async function PagarPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
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
	const trail = [
		...ACCOUNT_TRAIL,
		ORDERS_CRUMB,
		{
			href: `/dashboard/pedidos/${id}` as Route,
			label: `Pedido #${order.number}`,
		},
	];
	return (
		<div className="pb-12">
			<PageHead title="Pagamento" trail={trail}>
				Pedido #{order.number}
			</PageHead>
			<PaymentMethods
				orderNumber={order.number}
				shipping={order.shippingAmount}
				subtotal={order.subtotalAmount}
				total={order.totalAmount}
			/>
		</div>
	);
}
