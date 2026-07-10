// apps/web/src/app/(shop)/catalog/_components/filter-panel.tsx
"use client";

import type { CategoryNode } from "@emach/db/queries/categories";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@emach/ui/components/accordion";
import { RadioGroup, RadioGroupItem } from "@emach/ui/components/radio-group";
import { Switch } from "@emach/ui/components/switch";
import { cn } from "@emach/ui/lib/utils";
import type { VoltageKey } from "../_lib/catalog-filters";
import type { FacetCounts } from "../_lib/facet-counts";
import { matchPriceRange, PRICE_RANGES } from "../_lib/price-ranges";
import { CategoryDrilldown } from "./category-drilldown";

const VOLTAGE_OPTIONS: VoltageKey[] = ["127V", "220V", "Bivolt", "380V"];
const FILTER_SECTIONS = ["categoria", "preco", "voltagem"];

interface FilterPanelProps {
	activeSlug: string | null;
	facetCounts: FacetCounts;
	/** Prefixo de id p/ evitar colisão entre instâncias (desktop × drawer). */
	idPrefix: string;
	onApplyPrice: () => void;
	onlyPromo: boolean;
	onPmaxChange: (value: string) => void;
	onPminChange: (value: string) => void;
	onSelectCategory: (slug: string | null) => void;
	onSelectPriceRange: (pmin: number | null, pmax: number | null) => void;
	onTogglePromo: (value: boolean) => void;
	onToggleVoltage: (value: VoltageKey) => void;
	pmaxValue: string;
	pminValue: string;
	priceMax: number | null;
	priceMin: number | null;
	tree: CategoryNode[];
	voltages: VoltageKey[];
}

/** Badge de nº de seleções ativas no header de um grupo. */
function SectionBadge({ count }: { count: number }) {
	if (count === 0) {
		return null;
	}
	return (
		<span className="ml-2 flex h-4 min-w-4 items-center justify-center bg-near-black px-1 font-bold text-[10px] text-white">
			{count}
		</span>
	);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="font-bold font-display text-[11.5px] text-near-black uppercase tracking-[0.14em]">
			{children}
		</span>
	);
}

/**
 * Corpo dos filtros do catálogo, compartilhado entre a sidebar desktop
 * (`hidden lg:block`) e o drawer mobile (`Sheet`). `idPrefix` mantém os
 * `htmlFor`/`id` únicos quando ambas as instâncias coexistem no DOM.
 */
export function FilterPanel({
	idPrefix,
	tree,
	activeSlug,
	facetCounts,
	onSelectCategory,
	pminValue,
	pmaxValue,
	priceMin,
	priceMax,
	onPminChange,
	onPmaxChange,
	onApplyPrice,
	onSelectPriceRange,
	onlyPromo,
	onTogglePromo,
	voltages,
	onToggleVoltage,
}: FilterPanelProps) {
	const promoId = `${idPrefix}-filter-promo`;
	const matchedRange = matchPriceRange(priceMin, priceMax);
	const hasPrice = priceMin !== null || priceMax !== null;

	return (
		<div>
			<Accordion defaultValue={FILTER_SECTIONS} multiple>
				<AccordionItem value="categoria">
					<AccordionTrigger className="py-3.5 hover:no-underline">
						<SectionLabel>Categoria</SectionLabel>
						<SectionBadge count={activeSlug ? 1 : 0} />
					</AccordionTrigger>
					<AccordionContent className="pb-4">
						<CategoryDrilldown
							activeSlug={activeSlug}
							counts={facetCounts.byCategory}
							onSelect={onSelectCategory}
							totalCount={facetCounts.total}
							tree={tree}
						/>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="preco">
					<AccordionTrigger className="py-3.5 hover:no-underline">
						<SectionLabel>Preço</SectionLabel>
						<SectionBadge count={hasPrice ? 1 : 0} />
					</AccordionTrigger>
					<AccordionContent className="pb-4">
						<RadioGroup
							aria-label="Faixa de preço"
							onValueChange={(value) => {
								const range = PRICE_RANGES.find((r) => r.key === value);
								if (range) {
									onSelectPriceRange(range.pmin, range.pmax);
								}
							}}
							value={matchedRange ?? ""}
						>
							{PRICE_RANGES.map((r) => {
								const id = `${idPrefix}-price-${r.key}`;
								return (
									<label
										className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[14px] lg:min-h-9"
										htmlFor={id}
										key={r.key}
									>
										<RadioGroupItem
											className="data-checked:border-near-black data-checked:bg-near-black"
											id={id}
											value={r.key}
										/>
										<span
											className={cn(
												"flex-1",
												matchedRange === r.key
													? "font-semibold text-near-black"
													: "text-gray-60"
											)}
										>
											{r.label}
										</span>
										<span className="text-[11.5px] text-gray-60 tabular-nums">
											{facetCounts.byPriceRange[r.key]}
										</span>
									</label>
								);
							})}
						</RadioGroup>
						<div className="mt-2.5 flex items-center gap-1.5">
							<input
								aria-label="Preço mínimo em reais"
								className="emach-input emach-input--sm w-full"
								inputMode="numeric"
								onChange={(e) => onPminChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										onApplyPrice();
									}
								}}
								placeholder="R$ mín"
								type="number"
								value={pminValue}
							/>
							<input
								aria-label="Preço máximo em reais"
								className="emach-input emach-input--sm w-full"
								inputMode="numeric"
								onChange={(e) => onPmaxChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										onApplyPrice();
									}
								}}
								placeholder="R$ máx"
								type="number"
								value={pmaxValue}
							/>
							<button
								className="flex h-9 shrink-0 cursor-pointer items-center border border-near-black bg-white px-3 font-bold font-display text-[12px] uppercase tracking-[0.08em] transition-colors hover:bg-near-black hover:text-white"
								onClick={onApplyPrice}
								type="button"
							>
								OK
							</button>
						</div>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="voltagem">
					<AccordionTrigger className="py-3.5 hover:no-underline">
						<SectionLabel>Voltagem</SectionLabel>
						<SectionBadge count={voltages.length} />
					</AccordionTrigger>
					<AccordionContent className="pb-4">
						<div className="grid grid-cols-2 gap-1.5">
							{VOLTAGE_OPTIONS.map((v) => {
								const selected = voltages.includes(v);
								const count = facetCounts.byVoltage[v];
								const disabled = count === 0 && !selected;
								return (
									<button
										aria-pressed={selected}
										className={cn(
											"flex min-h-11 cursor-pointer items-center justify-center gap-1.5 border font-semibold text-[13px] transition-colors lg:min-h-9",
											selected
												? "border-near-black bg-near-black text-white"
												: "border-border bg-white text-near-black hover:border-near-black",
											disabled &&
												"cursor-not-allowed opacity-45 hover:border-border"
										)}
										disabled={disabled}
										key={v}
										onClick={() => onToggleVoltage(v)}
										type="button"
									>
										{v}
										<span
											className={cn(
												"text-[11px] tabular-nums",
												selected ? "text-white/55" : "text-gray-60"
											)}
										>
											{count}
										</span>
									</button>
								);
							})}
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<label
				className="flex min-h-11 cursor-pointer items-center gap-2.5 border-border border-t py-3.5 lg:min-h-9"
				htmlFor={promoId}
			>
				<Switch
					checked={onlyPromo}
					className="data-checked:bg-near-black"
					id={promoId}
					onCheckedChange={(v) => onTogglePromo(v === true)}
				/>
				<span className="text-[14px]">Apenas em promoção</span>
				<span className="ml-auto text-[11.5px] text-gray-60 tabular-nums">
					{facetCounts.promo}
				</span>
			</label>
		</div>
	);
}
