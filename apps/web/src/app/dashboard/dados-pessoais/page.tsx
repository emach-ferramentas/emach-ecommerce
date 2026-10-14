import { db } from "@emach/db";
import { clientAddress } from "@emach/db/schema/client";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AccountSectionSkeleton } from "@/app/dashboard/_components/account-section-skeleton";
import { PageHead } from "@/components/page-head";
import { requireCurrentClient } from "@/lib/session";
import { AddressesSection } from "./_components/addresses-section";
import { PersonalDataForm } from "./_components/personal-data-form";

export const metadata: Metadata = {
	title: "Dados pessoais",
};

export default function PersonalDataPage() {
	return (
		<div className="pb-12">
			<PageHead title="Meus dados" />
			<Suspense fallback={<AccountSectionSkeleton />}>
				<PersonalData />
			</Suspense>
		</div>
	);
}

async function PersonalData() {
	const session = await requireCurrentClient();

	// SAFETY: phone e document são additionalFields opcionais e nullable em
	// packages/auth/src/ecommerce.ts (required: false, type string); o `?? null`
	// abaixo cobre o caso de a coluna vir vazia, e name/email/emailVerified já
	// existem no tipo da sessão.
	const user = session.user as {
		name: string;
		email: string;
		emailVerified: boolean;
		phone?: string | null;
		document?: string | null;
	};

	const addresses = await db
		.select()
		.from(clientAddress)
		.where(eq(clientAddress.clientId, session.user.id))
		.orderBy(desc(clientAddress.isDefault), desc(clientAddress.updatedAt));

	return (
		<div className="space-y-5">
			<PersonalDataForm
				initialData={{
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					phone: user.phone ?? null,
					document: user.document ?? null,
				}}
			/>
			<AddressesSection addresses={addresses} />
		</div>
	);
}
