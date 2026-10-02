// apps/web/src/app/(shop)/catalog/_components/filter-panel.tsx
"use client";

import type { CategoryNode } from "@emach/db/queries/categories";
import { Switch } from "@emach/ui/components/switch";
import { cn } from "@emach/ui/lib/utils";
import { Check } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { CatalogService } from "../_lib/catalog-data";
import type { VoltageKey } from "../_lib/catalog-filters";
import type { FacetCounts } from "../_lib/facet-counts";
import { isModifiedClick } from "../_lib/is-modified-click";
import { matchPriceRange, PRICE_RANGES } from "../_lib/price-ranges";
import { CategoryDrilldown } from "./category-drilldown";

const VOLTAGE_OPTIONS: VoltageKey[] = ["127V", "220V", "Bivolt", "380V"];

interface FilterPanelProps {
	activeSlug: string | null;
	/** Href de cada categoria do drilldown (link rastreável). */
	categoryHrefFor: (slug: string | null) => string;
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
	services: CatalogService[];
	tree: CategoryNode[];
	voltages: VoltageKey[];
}

function Group({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) {
	return (
		<fieldset className="min-w-0 border-ink border-t-2 pt-3 pb-[18px] first:max-lg:border-t-0">
			<legend className="float-left mb-1 w-full p-0 font-extrabold text-[15px] text-ink">
				{title}
			</legend>
			<div className="clear-both">{children}</div>
		</fieldset>
	);
}

/** Caixa de marcação desenhada (o controle real é o link ou o botão em volta). */
function Box({ checked }: { checked: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"grid size-5 shrink-0 place-items-center rounded-[2px] border-2 border-line-strong bg-paper text-white transition-colors duration-100",
				checked && "border-grafite bg-grafite"
			)}
		>
			{checked && <Check className="size-3.5" strokeWidth={3} />}
		</span>
	);
}

const optionClass =
	"flex min-h-11 w-full cursor-pointer items-center gap-3 text-left text-[15px] text-ink leading-snug no-underline [&:hover_.label]:underline";

/**
 * Corpo dos filtros do catálogo, compartilhado entre a coluna do desktop e a
 * gaveta do celular. `idPrefix` mantém os `htmlFor`/`id` únicos quando as duas
 * instâncias coexistem no DOM.
 */
export function FilterPanel({
	idPrefix,
	tree,
	services,
	activeSlug,
	facetCounts,
	categoryHrefFor,
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
	const serviceActive = services.some((s) => s.slug === activeSlug);

	return (
		<div>
			{services.length > 0 && (
				<Group title="Serviço">
					{services.map((service) => {
						const active = service.slug === activeSlug;
						return (
							<Link
								aria-current={active ? "page" : undefined}
								className={optionClass}
								href={categoryHrefFor(active ? null : service.slug) as Route}
								key={service.slug}
								onClick={(e) => {
									if (isModifiedClick(e)) {
										return;
									}
									e.preventDefault();
									onSelectCategory(active ? null : service.slug);
								}}
							>
								<Box checked={active} />
								<span className="label flex-1">{service.name}</span>
								<span className="text-[14px] text-ink-muted tabular-nums">
									{service.productCount}
								</span>
							</Link>
						);
					})}
				</Group>
			)}

			<Group title="Categoria">
				<CategoryDrilldown
					activeSlug={serviceActive ? null : activeSlug}
					counts={facetCounts.byCategory}
					hrefFor={categoryHrefFor}
					onSelect={onSelectCategory}
					totalCount={facetCounts.total}
					tree={tree}
				/>
			</Group>

			<Group title="Voltagem">
				{VOLTAGE_OPTIONS.map((v) => {
					const selected = voltages.includes(v);
					const count = facetCounts.byVoltage[v];
					const disabled = count === 0 && !selected;
					return (
						<button
							aria-pressed={selected}
							className={cn(
								optionClass,
								disabled && "cursor-not-allowed opacity-45"
							)}
							disabled={disabled}
							key={v}
							onClick={() => onToggleVoltage(v)}
							type="button"
						>
							<Box checked={selected} />
							<span className="label flex-1">{v}</span>
							<span className="text-[14px] text-ink-muted tabular-nums">
								{count}
							</span>
						</button>
					);
				})}
			</Group>

			<Group title="Preço">
				{PRICE_RANGES.map((r) => {
					const selected = matchedRange === r.key;
					return (
						<button
							aria-pressed={selected}
							className={optionClass}
							key={r.key}
							onClick={() =>
								selected
									? onSelectPriceRange(null, null)
									: onSelectPriceRange(r.pmin, r.pmax)
							}
							type="button"
						>
							<Box checked={selected} />
							<span className="label flex-1">{r.label}</span>
							<span className="text-[14px] text-ink-muted tabular-nums">
								{facetCounts.byPriceRange[r.key]}
							</span>
						</button>
					);
				})}
				<div className="mt-2 flex items-center gap-1.5">
					<input
						aria-label="Preço mínimo em reais"
						className="h-11 w-full min-w-0 rounded-[3px] border-[1.5px] border-line-strong bg-paper px-2.5 text-[15px] text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
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
						className="h-11 w-full min-w-0 rounded-[3px] border-[1.5px] border-line-strong bg-paper px-2.5 text-[15px] text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
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
						className="h-11 shrink-0 cursor-pointer rounded-[3px] bg-grafite px-3.5 font-bold text-[14px] text-on-dark hover:bg-black"
						onClick={onApplyPrice}
						type="button"
					>
						Aplicar
					</button>
				</div>
			</Group>

			<Group title="Ofertas">
				<label className={optionClass} htmlFor={promoId}>
					<Switch
						checked={onlyPromo}
						className="data-checked:bg-grafite"
						id={promoId}
						onCheckedChange={(v) => onTogglePromo(v === true)}
					/>
					<span className="label flex-1">Só em promoção</span>
					<span className="text-[14px] text-ink-muted tabular-nums">
						{facetCounts.promo}
					</span>
				</label>
			</Group>
		</div>
	);
}
