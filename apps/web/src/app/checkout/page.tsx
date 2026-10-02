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

const SKELETON_BLOCKS = [
	{ id: "dados", fields: 4 },
	{ id: "entrega", fields: 1 },
	{ id: "frete", fields: 2 },
	{ id: "revisao", fields: 3 },
] as const;
const SUMMARY_ITEMS = ["item-a", "item-b"] as const;
const SUMMARY_ROWS = ["subtotal", "frete", "total"] as const;
const FIELD_KEYS = ["a", "b", "c", "d"] as const;

function CheckoutPageSkeleton() {
	return (
		<div className="shop-wrap animate-pulse pt-6 pb-16 md:pt-10">
			<div className="h-12 w-72 max-w-full rounded-[3px] bg-canteiro" />
			<div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
				<div className="space-y-5">
					{SKELETON_BLOCKS.map((block) => (
						<div
							className="rounded-[5px] border border-line p-5 md:p-6"
							key={block.id}
						>
							<div className="h-5 w-32 rounded-[3px] bg-canteiro" />
							<div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
								{FIELD_KEYS.slice(0, block.fields).map((key) => (
									<div className="space-y-2" key={key}>
										<div className="h-4 w-24 rounded-[3px] bg-canteiro" />
										<div className="h-12 rounded-[3px] border-[1.5px] border-line" />
									</div>
								))}
							</div>
						</div>
					))}
				</div>
				<div className="h-fit space-y-4 rounded-[5px] border border-line bg-canteiro p-5 md:p-6">
					<div className="h-5 w-24 rounded-[3px] bg-paper" />
					{SUMMARY_ITEMS.map((item) => (
						<div className="flex gap-3" key={item}>
							<div className="size-16 shrink-0 rounded-[3px] bg-well" />
							<div className="flex-1 space-y-2 pt-1">
								<div className="h-4 w-4/5 rounded-[3px] bg-paper" />
								<div className="h-3 w-12 rounded-[3px] bg-paper" />
							</div>
						</div>
					))}
					{SUMMARY_ROWS.map((row) => (
						<div className="flex justify-between" key={row}>
							<div className="h-4 w-16 rounded-[3px] bg-paper" />
							<div className="h-4 w-20 rounded-[3px] bg-paper" />
						</div>
					))}
					<div className="h-13 rounded-[3px] bg-paper" />
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
