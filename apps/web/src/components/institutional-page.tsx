import { PageContainer } from "@/components/page-container";

export interface InstitutionalSection {
	bullets?: string[];
	id: string;
	paragraphs: string[];
	title: string;
}

interface InstitutionalPageProps {
	children?: React.ReactNode;
	/**
	 * Entradas extras do sumário, para seções renderizadas via `children`
	 * (ex.: a lista de filiais em /entrega). Vão depois de `sections`.
	 */
	extraTocItems?: Array<{ id: string; title: string }>;
	/** Rótulo curto acima do título (Barlow Condensed, uppercase). */
	label: string;
	lede: string;
	sections: InstitutionalSection[];
	title: string;
	/** ISO `YYYY-MM-DD`; exibido como "Atualizado em dd/mm/aaaa". */
	updatedAt: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatDateBR(iso: string): string {
	if (!ISO_DATE.test(iso)) {
		return iso;
	}
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}

/**
 * Página de texto institucional: hero escuro compacto (mesmo do catálogo) +
 * corpo claro em duas colunas (sumário fixo à esquerda, seções à direita).
 * Superfície clara = bg-gray-10; separação por hairline `border-border`.
 */
export function InstitutionalPage({
	children,
	extraTocItems,
	label,
	lede,
	sections,
	title,
	updatedAt,
}: InstitutionalPageProps) {
	return (
		<main className="bg-gray-10" id="main-content">
			<section className="bg-near-black py-12 text-white">
				<PageContainer>
					<div className="mb-3 font-display font-semibold text-[12px] text-white/55 uppercase tracking-widest">
						{label}
					</div>
					<h1 className="max-w-180 text-balance font-display font-medium text-[clamp(36px,5vw,60px)] leading-[1.02] tracking-[-0.01em]">
						{title}
					</h1>
					<p className="mt-4 max-w-150 text-[16px] text-white/70 leading-relaxed">
						{lede}
					</p>
					<p className="mt-6 font-display text-[12px] text-white/45 uppercase tracking-[0.14em]">
						Atualizado em{" "}
						<time dateTime={updatedAt}>{formatDateBR(updatedAt)}</time>
					</p>
				</PageContainer>
			</section>

			<PageContainer className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-16">
				<nav aria-labelledby="sumario" className="hidden lg:block">
					<h2
						className="pb-4 font-bold font-display text-[12px] uppercase tracking-[0.14em]"
						id="sumario"
					>
						Nesta página
					</h2>
					<ol className="sticky top-24 flex flex-col gap-2 border-border border-l pl-4">
						{[...sections, ...(extraTocItems ?? [])].map((s) => (
							<li key={s.id}>
								<a
									className="text-[14px] text-gray-60 transition-colors hover:text-near-black"
									href={`#${s.id}`}
								>
									{s.title}
								</a>
							</li>
						))}
					</ol>
				</nav>

				<div className="max-w-[72ch]">
					{sections.map((s) => (
						<section
							className="scroll-mt-24 border-border border-b py-8 first:pt-0"
							id={s.id}
							key={s.id}
						>
							<h2 className="font-display font-medium text-[26px] text-near-black leading-tight tracking-[-0.01em]">
								{s.title}
							</h2>
							{s.paragraphs.map((p) => (
								<p
									className="mt-4 text-[16px] text-gray-60 leading-[1.65]"
									key={p}
								>
									{p}
								</p>
							))}
							{s.bullets && s.bullets.length > 0 && (
								<ul className="mt-4 list-disc space-y-2 pl-5 text-[16px] text-gray-60 leading-[1.6]">
									{s.bullets.map((b) => (
										<li key={b}>{b}</li>
									))}
								</ul>
							)}
						</section>
					))}
					{children}
				</div>
			</PageContainer>
		</main>
	);
}
