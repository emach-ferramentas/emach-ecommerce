import { sendEmail } from "@emach/email/send";
import {
	OrderReceivedEmail,
	type OrderReceivedProps,
} from "@emach/email/templates/order-received";
import { env } from "@emach/env/web";
import { createElement } from "react";

import { log } from "@/lib/evlog";
import { fmtNumericBRL, numericToCents } from "@/lib/format";
import {
	getClientOrderDetail,
	type OrderDetailData,
} from "@/lib/orders/queries";

interface AddressSnapshot {
	city?: string;
	complement?: string | null;
	neighborhood?: string;
	number?: string;
	recipient?: string;
	state?: string;
	street?: string;
	zipCode?: string;
}

function addressLines(address: unknown): string[] {
	const a = (address ?? {}) as AddressSnapshot;
	const street = [a.street, a.number].filter(Boolean).join(", ");
	const locality = [a.neighborhood, a.city].filter(Boolean).join(", ");
	return [
		a.recipient,
		street && a.complement ? `${street} — ${a.complement}` : street,
		a.state ? `${locality} — ${a.state}` : locality,
		a.zipCode ? `CEP ${a.zipCode}` : "",
	].filter((line): line is string => Boolean(line));
}

function toProps(
	{ order, items }: OrderDetailData,
	name: string
): OrderReceivedProps {
	const summary = [
		{ label: "Subtotal", value: fmtNumericBRL(order.subtotalAmount) },
	];
	if (numericToCents(order.discountAmount) > 0) {
		summary.push({
			label: "Desconto do cupom",
			value: `- ${fmtNumericBRL(order.discountAmount)}`,
		});
	}
	summary.push({
		label: order.shippingMethod ? `Frete (${order.shippingMethod})` : "Frete",
		value: fmtNumericBRL(order.shippingAmount),
	});

	return {
		name,
		orderNumber: order.number,
		orderUrl: `${env.NEXT_PUBLIC_SITE_URL}/dashboard/pedidos/${order.id}`,
		items: items.map((item) => ({
			id: item.id,
			name: item.name,
			detail: item.voltage,
			quantity: item.quantity,
			lineTotal: fmtNumericBRL(item.lineTotal),
		})),
		summary,
		total: fmtNumericBRL(order.totalAmount),
		addressLines: addressLines(order.shippingAddress),
	};
}

/** Roda depois da resposta do checkout: nunca lança, falha vai para o log. */
export async function sendOrderReceivedEmail({
	clientId,
	orderId,
	to,
	name,
}: {
	clientId: string;
	name: string;
	orderId: string;
	to: string;
}): Promise<void> {
	try {
		const detail = await getClientOrderDetail(clientId, orderId);
		if (!detail) {
			throw new Error("Pedido não encontrado");
		}
		await sendEmail({
			to,
			subject: `Pedido ${detail.order.number} recebido`,
			react: createElement(OrderReceivedEmail, toProps(detail, name)),
		});
	} catch (err) {
		log.error({
			action: "order_received_email_failed",
			orderId,
			clientId,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}
