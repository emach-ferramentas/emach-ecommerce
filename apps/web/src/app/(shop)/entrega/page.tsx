import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Suspense } from "react";

import {
	INSTITUTIONAL_H2_CLASS,
	InstitutionalPage,
} from "@/components/institutional-page";
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
		<section className="scroll-mt-6 py-8" id="filiais">
			<h2 className={INSTITUTIONAL_H2_CLASS}>Onde nos encontrar</h2>
			<ul className="mt-6 grid gap-4 sm:grid-cols-2">
				{branches.map((b) => (
					<li
						className="rounded-[5px] border border-line bg-paper p-5"
						key={b.id}
					>
						<strong className="block font-extrabold text-[17px] text-ink">
							{b.name}
						</strong>
						<p className="mt-2 text-[14.5px] text-ink-2 leading-relaxed">
							{b.address}
						</p>
						{b.phone && (
							<p className="mt-1 text-[14.5px] text-ink-2 tabular-nums">
								{b.phone}
							</p>
						)}
						{b.hoursRows && (
							<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13.5px]">
								{b.hoursRows.map((row) => (
									<div className="contents" key={row.label}>
										<dt className="text-ink-muted">{row.label}</dt>
										<dd className="text-ink tabular-nums">{row.value}</dd>
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
		<InstitutionalPage
			extraTocItems={[{ id: "filiais", title: "Onde nos encontrar" }]}
			lede={DELIVERY_LEDE}
			sections={deliverySections}
			title="Entrega e filiais"
			updatedAt={DELIVERY_UPDATED_AT}
		>
			<Suspense fallback={null}>
				<PickupBranchList />
			</Suspense>
		</InstitutionalPage>
	);
}
