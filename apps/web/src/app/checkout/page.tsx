import { db } from "@emach/db";
import { client, clientAddress } from "@emach/db/schema/client";
import { cn } from "@emach/ui/lib/utils";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Fragment } from "react";

import { CheckoutHeader } from "@/components/checkout-header";
import { requireCurrentClient } from "@/lib/session";
import { CheckoutContent } from "./_components/checkout-content";

export const metadata: Metadata = {
	title: "Checkout — EMACH",
	description: "Finalize seu pedido EMACH com segurança.",
};

export default async function CheckoutPage() {
	const session = await requireCurrentClient();
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
		<>
			<CheckoutHeader>
				<StepIndicator currentStep={1} />
			</CheckoutHeader>
			<CheckoutContent
				addresses={addresses}
				clientDocument={profile?.document ?? null}
				clientEmail={profile?.email ?? ""}
				clientName={profile?.name ?? ""}
				clientPhone={profile?.phone ?? ""}
			/>
			<footer className="dark bg-background py-5 text-center text-muted-foreground text-xs">
				© 2026 EMACH. Todos os direitos reservados.
			</footer>
		</>
	);
}

function StepIndicator({ currentStep }: { currentStep: number }) {
	const steps = ["Dados", "Entrega", "Pagamento"];
	return (
		<div className="flex items-center gap-2">
			{steps.map((step, i) => (
				<Fragment key={step}>
					{i > 0 && <span className="text-muted-foreground text-xs">—</span>}
					<span
						className={cn(
							"font-display text-xs uppercase tracking-wider",
							i + 1 === currentStep
								? "font-semibold text-foreground"
								: "text-muted-foreground"
						)}
					>
						{i + 1}. {step}
					</span>
				</Fragment>
			))}
		</div>
	);
}
