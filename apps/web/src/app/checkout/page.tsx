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

const FIELD_PAIRS = ["dados", "contato"] as const;
const CONSENT_ROWS = ["tos", "privacy", "marketing"] as const;
const SUMMARY_ITEMS = ["item-a", "item-b"] as const;

function FieldSkeleton() {
	return (
		<div className="flex flex-col gap-1.5">
			<div className="h-3 w-20 bg-gray-20" />
			<div className="h-11 w-full border border-border bg-white" />
		</div>
	);
}

// Mesma anatomia do CheckoutContent: form à esquerda (dados, endereço,
// consentimentos, ações) e o resumo de 380px à direita.
function CheckoutPageSkeleton() {
	return (
		<div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
			<div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
				<div className="animate-pulse">
					<div className="h-8 w-56 bg-gray-20" />
					<div className="mt-2 h-4 w-72 max-w-full bg-gray-20" />
					<div className="mt-8 space-y-6">
						<div className="h-5 w-28 bg-gray-20" />
						{FIELD_PAIRS.map((pair) => (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2" key={pair}>
								<FieldSkeleton />
								<FieldSkeleton />
							</div>
						))}
						<div className="h-px bg-border" />
						<div className="h-5 w-44 bg-gray-20" />
						<FieldSkeleton />
						<div className="h-px bg-border" />
						<div className="space-y-3">
							{CONSENT_ROWS.map((row) => (
								<div className="flex items-center gap-3" key={row}>
									<div className="size-4 border border-border bg-white" />
									<div className="h-4 w-64 max-w-[80%] bg-gray-20" />
								</div>
							))}
						</div>
						<div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
							<div className="h-13 w-full border border-gray-20 sm:w-48" />
							<div className="h-13 w-full bg-gray-20 sm:w-52" />
						</div>
					</div>
				</div>
				<div>
					<div className="space-y-4 border border-gray-20 p-6">
						<div className="h-3 w-32 animate-pulse bg-gray-20" />
						<div className="h-px bg-border" />
						{SUMMARY_ITEMS.map((item) => (
							<div className="flex gap-4" key={item}>
								<div className="emach-shimmer size-16 shrink-0 bg-image-bg" />
								<div className="flex-1 animate-pulse space-y-2 pt-1">
									<div className="h-4 w-4/5 bg-gray-20" />
									<div className="h-3 w-12 bg-gray-20" />
								</div>
							</div>
						))}
						<div className="h-px bg-border" />
						<div className="animate-pulse space-y-3">
							<div className="flex justify-between">
								<div className="h-4 w-16 bg-gray-20" />
								<div className="h-4 w-20 bg-gray-20" />
							</div>
							<div className="h-10 w-full border border-border bg-white" />
							<div className="h-4 w-12 bg-gray-20" />
						</div>
						<div className="h-px bg-border" />
						<div className="flex animate-pulse justify-between">
							<div className="h-5 w-12 bg-gray-20" />
							<div className="h-5 w-24 bg-gray-20" />
						</div>
					</div>
				</div>
			</div>
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
