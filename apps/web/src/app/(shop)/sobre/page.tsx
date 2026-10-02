import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Fragment, Suspense } from "react";

import { HOME_CRUMB } from "@/components/breadcrumb";
import { PageHead } from "@/components/page-head";
import { SiteHeader } from "@/components/site-header";
import {
	type BusinessHoursRow,
	branchMapsUrl,
	formatBranchAddress,
	formatPhone,
	getActiveBranches,
	getBusinessHoursRows,
} from "@/lib/branches";
import { canonicalFor } from "@/lib/seo/canonical";
import { ABOUT_DESCRIPTION, aboutPillars, sideNotes } from "./_content";

export const metadata: Metadata = {
	title: "Quem somos",
	description: ABOUT_DESCRIPTION,
	alternates: canonicalFor("/sobre"),
};

interface BranchCardData {
	address: string;
	hoursRows: BusinessHoursRow[] | null;
	id: string;
	locality: string;
	mapEmbedUrl: string | null;
	mapsUrl: string | null;
	name: string;
	phone: string | null;
}

function buildMapsEmbedUrl(query: string) {
	const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;

	if (apiKey) {
		const params = new URLSearchParams({
			key: apiKey,
			q: query,
			zoom: "15",
			language: "pt-BR",
			region: "BR",
		});

		return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
	}

	const fallbackParams = new URLSearchParams({
		q: query,
		output: "embed",
	});

	return `https://www.google.com/maps?${fallbackParams.toString()}`;
}

async function getBranches(): Promise<BranchCardData[]> {
	"use cache";
	cacheLife({ revalidate: 600 });
	const rows = await getActiveBranches();

	return rows.map((row) => {
		const address = formatBranchAddress(row);
		const locality = [row.city, row.state].filter(Boolean).join("/");
		const mapsQuery = [row.street, row.streetNumber, row.neighborhood, locality]
			.filter(Boolean)
			.join(", ");

		return {
			id: row.id,
			name: row.name,
			locality,
			address,
			phone: formatPhone(row.phone),
			hoursRows: getBusinessHoursRows(row.businessHours),
			mapEmbedUrl: mapsQuery ? buildMapsEmbedUrl(mapsQuery) : null,
			mapsUrl: mapsQuery ? branchMapsUrl(row) : null,
		};
	});
}

function pluralizeBranches(count: number) {
	return count === 1 ? "filial" : "filiais";
}

const SECTION_TITLE_CLASS =
	"font-display font-extrabold text-[clamp(1.75rem,1.4rem+1vw,2.25rem)] text-ink uppercase leading-[0.95]";

export default function AboutPage() {
	return (
		<>
			<SiteHeader />
			<main className="bg-paper pb-16 md:pb-24" id="main-content">
				<div className="shop-wrap">
					<PageHead
						current="Quem somos"
						title="Ferramenta profissional, e quem responde por ela"
						trail={[HOME_CRUMB]}
					>
						<p className="max-w-[65ch] leading-relaxed">{ABOUT_DESCRIPTION}</p>
					</PageHead>

					<ul className="border-line border-t">
						{aboutPillars.map((pillar) => (
							<li
								className="grid gap-2 border-line border-b py-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10 md:py-8"
								key={pillar.id}
							>
								<h2 className="font-extrabold text-[17px] text-ink">
									{pillar.label}
								</h2>
								<div className="max-w-[65ch]">
									<p className="font-bold text-[20px] text-ink leading-snug">
										{pillar.title}
									</p>
									<p className="mt-2 text-[16px] text-ink-2 leading-relaxed">
										{pillar.description}
									</p>
								</div>
							</li>
						))}
						{sideNotes.map((note) => (
							<li
								className="grid gap-2 border-line border-b py-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10 md:py-8"
								key={note.id}
							>
								<h2 className="font-extrabold text-[17px] text-ink">
									{note.label}
								</h2>
								<p className="max-w-[65ch] font-bold text-[20px] text-ink leading-snug">
									{note.text}
								</p>
							</li>
						))}
					</ul>
				</div>

				<section
					aria-labelledby="filiais-titulo"
					className="mt-12 scroll-mt-6 bg-canteiro py-12 md:mt-16 md:py-16"
					id="filiais"
				>
					<div className="shop-wrap">
						<Suspense fallback={<BranchesSkeleton />}>
							<Branches />
						</Suspense>
					</div>
				</section>
			</main>
		</>
	);
}

function BranchesSkeleton() {
	return (
		<div aria-hidden="true">
			<div className="h-9 w-72 max-w-full rounded-[3px] bg-paper" />
			<div className="mt-6 grid gap-5 lg:grid-cols-2">
				<div className="h-[420px] rounded-[5px] border border-line bg-paper" />
				<div className="h-[420px] rounded-[5px] border border-line bg-paper" />
			</div>
		</div>
	);
}

async function Branches() {
	const branches = await getBranches();
	const branchCount = branches.length;

	return (
		<>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
				<h2 className={SECTION_TITLE_CLASS} id="filiais-titulo">
					Onde a gente te atende
				</h2>
				<p className="text-[15px] text-ink-muted tabular-nums">
					{branchCount} {pluralizeBranches(branchCount)}
				</p>
			</div>

			<div className="grid gap-5 lg:grid-cols-2">
				{branches.map((branch) => (
					<BranchCard branch={branch} key={branch.id} />
				))}
			</div>
		</>
	);
}

function BranchCard({ branch }: { branch: BranchCardData }) {
	const inner = (
		<>
			<div className="relative min-h-55 overflow-hidden bg-well">
				{branch.mapEmbedUrl ? (
					<iframe
						className="pointer-events-none absolute inset-0 h-full w-full border-0 grayscale"
						loading="lazy"
						referrerPolicy="no-referrer-when-downgrade"
						src={branch.mapEmbedUrl}
						tabIndex={-1}
						title={`Mapa da filial ${branch.name}`}
					/>
				) : null}
			</div>

			<div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end md:p-6">
				<div className="min-w-0">
					<h3 className="font-extrabold text-[17px] text-ink">{branch.name}</h3>
					{branch.locality && (
						<p className="text-[14px] text-ink-muted">{branch.locality}</p>
					)}
					<dl className="mt-4 grid gap-2 text-[14.5px] text-ink-2 leading-relaxed">
						<div>
							<dt className="font-semibold text-ink">Endereço</dt>
							<dd>{branch.address}</dd>
						</div>
						{branch.phone && (
							<div>
								<dt className="font-semibold text-ink">Telefone</dt>
								<dd className="tabular-nums">{branch.phone}</dd>
							</div>
						)}
						{branch.hoursRows && (
							<div>
								<dt className="font-semibold text-ink">Horário</dt>
								<dd className="mt-1 grid grid-cols-[72px_1fr] gap-x-4 gap-y-0.5">
									{branch.hoursRows.map((row) => (
										<Fragment key={row.label}>
											<span className="text-ink-muted">{row.label}</span>
											<span
												className={
													row.value === "Fechado"
														? "text-ink-muted tabular-nums"
														: "text-ink tabular-nums"
												}
											>
												{row.value}
											</span>
										</Fragment>
									))}
								</dd>
							</div>
						)}
					</dl>
				</div>

				{branch.mapsUrl && (
					<span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border-[1.5px] border-line-strong bg-paper px-5 font-bold text-[15px] text-ink transition-colors group-hover:border-ink">
						Ver rota
						<ExternalLink aria-hidden="true" className="size-4" />
					</span>
				)}
			</div>
		</>
	);

	const className =
		"group grid overflow-hidden rounded-[5px] border border-line bg-paper text-ink lg:grid-rows-[minmax(210px,240px)_auto]";

	if (!branch.mapsUrl) {
		return <article className={className}>{inner}</article>;
	}

	return (
		<a
			aria-label={`Ver rota da filial ${branch.name} no Google Maps`}
			className={`${className} cursor-pointer no-underline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2`}
			href={branch.mapsUrl}
			rel="noopener"
			target="_blank"
		>
			{inner}
		</a>
	);
}
