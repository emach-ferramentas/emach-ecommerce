import { PageHead } from "@/components/page-head";

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
	lede: string;
	sections: InstitutionalSection[];
	title: string;
	/** ISO `YYYY-MM-DD`; exibido como "Atualizado em dd/mm/aaaa". */
	updatedAt: string;
}

export const INSTITUTIONAL_H2_CLASS =
	"font-display font-extrabold text-[28px] text-ink uppercase leading-[0.95]";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatDateBR(iso: string): string {
	if (!ISO_DATE.test(iso)) {
		return iso;
	}
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}

export function InstitutionalPage({
	children,
	extraTocItems,
	lede,
	sections,
	title,
	updatedAt,
}: InstitutionalPageProps) {
	return (
		<div className="bg-paper pb-16 md:pb-24">
			<div className="shop-wrap">
				<PageHead title={title}>
					<p className="max-w-[65ch] leading-relaxed">{lede}</p>
					<p className="mt-3 text-[13.5px] text-ink-muted">
						Atualizado em{" "}
						<time dateTime={updatedAt}>{formatDateBR(updatedAt)}</time>
					</p>
				</PageHead>

				<div className="grid grid-cols-1 gap-10 border-line border-t pt-8 md:pt-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
					<nav aria-labelledby="sumario" className="hidden lg:block">
						<div className="sticky top-6">
							<h2 className="pb-3 font-bold text-[15px] text-ink" id="sumario">
								Nesta página
							</h2>
							<ol className="flex flex-col gap-2.5 border-line border-l pl-4">
								{[...sections, ...(extraTocItems ?? [])].map((s) => (
									<li key={s.id}>
										<a
											className="text-[14px] text-ink-2 leading-snug underline-offset-[3px] hover:text-ink hover:underline"
											href={`#${s.id}`}
										>
											{s.title}
										</a>
									</li>
								))}
							</ol>
						</div>
					</nav>

					<div className="max-w-[70ch]">
						{sections.map((s) => (
							<section
								className="scroll-mt-6 border-line border-b py-8 first:pt-0"
								id={s.id}
								key={s.id}
							>
								<h2 className={INSTITUTIONAL_H2_CLASS}>{s.title}</h2>
								{s.paragraphs.map((p) => (
									<p
										className="mt-4 text-[16.5px] text-ink-2 leading-[1.65]"
										key={p}
									>
										{p}
									</p>
								))}
								{s.bullets && s.bullets.length > 0 && (
									<ul className="mt-4 list-disc space-y-2 pl-5 text-[16.5px] text-ink-2 leading-[1.6] marker:text-ink-muted">
										{s.bullets.map((b) => (
											<li key={b}>{b}</li>
										))}
									</ul>
								)}
							</section>
						))}
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}
