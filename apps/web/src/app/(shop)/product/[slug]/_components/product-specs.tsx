import type { ToolDetail } from "@emach/db/queries/tools";
import { SectionLabel } from "@/components/section-label";
import { fmtSpecNumber, fmtSpecRange } from "@/lib/format";

interface ProductSpecsProps {
	attributes: ToolDetail["attributes"];
	categoryName?: string | null;
	tool: ToolDetail["tool"];
}

const HERO_COUNT = 3;
// Separa "650 W" → número grande + unidade menor. Valores sem unidade
// numérica ("até 2.800 RPM", "Sim") caem no else e renderizam inteiros.
const HERO_VALUE = /^([\d.,]+)\s*(\S.*)$/;

function fmtAttr(item: ToolDetail["attributes"][number]): string {
	const { definition, value } = item;
	const unit = definition.unit ?? "";
	switch (definition.inputType) {
		case "boolean": {
			if (value.valueBool == null) {
				return "—";
			}
			return value.valueBool ? "Sim" : "Não";
		}
		case "numeric_range":
			return fmtSpecRange(value.valueNumeric, value.valueNumericMax, unit);
		case "number":
			return fmtSpecNumber(value.valueNumeric, unit);
		default:
			return value.valueText ?? "—";
	}
}

function heroParts(formatted: string): { num: string; unit: string | null } {
	const match = HERO_VALUE.exec(formatted);
	return match
		? { num: match[1], unit: match[2] }
		: { num: formatted, unit: null };
}

export function ProductSpecs({
	attributes,
	tool,
	categoryName,
}: ProductSpecsProps) {
	const sorted = [...attributes].sort((a, b) => a.sortOrder - b.sortOrder);
	const hero = sorted.slice(0, HERO_COUNT);
	const rest = sorted.slice(HERO_COUNT);
	// Índice da primeira célula da última linha do grid de 2 colunas — usado
	// pra zerar a border inferior dessa linha (linhas correm de borda a borda).
	const lastRowStart =
		rest.length % 2 === 0 ? rest.length - 2 : rest.length - 1;

	return (
		<section aria-label="Especificações do produto" className="py-14">
			{/* Largura alinhada ao topo (galeria w-1/2 + buy box w-[480px],
			    centrados) — replica 50vw + 480px, com teto p/ telas estreitas. */}
			<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]">
				<div className="mb-5 flex items-baseline justify-between gap-6">
					<SectionLabel tone="accent">Ficha da ferramenta</SectionLabel>
					{categoryName && (
						<span className="font-display font-semibold text-[11.5px] text-gray-60 uppercase tracking-[0.1em]">
							{categoryName}
						</span>
					)}
				</div>

				{tool.description && (
					<p className="mb-7 max-w-[70ch] text-[15px] text-near-black/80 leading-relaxed">
						{tool.description}
					</p>
				)}

				{attributes.length === 0 ? (
					<p className="text-[15px] text-gray-60">
						Nenhuma especificação cadastrada.
					</p>
				) : (
					<>
						{hero.length > 0 && (
							<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5">
								{hero.map((attr, i) => {
									const { num, unit } = heroParts(fmtAttr(attr));
									// Total ímpar: o último card ocupa a linha inteira no
									// mobile 2-up, evitando o "meio-card" órfão.
									const spanLast =
										hero.length % 2 === 1 && i === hero.length - 1;
									return (
										<div
											className={`bg-near-black px-4 py-4 text-white sm:px-6 sm:py-5 ${
												spanLast ? "col-span-2 sm:col-span-1" : ""
											}`}
											key={attr.definition.id}
										>
											<span className="font-display font-semibold text-[10px] text-white/55 uppercase tracking-[0.12em]">
												{attr.definition.label}
											</span>
											<div className="mt-2 font-bold font-display text-[30px] leading-none sm:text-[38px]">
												{num}
												{unit && (
													<span className="ml-1 font-semibold text-[16px] text-white/60 sm:text-[20px]">
														{unit}
													</span>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}

						{rest.length > 0 && (
							<div className="mt-3.5 bg-near-black text-white">
								<div className="border-white/25 border-b px-6 py-4">
									<SectionLabel tone="accent">
										Especificações completas
									</SectionLabel>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2">
									{rest.map((attr, i) => (
										<div
											className={`flex items-baseline justify-between gap-4 border-white/25 border-b px-6 py-3.5 ${
												i % 2 === 0 ? "sm:border-r" : ""
											} ${i >= lastRowStart ? "sm:border-b-0" : ""} ${
												i === rest.length - 1 ? "max-sm:border-b-0" : ""
											}`}
											key={attr.definition.id}
										>
											<span className="text-[14.5px] text-white/72">
												{attr.definition.label}
											</span>
											<span className="font-semibold text-[14.5px]">
												{fmtAttr(attr)}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</section>
	);
}
