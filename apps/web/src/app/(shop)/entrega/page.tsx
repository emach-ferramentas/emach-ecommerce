import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Suspense } from "react";

import { InstitutionalPage } from "@/components/institutional-page";
import { SiteHeader } from "@/components/site-header";
import {
	type BusinessHoursRow,
	formatBranchAddress,
	formatPhone,
	getActiveBranches,
	getBusinessHoursRows,
} from "@/lib/branches";
import { canonicalFor } from "@/lib/seo/canonical";

import {
	DELIVERY_LEDE,
	DELIVERY_UPDATED_AT,
	deliverySections,
} from "./_content";

export const metadata: Metadata = {
	title: "Entrega e filiais",
	description:
		"Frete cotado em tempo real por CEP, item grande com frete a combinar, e compra direta nas filiais da EMACH.",
	alternates: canonicalFor("/entrega"),
};

interface PickupBranch {
	address: string;
	hoursRows: BusinessHoursRow[] | null;
	id: string;
	name: string;
	phone: string | null;
}

async function getPickupBranches(): Promise<PickupBranch[]> {
	"use cache";
	cacheLife({ revalidate: 600 });
	const rows = await getActiveBranches();
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		address: formatBranchAddress(row),
		phone: formatPhone(row.phone),
		hoursRows: getBusinessHoursRows(row.businessHours),
	}));
}

async function PickupBranchList() {
	const branches = await getPickupBranches();
	if (branches.length === 0) {
		return null;
	}
	return (
		<section className="scroll-mt-24 py-8" id="filiais">
			<h2 className="font-display font-medium text-[26px] text-near-black leading-tight tracking-[-0.01em]">
				Onde nos encontrar
			</h2>
			<ul className="mt-6 grid gap-4 sm:grid-cols-2">
				{branches.map((b) => (
					<li className="border border-border p-5" key={b.id}>
						<div className="font-bold font-display text-[11px] text-gray-60 uppercase tracking-[0.16em]">
							Filial
						</div>
						<strong className="mt-1 block text-[18px] text-near-black">
							{b.name}
						</strong>
						<p className="mt-2 text-[14px] text-gray-60 leading-relaxed">
							{b.address}
						</p>
						{b.phone && (
							<p className="mt-1 text-[14px] text-gray-60">{b.phone}</p>
						)}
						{b.hoursRows && (
							<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
								{b.hoursRows.map((row) => (
									<div className="contents" key={row.label}>
										<dt className="text-gray-60">{row.label}</dt>
										<dd className="text-near-black">{row.value}</dd>
									</div>
								))}
							</dl>
						)}
					</li>
				))}
			</ul>
		</section>
	);
}

export default function DeliveryPage() {
	return (
		<>
			<SiteHeader />
			<InstitutionalPage
				extraTocItems={[{ id: "filiais", title: "Onde nos encontrar" }]}
				label="Entrega"
				lede={DELIVERY_LEDE}
				sections={deliverySections}
				title="Entrega e filiais"
				updatedAt={DELIVERY_UPDATED_AT}
			>
				<Suspense fallback={null}>
					<PickupBranchList />
				</Suspense>
			</InstitutionalPage>
		</>
	);
}
