import { db } from "@emach/db";
import { clientAddress } from "@emach/db/schema/client";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { ACCOUNT_TRAIL } from "@/app/dashboard/_components/account-trail";
import { PageHead } from "@/components/page-head";
import { requireCurrentClient } from "@/lib/session";
import { AddressesSection } from "./_components/addresses-section";
import { PersonalDataForm } from "./_components/personal-data-form";

export const metadata: Metadata = {
	title: "Dados pessoais",
};

export default async function PersonalDataPage() {
	const session = await requireCurrentClient();
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
		<div className="pb-12">
			<PageHead title="Meus dados" trail={ACCOUNT_TRAIL} />
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
		</div>
	);
}
