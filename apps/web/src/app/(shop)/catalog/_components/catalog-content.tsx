"use client";

import type { CategoryNode } from "@emach/db/queries/categories";
import type { ToolListItem } from "@emach/db/queries/tools";
import { cn } from "@emach/ui/lib/utils";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	SlidersHorizontal,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import {
	Breadcrumb,
	CATALOG_CRUMB,
	type Crumb,
	HOME_CRUMB,
} from "@/components/breadcrumb";
import { PAGE_TITLE_CLASS } from "@/components/page-head";
import { ProductCard } from "@/components/product-card";
import { Shelf as ShelfRow } from "@/components/shelf";
import type { CardExtrasByTool } from "@/lib/card-data";
import type { Shelves } from "@/lib/shelves";
import type {
	CatalogCurrentCategory,
	CatalogService,
} from "../_lib/catalog-data";
import {
	type ActiveFilter,
	buildHref,
	deriveActiveFilters,
	type FilterState,
	type FilterUpdate,
	type SortKey,
	type VoltageKey,
} from "../_lib/catalog-filters";
import type { FacetCounts } from "../_lib/facet-counts";
import { isModifiedClick } from "../_lib/is-modified-click";
import { ActiveFilters } from "./active-filters";
import { FilterDrawer } from "./filter-drawer";
import { FilterPanel } from "./filter-panel";

export interface CatalogShelves extends Shelves {
	extras: CardExtrasByTool;
}

interface CatalogContentProps {
	cardExtras: CardExtrasByTool;
	categoryTree: CategoryNode[];
	currentCategory: CatalogCurrentCategory | null;
	facetCounts: FacetCounts;
	onlyPromo: boolean;
	page: number;
	pageSize: number;
	priceMax: number | null;
	priceMin: number | null;
	query: string;
	services: CatalogService[];
	/** Vitrine em prateleiras quando o catálogo abre sem recorte; senão `null`. */
	shelves: CatalogShelves | null;
	sort: SortKey;
	tools: ToolListItem[];
	total: number;
	voltages: VoltageKey[];
}

const PAGE_LINK_CLASS =
	"inline-flex min-h-11 items-center gap-1 rounded-[3px] border-[1.5px] border-line-strong bg-paper px-4 font-bold text-[15px] text-ink no-underline hover:border-ink";

// `<a>` real para o crawler seguir a paginação; o clique simples continua na
// navegação client-side do `navigatePage` (transition + scroll ao topo).
function PageLink({
	children,
	disabled,
	href,
	onNavigate,
	rel,
}: {
	children: ReactNode;
	disabled: boolean;
	href: Route;
	onNavigate: () => void;
	rel: "prev" | "next";
}) {
	if (disabled) {
		return (
			<span
				aria-disabled="true"
				className={cn(PAGE_LINK_CLASS, "opacity-45 hover:border-line-strong")}
			>
				{children}
			</span>
		);
	}
	return (
		<Link
			className={PAGE_LINK_CLASS}
			href={href}
			onClick={(e) => {
				if (isModifiedClick(e)) {
					return;
				}
				e.preventDefault();
				onNavigate();
			}}
			rel={rel}
		>
			{children}
		</Link>
	);
}

function plural(n: number, one: string, many: string) {
	return `${n} ${n === 1 ? one : many}`;
}

function catalogBreadcrumb(
	currentCategory: CatalogCurrentCategory | null,
	searchTerm: string
): { current: string; trail: Crumb[] } {
	if (currentCategory) {
		const ancestors = currentCategory.ancestors.map((crumb) => ({
			href: `/catalog/${crumb.slug}` as Route,
			label: crumb.name,
		}));
		return {
			current: currentCategory.name,
			trail: [HOME_CRUMB, CATALOG_CRUMB, ...ancestors],
		};
	}
	if (searchTerm) {
		return { current: "Busca", trail: [HOME_CRUMB, CATALOG_CRUMB] };
	}
	return { current: "Catálogo", trail: [HOME_CRUMB] };
}

function CatalogEmpty({
	filters,
	onClearAll,
	onRemove,
	searchTerm,
	services,
}: {
	filters: ActiveFilter[];
	onClearAll: () => void;
	onRemove: (update: FilterUpdate) => void;
	searchTerm: string;
	services: CatalogService[];
}) {
	const what = searchTerm
		? `Nenhum produto da loja combina com “${searchTerm}”${filters.length > 1 ? " e os filtros marcados" : ""}.`
		: "Nenhum produto da loja atende a todos os filtros marcados.";
	return (
		<div className="rounded-[5px] border border-line-strong border-dashed bg-paper px-[18px] py-6 md:px-7 md:py-9">
			<h2 className="font-display font-extrabold text-[30px] uppercase leading-none">
				Nada por aqui
			</h2>
			<p className="mt-2.5 max-w-[60ch] text-ink-2">
				{what} Tire um filtro abaixo: às vezes a peça certa tem outro nome.
			</p>
			{filters.length > 0 && (
				<div className="mt-[18px] flex flex-wrap gap-2.5">
					{filters.map((f) => (
						<button
							className="inline-flex min-h-11 cursor-pointer items-center rounded-[3px] border-[1.5px] border-line-strong bg-paper px-4 font-bold text-[15px] text-ink hover:border-ink"
							key={f.id}
							onClick={() => onRemove(f.remove)}
							type="button"
						>
							Tirar {f.kind ? `${f.kind.toLowerCase()} ` : ""}
							{f.value}
						</button>
					))}
					{filters.length > 1 && (
						<button
							className="inline-flex min-h-11 cursor-pointer items-center rounded-[3px] bg-grafite px-4 font-bold text-[15px] text-on-dark hover:bg-black"
							onClick={onClearAll}
							type="button"
						>
							Limpar tudo
						</button>
					)}
				</div>
			)}
			{services.length > 0 && (
				<p className="mt-[22px] flex flex-wrap gap-x-[18px] gap-y-2 text-[15px]">
					{services.map((s) => (
						<Link
							className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-[3px]"
							href={s.href}
							key={s.slug}
						>
							{s.name}
						</Link>
					))}
				</p>
			)}
		</div>
	);
}

export function CatalogContent({
	cardExtras,
	categoryTree,
	currentCategory,
	facetCounts,
	onlyPromo,
	page,
	pageSize,
	priceMax,
	priceMin,
	query,
	services,
	shelves,
	sort,
	tools,
	total,
	voltages,
}: CatalogContentProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [filterOpen, setFilterOpen] = useState(false);
	const [pminLocal, setPminLocal] = useState<string>(
		priceMin == null ? "" : String(priceMin)
	);
	const [pmaxLocal, setPmaxLocal] = useState<string>(
		priceMax == null ? "" : String(priceMax)
	);

	const current: FilterState = {
		currentCategorySlug: currentCategory?.slug ?? null,
		currentCategoryName: currentCategory?.name ?? null,
		query,
		sort,
		voltages,
		priceMin,
		priceMax,
		onlyPromo,
	};

	const activeFilters = deriveActiveFilters(current).map((f) =>
		f.id === "cat" && currentCategory?.isService ? { ...f, kind: "Serviço" } : f
	);

	function navigate(updates: FilterUpdate) {
		const href = buildHref(current, { ...updates, page: null }) as Route;
		startTransition(() => {
			router.replace(href, { scroll: false });
		});
	}

	// Href real das linhas do drilldown: o crawler segue o `<a>`; o clique é
	// interceptado e vira a mesma navegação client-side do `navigate`.
	function categoryHrefFor(slug: string | null) {
		return buildHref(current, { cat: slug, page: null });
	}

	function clearAll() {
		startTransition(() => {
			router.replace("/catalog", { scroll: false });
		});
	}

	function pageHrefFor(nextPage: number): Route {
		return buildHref(current, { page: nextPage }) as Route;
	}

	function navigatePage(nextPage: number) {
		const href = pageHrefFor(nextPage);
		startTransition(() => {
			router.replace(href, { scroll: true });
		});
	}

	function toggleVoltage(v: VoltageKey) {
		const next = voltages.includes(v)
			? voltages.filter((x) => x !== v)
			: [...voltages, v];
		navigate({ voltage: next.length > 0 ? next : null });
	}

	function applyPriceFilters() {
		const minN = pminLocal.trim() ? Number(pminLocal) : Number.NaN;
		const maxN = pmaxLocal.trim() ? Number(pmaxLocal) : Number.NaN;
		navigate({
			pmin: Number.isFinite(minN) && minN >= 0 ? minN : null,
			pmax: Number.isFinite(maxN) && maxN >= 0 ? maxN : null,
		});
	}

	function selectPriceRange(pmin: number | null, pmax: number | null) {
		setPminLocal(pmin === null ? "" : String(pmin));
		setPmaxLocal(pmax === null ? "" : String(pmax));
		navigate({ pmin, pmax });
	}

	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const showFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const showTo = Math.min(page * pageSize, total);
	const searchTerm = query.trim();
	const title =
		currentCategory?.name ??
		(searchTerm ? `Busca: “${searchTerm}”` : "Catálogo");

	let countText = plural(total, "produto", "produtos");
	if (shelves) {
		countText += shelves.by === "service" ? ", organizados por serviço" : "";
	} else if (total > pageSize) {
		countText += `, mostrando ${showFrom} a ${showTo}`;
	}

	const panelProps = {
		activeSlug: currentCategory?.slug ?? null,
		categoryHrefFor,
		facetCounts,
		onApplyPrice: applyPriceFilters,
		onlyPromo,
		onPmaxChange: setPmaxLocal,
		onPminChange: setPminLocal,
		onSelectCategory: (slug: string | null) => navigate({ cat: slug }),
		onSelectPriceRange: selectPriceRange,
		onTogglePromo: (v: boolean) => navigate({ promo: v ? true : null }),
		onToggleVoltage: toggleVoltage,
		pmaxValue: pmaxLocal,
		pminValue: pminLocal,
		priceMax,
		priceMin,
		services,
		tree: categoryTree,
		voltages,
	};

	return (
		<div className="pb-16">
			<div className="shop-wrap">
				<Breadcrumb {...catalogBreadcrumb(currentCategory, searchTerm)} />

				<div className="mt-0.5 mb-4 flex flex-wrap items-end justify-between gap-4 md:mt-2">
					<div className="min-w-0">
						<h1 className={PAGE_TITLE_CLASS}>{title}</h1>
						<p
							aria-live="polite"
							className="mt-2 text-[15.5px] text-ink-2 tabular-nums"
						>
							{countText}
						</p>
						{currentCategory?.description && (
							<p className="mt-2 max-w-[68ch] text-[15.5px] text-ink-2">
								{currentCategory.description}
							</p>
						)}
					</div>
					<div className="flex w-full items-center gap-2.5 md:w-auto">
						<button
							aria-controls="filter-drawer"
							aria-expanded={filterOpen}
							aria-haspopup="dialog"
							className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[3px] border-[1.5px] border-line-strong bg-paper px-[18px] font-bold text-[15px] text-ink hover:border-ink md:flex-none lg:hidden"
							onClick={() => setFilterOpen(true)}
							type="button"
						>
							<SlidersHorizontal aria-hidden="true" className="size-5" />
							Filtros
							{activeFilters.length > 0 && (
								<span className="grid h-5 min-w-5 place-items-center rounded-[10px] bg-grafite px-1.5 text-[12px] text-white">
									{activeFilters.length}
								</span>
							)}
						</button>
						<label className="flex flex-1 items-center gap-2 font-semibold text-[14px] text-ink-muted md:flex-none">
							<span className="max-md:sr-only">Ordenar por</span>
							<span className="relative flex-1 md:flex-none">
								<select
									className="h-11 w-full cursor-pointer appearance-none rounded-[3px] border-[1.5px] border-line-strong bg-paper pr-[38px] pl-3 font-bold text-[15px] text-ink hover:border-ink md:w-auto"
									onChange={(e) =>
										navigate({ sort: e.target.value as SortKey })
									}
									value={sort}
								>
									<option value="relevance">Relevância</option>
									<option value="price-asc">Menor preço</option>
									<option value="price-desc">Maior preço</option>
									<option value="name-asc">A a Z</option>
									<option value="newest">Mais recentes</option>
								</select>
								<ChevronDown
									aria-hidden="true"
									className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink"
								/>
							</span>
						</label>
					</div>
				</div>

				<ActiveFilters
					filters={activeFilters}
					onClearAll={clearAll}
					onRemove={(update) => navigate(update)}
				/>

				<div className="grid grid-cols-1 items-start gap-9 lg:grid-cols-[250px_minmax(0,1fr)]">
					<aside aria-label="Filtros" className="sticky top-4 max-lg:hidden">
						<FilterPanel idPrefix="desktop" {...panelProps} />
					</aside>

					<div
						aria-busy={isPending}
						className={cn(
							"min-w-0 transition-opacity",
							isPending && "pointer-events-none opacity-60"
						)}
					>
						{shelves && shelves.shelves.length > 0 ? (
							<div className="grid gap-[34px] md:gap-11">
								{shelves.shelves.map((shelf) => (
									<ShelfRow
										dense
										headingLevel={2}
										href={shelf.href}
										imageSrc={shelf.imageSrc}
										inStockCount={shelf.inStockCount}
										itemCount={shelf.items.length}
										key={shelf.key}
										productCount={shelf.productCount}
										title={shelf.title}
									>
										{shelf.items.map((tool) => (
											<ProductCard
												extras={shelves.extras[tool.id]}
												key={tool.id}
												tool={tool}
											/>
										))}
									</ShelfRow>
								))}
							</div>
						) : (
							<>
								{tools.length > 0 && (
									<div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-2 xl:grid-cols-3">
										{tools.map((t) => (
											<ProductCard
												extras={cardExtras[t.id]}
												headingLevel={2}
												key={t.id}
												size="compact"
												tool={t}
											/>
										))}
									</div>
								)}

								{tools.length === 0 && (
									<CatalogEmpty
										filters={activeFilters}
										onClearAll={clearAll}
										onRemove={navigate}
										searchTerm={searchTerm}
										services={services}
									/>
								)}

								{totalPages > 1 && (
									<nav
										aria-label="Páginas"
										className="mt-8 flex items-center justify-center gap-2"
									>
										<PageLink
											disabled={page <= 1}
											href={pageHrefFor(page - 1)}
											onNavigate={() => navigatePage(page - 1)}
											rel="prev"
										>
											<ChevronLeft aria-hidden="true" className="size-4" />
											Anterior
										</PageLink>
										<span className="px-3 text-[14px] tabular-nums">
											Página <strong>{page}</strong> de {totalPages}
										</span>
										<PageLink
											disabled={page >= totalPages}
											href={pageHrefFor(page + 1)}
											onNavigate={() => navigatePage(page + 1)}
											rel="next"
										>
											Próxima
											<ChevronRight aria-hidden="true" className="size-4" />
										</PageLink>
									</nav>
								)}
							</>
						)}
					</div>
				</div>
			</div>

			<FilterDrawer
				activeCount={activeFilters.length}
				onClearAll={clearAll}
				onClose={() => setFilterOpen(false)}
				open={filterOpen}
				total={total}
			>
				<FilterPanel idPrefix="mobile" {...panelProps} />
			</FilterDrawer>
		</div>
	);
}
