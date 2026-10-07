import type { Metadata } from "next";
import { Suspense } from "react";

import {
	OrderNumber,
	OrderReceived,
} from "@/app/(shop)/pedidos/_components/order-received";
import { EmachLinkButton } from "@/components/emach-button";
import { parseOrderNumber } from "@/lib/orders/order-number";

export const metadata: Metadata = {
	title: "Pedido recebido",
	description: "O pedido aparece em Meus pedidos com o pagamento pendente.",
	robots: { index: false, follow: false },
};

interface SuccessPageProps {
	searchParams: Promise<{ order?: string }>;
}

export default function CheckoutSuccessPage({
	searchParams,
}: SuccessPageProps) {
	return (
		<div className="shop-wrap py-10 md:py-16">
			<OrderReceived
				actions={
					<>
						<EmachLinkButton href="/dashboard/pedidos" size="lg" variant="dark">
							Ver meus pedidos
						</EmachLinkButton>
						<EmachLinkButton href="/catalog" size="lg" variant="line">
							Continuar comprando
						</EmachLinkButton>
					</>
				}
				meta={
					<Suspense fallback={null}>
						<SuccessOrderNumber searchParams={searchParams} />
					</Suspense>
				}
				title="Pedido recebido"
			>
				O pedido aparece em Meus pedidos com o pagamento pendente.
			</OrderReceived>
		</div>
	);
}

async function SuccessOrderNumber({ searchParams }: SuccessPageProps) {
	const { order } = await searchParams;
	const number = parseOrderNumber(order);
	return number ? <OrderNumber number={number} /> : null;
}
