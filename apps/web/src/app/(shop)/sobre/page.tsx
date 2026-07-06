import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Fragment } from "react";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";
import {
	type BusinessHoursRow,
	branchMapsUrl,
	formatBranchAddress,
	formatPhone,
	getActiveBranches,
	getBusinessHoursRows,
} from "@/lib/branches";

export const metadata: Metadata = {
	title: "Quem somos",
	description:
		"Como escolhemos as ferramentas que vendemos, o suporte que damos antes e depois da compra e onde ficam nossas filiais.",
};

const aboutPillars = [
	{
		id: "curadoria",
		label: "Curadoria",
		title: "Escolhidas pra trabalho pesado",
		description:
			"Cada ferramenta do catálogo aguenta rotina de obra e indústria, sem item de vitrine",
		tone: "light",
	},
	{
		id: "atendimento",
		label: "Atendimento",
		title: "Suporte de quem entende de ferramenta",
		description:
			"A gente ajuda a escolher e resolve se der problema, da garantia ao reparo",
		tone: "dark",
	},
] as const;

const sideNotes = [
	{
		id: "linha-profissional",
		label: "Linha profissional",
		text: "Feitas pra trabalhar todo dia, não pro fim de semana",
	},
	{
		id: "presenca-fisica",
		label: "Presença física",
		text: "Loja de verdade: você retira, testa e tira dúvida pessoalmente",
	},
	{
		id: "garantia",
		label: "Garantia",
		text: "A garantia é nossa, não terceirizada: peça e mão de obra por conta da EMACH",
	},
] as const;

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

export default async function AboutPage() {
	const branches = await getBranches();
	const branchCount = branches.length;
	const branchLabel = pluralizeBranches(branchCount);

	return (
		<>
			<SiteHeader />

			<main className="bg-gray-10" id="main-content">
				<section className="relative min-h-[calc(100svh-56px)] overflow-hidden bg-black text-white">
					<div
						aria-hidden="true"
						className="absolute inset-0 bg-[radial-gradient(circle_at_66%_28%,rgba(218,41,28,0.19),transparent_24%),linear-gradient(128deg,rgba(255,255,255,0.065)_0_1px,transparent_1px_34px)]"
					/>
					<div
						aria-hidden="true"
						className="absolute top-10 right-[-0.08em] font-bold font-display text-[clamp(86px,14vw,190px)] text-white/8 leading-[0.75] tracking-[-0.055em]"
					>
						EMACH
					</div>

					<PageContainer className="relative grid min-h-[calc(100svh-56px)] grid-cols-1 gap-8 px-6 py-12 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_360px_minmax(0,0.9fr)] lg:px-12 lg:py-14 xl:gap-10">
						<div className="flex flex-col justify-between gap-10">
							<h1 className="max-w-180 text-balance font-bold font-display text-[clamp(46px,8vw,82px)] leading-[0.88] tracking-[-0.02em]">
								Ferramenta profissional, e quem responde por ela
							</h1>

							<div className="grid gap-3 sm:grid-cols-2">
								{aboutPillars.map((pillar) => (
									<article
										className={
											pillar.tone === "light"
												? "bg-gray-10 p-5 text-near-black"
												: "border border-white/20 bg-white/[0.035] p-5 text-white"
										}
										key={pillar.id}
									>
										<div
											className={
												pillar.tone === "light"
													? "font-bold font-display text-[11px] text-gray-60 uppercase tracking-[0.16em]"
													: "font-bold font-display text-[11px] text-gray-50 uppercase tracking-[0.16em]"
											}
										>
											{pillar.label}
										</div>
										<h2 className="mt-2 font-bold text-[21px] leading-[1.05]">
											{pillar.title}
										</h2>
										<p
											className={
												pillar.tone === "light"
													? "mt-2 text-[13px] text-gray-60 leading-relaxed"
													: "mt-2 text-[13px] text-white/62 leading-relaxed"
											}
										>
											{pillar.description}
										</p>
									</article>
								))}
							</div>
						</div>

						<div className="relative flex items-center justify-center py-4">
							<div
								aria-hidden="true"
								className="absolute inset-x-0 top-12 bottom-12 hidden -skew-x-12 border border-white/15 lg:block"
							/>
							<div className="relative flex -skew-x-[9deg] flex-col items-center text-center">
								<div className="font-bold font-display text-[12px] text-white/55 uppercase tracking-[0.2em]">
									Presença local
								</div>
								<div className="-my-2 font-display font-semibold text-[clamp(190px,26vw,320px)] text-transparent leading-[0.78] tracking-[-0.04em] [-webkit-text-stroke:3px_#da291c]">
									{branchCount}
								</div>
								<div className="font-bold font-display text-[clamp(22px,2.6vw,32px)] text-white uppercase tracking-[0.2em]">
									{branchLabel}
								</div>
							</div>
						</div>

						<div className="flex flex-col justify-end gap-3 lg:pb-8">
							{sideNotes.map((note) => (
								<article
									className="border border-white/20 bg-white/[0.035] p-5"
									key={note.id}
								>
									<div className="font-bold font-display text-[11px] text-gray-50 uppercase tracking-[0.16em]">
										{note.label}
									</div>
									<p className="mt-2 font-bold text-[18px] leading-[1.12]">
										{note.text}
									</p>
								</article>
							))}
						</div>

						<div
							aria-hidden="true"
							className="absolute right-6 bottom-10 left-6 h-px bg-white/15 lg:right-12 lg:left-12"
						/>
					</PageContainer>
				</section>

				<section
					className="scroll-mt-20 bg-gray-10 py-12 sm:py-16"
					id="filiais"
				>
					<PageContainer className="px-6 sm:px-8 lg:px-12">
						<div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
							<h2 className="max-w-155 font-bold font-display text-[clamp(36px,5vw,52px)] text-near-black leading-[0.95] tracking-[-0.01em]">
								Onde a gente te atende
							</h2>
							<div
								aria-hidden="true"
								className="h-0.5 w-40 bg-near-black sm:w-55"
							/>
						</div>

						<div className="grid gap-5 lg:grid-cols-2">
							{branches.map((branch) => (
								<BranchCard branch={branch} key={branch.id} />
							))}
						</div>
					</PageContainer>
				</section>
			</main>
		</>
	);
}

function BranchCard({ branch }: { branch: BranchCardData }) {
	const inner = (
		<>
			<div className="relative min-h-55 overflow-hidden bg-[#232323]">
				{branch.mapEmbedUrl ? (
					<iframe
						className="pointer-events-none absolute inset-0 h-full w-full border-0 grayscale"
						loading="lazy"
						referrerPolicy="no-referrer-when-downgrade"
						src={branch.mapEmbedUrl}
						tabIndex={-1}
						title={`Mapa da filial ${branch.name}`}
					/>
				) : (
					<div className="absolute inset-0 bg-[#232323]" />
				)}
				<div className="pointer-events-none absolute inset-0 bg-near-black/35 mix-blend-multiply" />

				<div className="absolute right-5 bottom-4 min-w-37.5 bg-emach-red p-3 text-white">
					<div className="font-bold font-display text-[10px] text-white uppercase tracking-[0.16em]">
						Filial
					</div>
					<strong className="mt-1 block text-[18px] leading-none">
						{branch.name}
					</strong>
					{branch.locality && (
						<div className="mt-1 font-bold font-display text-[10px] text-white uppercase tracking-[0.14em]">
							{branch.locality}
						</div>
					)}
				</div>
			</div>

			<div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
				<div className="grid gap-2 text-[13px] text-white/62 leading-relaxed">
					<div>
						<strong className="text-white">Endereço</strong>: {branch.address}
					</div>
					{branch.phone && (
						<div>
							<strong className="text-white">Telefone</strong>: {branch.phone}
						</div>
					)}
					{branch.hoursRows && (
						<div>
							<strong className="text-white">Horário</strong>
							<div className="mt-1 grid grid-cols-[72px_1fr] gap-x-4 gap-y-0.5">
								{branch.hoursRows.map((row) => (
									<Fragment key={row.label}>
										<span className="self-center font-bold font-display text-[11px] text-white/45 uppercase tracking-[0.14em]">
											{row.label}
										</span>
										<span
											className={
												row.value === "Fechado"
													? "text-white/38 tabular-nums"
													: "text-white/78 tabular-nums"
											}
										>
											{row.value}
										</span>
									</Fragment>
								))}
							</div>
						</div>
					)}
				</div>

				{branch.mapsUrl && (
					<span className="inline-flex h-10.5 items-center justify-center border border-white/60 px-5 font-bold text-[13px] text-white uppercase tracking-[0.08em] transition-colors group-hover:border-emach-red group-hover:bg-emach-red group-hover:text-white">
						Ver rota
					</span>
				)}
			</div>
		</>
	);

	const className =
		"group grid overflow-hidden border border-black bg-near-black text-white transition-colors hover:border-white/25 lg:grid-rows-[minmax(210px,240px)_auto]";

	if (!branch.mapsUrl) {
		return <article className={className}>{inner}</article>;
	}

	return (
		<a
			aria-label={`Ver rota da filial ${branch.name} no Google Maps`}
			className={`${className} cursor-pointer`}
			href={branch.mapsUrl}
			rel="noopener"
			target="_blank"
		>
			{inner}
		</a>
	);
}
