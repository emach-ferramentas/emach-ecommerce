import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel } from "@/components/panel";
import { getClientOrderDetail } from "@/lib/orders/queries";
import {
	getRefundForOrder,
	hasActiveRefund,
	isRefundEligibleStatus,
} from "@/lib/refunds/queries";
import { requireCurrentClient } from "@/lib/session";
import { BuyerInfo } from "./_components/buyer-info";
import { OrderActions } from "./_components/order-actions";
import { OrderDetailHeader } from "./_components/order-detail-header";
import { OrderDocuments } from "./_components/order-documents";
import { OrderItems } from "./_components/order-items";
import { OrderRefundBlock } from "./_components/order-refund-block";
import { OrderTotals } from "./_components/order-totals";
import { OrderTracking } from "./_components/order-tracking";
import { RequestRefundButton } from "./_components/request-refund-button";
import { ShippingAddress } from "./_components/shipping-address";

export const metadata: Metadata = {
	title: "Detalhes do pedido",
};

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
	const { id } = await params;
	const session = await requireCurrentClient();
	const detail = await getClientOrderDetail(session.user.id, id);

	if (!detail) {
		notFound();
	}

	const { order, items, history, reviewedToolIds } = detail;
	const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
	const refund = await getRefundForOrder(session.user.id, order.id);
	const canRequestRefund =
		isRefundEligibleStatus(order.status) && !hasActiveRefund(refund);
	const negativeAt =
		order.canceledAt ?? order.refundedAt ?? order.returnedAt ?? null;

	// phone/document são additionalFields do Better Auth, não inferidos no tipo
	// da sessão — cast necessário (mesmo padrão de dashboard/dados-pessoais).
	const u = session.user as { phone?: string | null; document?: string | null };
	const buyer = {
		name: session.user.name,
		email: session.user.email,
		phone: u.phone ?? null,
		document: u.document ?? null,
	};

	return (
		<>
			<OrderDetailHeader
				createdAt={order.createdAt}
				negativeAt={negativeAt}
				number={order.number}
				status={order.status}
			/>
			<div className="mt-5 grid items-start gap-5 pb-12 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="min-w-0 space-y-5">
					<OrderItems
						items={items}
						orderId={order.id}
						reviewedToolIds={reviewedToolIds}
						status={order.status}
					/>
					<OrderTracking
						history={history}
						shippingMethod={order.shippingMethod}
						status={order.status}
						trackingCode={order.shippingTrackingCode}
					/>
					<BuyerInfo buyer={buyer} />
					<ShippingAddress address={order.shippingAddress} />
					<OrderDocuments
						nfeNumber={order.nfeNumber}
						nfeStatus={order.nfeStatus}
						nfeUrl={order.nfeUrl}
						nfeXmlUrl={order.nfeXmlUrl}
						paymentReceiptUrl={order.paymentReceiptUrl}
					/>
					{refund ? (
						<Panel flush title={`Devolução #${refund.id.slice(0, 8)}`}>
							<OrderRefundBlock
								refund={{
									status: refund.status,
									rejectionReason: refund.rejectionReason,
									resolvedAt: refund.resolvedAt,
								}}
								variant="page"
							/>
						</Panel>
					) : null}
					{canRequestRefund ? (
						<div className="flex justify-end">
							<RequestRefundButton
								orderId={order.id}
								orderNumber={order.number}
								totalAmount={order.totalAmount}
							/>
						</div>
					) : null}
				</div>
				<div className="space-y-4 lg:sticky lg:top-6">
					<OrderTotals
						couponApplied={Boolean(order.couponId)}
						discountAmount={order.discountAmount}
						itemCount={itemCount}
						paymentMethod={order.paymentMethod}
						shippingAmount={order.shippingAmount}
						shippingMethod={order.shippingMethod}
						subtotalAmount={order.subtotalAmount}
						totalAmount={order.totalAmount}
					/>
					<OrderActions orderId={order.id} status={order.status} />
				</div>
			</div>
		</>
	);
}
