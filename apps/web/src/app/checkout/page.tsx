import { db } from "@emach/db";
import { client, clientAddress } from "@emach/db/schema/client";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { requireCurrentClient } from "@/lib/session";
import { CheckoutContent } from "./_components/checkout-content";

export const metadata: Metadata = {
	title: "Finalizar compra",
	description: "Endereço de entrega, frete e pagamento do seu pedido.",
};

export default function CheckoutPage() {
	return (
		<Suspense fallback={<CheckoutPageSkeleton />}>
			<CheckoutPageContent />
		</Suspense>
	);
}

function CheckoutPageSkeleton() {
	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-10">
			<div className="h-[60vh] w-full animate-pulse bg-gray-20/40" />
		</div>
	);
}

// Conteúdo que lê a sessão (headers) — sob Suspense por exigência do
// cacheComponents. Guarda P0 no topo, antes de qualquer dado sensível.
async function CheckoutPageContent() {
	const session = await requireCurrentClient("/checkout");
	const [addresses, clientRow] = await Promise.all([
		db
			.select()
			.from(clientAddress)
			.where(eq(clientAddress.clientId, session.user.id))
			.orderBy(desc(clientAddress.isDefault), desc(clientAddress.updatedAt)),
		db
			.select({
				name: client.name,
				email: client.email,
				phone: client.phone,
				document: client.document,
			})
			.from(client)
			.where(eq(client.id, session.user.id))
			.limit(1),
	]);
	const profile = clientRow[0];

	return (
		<CheckoutContent
			addresses={addresses}
			clientDocument={profile?.document ?? null}
			clientEmail={profile?.email ?? ""}
			clientName={profile?.name ?? ""}
			clientPhone={profile?.phone ?? ""}
			emailVerified={session.user.emailVerified}
		/>
	);
}
