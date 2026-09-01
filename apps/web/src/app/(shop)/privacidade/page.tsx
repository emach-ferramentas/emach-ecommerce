import type { Metadata } from "next";

import { InstitutionalPage } from "@/components/institutional-page";
import { SiteHeader } from "@/components/site-header";
import { canonicalFor } from "@/lib/seo/canonical";

import { PRIVACY_LEDE, PRIVACY_UPDATED_AT, privacySections } from "./_content";

export const metadata: Metadata = {
	title: "Privacidade e proteção de dados",
	description:
		"Quais dados a EMACH coleta na loja virtual, por quê, com quem compartilha e como você pede para ver, corrigir ou apagar.",
	alternates: canonicalFor("/privacidade"),
};

export default function PrivacyPage() {
	return (
		<>
			<SiteHeader />
			<InstitutionalPage
				label="Privacidade"
				lede={PRIVACY_LEDE}
				sections={privacySections}
				title="Privacidade e proteção de dados"
				updatedAt={PRIVACY_UPDATED_AT}
			/>
		</>
	);
}
