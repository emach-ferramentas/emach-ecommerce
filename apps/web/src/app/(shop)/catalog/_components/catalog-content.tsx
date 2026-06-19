"use client";

import type { CategoryNode } from "@emach/db/queries/categories";
import type { ToolListItem } from "@emach/db/queries/tools";
import type { Voltage } from "@emach/db/schema/tools";
import { cn } from "@emach/ui/lib/utils";
import { Grid3x3, List, SlidersHorizontal } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmachButton } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { SectionLabel } from "@/components/section-label";
import { fmtNumericBRL } from "@/lib/format";
import {
	buildHref,
	deriveActiveFilters,
	type FilterState,
	type FilterUpdate,
	type SortKey,
	type VoltageKey,
} from "../_lib/catalog-filters";
import { ActiveFilters } from "./active-filters";
import { FilterDrawer } from "./filter-drawer";
import { FilterPanel } from "./filter-panel";

interface CatalogContentProps {
	categoryTree: CategoryNode[];
	currentCategoryDescription: string | null;
	currentCategoryName: string | null;
	currentCategorySlug: string | null;
	onlyPromo: boolean;
	page: number;
	pageSize: number;
	priceMax: number | null;
	priceMin: number | null;
	query: string;
	sort: SortKey;
	tools: ToolListItem[];
	total: number;
	voltages: VoltageKey[];
	voltagesByTool?: Map<string, Voltage[]>;
}

export function CatalogContent({
	tools,
	total,
	currentCategorySlug,
	currentCategoryName,
	currentCategoryDescription,
	categoryTree,
	query,
	sort,
	voltages,
	priceMin,
	priceMax,
	onlyPromo,
	page,
	pageSize,
	voltagesByTool,
}: CatalogContentProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [isPending, startTransition] = useTransition();
	const [view, setView] = useState<"grid" | "list">("grid");
	const [filterOpen, setFilterOpen] = useState(false);
	const [pminLocal, setPminLocal] = useState<string>(
		priceMin == null ? "" : String(priceMin)
	);
	const [pmaxLocal, setPmaxLocal] = useState<string>(
		priceMax == null ? "" : String(priceMax)
	);

	const current: FilterState = {
		currentCategorySlug,
		currentCategoryName,
		query,
		sort,
		voltages,
		priceMin,
		priceMax,
		onlyPromo,
	};

	const activeFilters = deriveActiveFilters(current);

	function navigate(updates: FilterUpdate) {
		const href =
			`${pathname}${buildHref(current, { ...updates, page: null })}` as Route;
		startTransition(() => {
			router.replace(href, { scroll: false });
		});
	}

	function clearAll() {
		startTransition(() => {
			router.replace(pathname as Route, { scroll: false });
		});
	}

	function navigatePage(nextPage: number) {
		const href =
			`${pathname}${buildHref(current, { page: nextPage })}` as Route;
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

	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const showFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const showTo = Math.min(page * pageSize, total);

	// Contagem reutilizada na toolbar (desktop) e numa linha própria (mobile),
	// onde a toolbar não tem largura pra exibi-la sem quebrar.
	const productCount = (
		<>
			<strong className="text-near-black">{total}</strong> produto
			{total === 1 ? "" : "s"}
			{total > 0 && (
				<span className="ml-2">
					({showFrom}–{showTo})
				</span>
			)}
		</>
	);

	return (
		<main className="bg-gray-10" id="main-content">
			<section className="bg-near-black py-12 text-white">
				<PageContainer>
					<div className="mb-3 text-[12px] text-white/55 uppercase tracking-widest">
						HOME / CATÁLOGO
						{currentCategoryName
							? ` / ${currentCategoryName.toUpperCase()}`
							: ""}
					</div>
					<h1 className="text-balance font-display font-medium text-[clamp(36px,5vw,60px)] tracking-[-0.01em]">
						{currentCategoryName ?? "Catálogo completo"}
					</h1>
					{currentCategoryDescription && (
						<p className="mt-3 max-w-150 text-[16px] text-white/70">
							{currentCategoryDescription}
						</p>
					)}
					{query.trim() && (
						<div className="mt-4 inline-flex items-center gap-2 rounded-[2px] border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] text-white">
							Busca: <strong>“{query}”</strong>
							<button
								aria-label="Limpar busca"
								className="relative ml-1 flex size-11 items-center justify-center text-white/60 hover:text-white"
								onClick={() => navigate({ q: null })}
								type="button"
							>
								×
							</button>
						</div>
					)}
				</PageContainer>
			</section>

			<PageContainer className="grid grid-cols-1 gap-0 py-8 lg:grid-cols-[260px_1fr] lg:gap-10">
				<aside className="hidden lg:block">
					<div className="pb-4 font-bold font-display text-[12px] uppercase tracking-[0.14em]">
						FILTROS
					</div>
					<FilterPanel
						activeSlug={currentCategorySlug}
						idPrefix="desktop"
						onApplyPrice={applyPriceFilters}
						onlyPromo={onlyPromo}
						onPmaxChange={setPmaxLocal}
						onPminChange={setPminLocal}
						onSelectCategory={(slug) => navigate({ cat: slug })}
						onTogglePromo={(v) => navigate({ promo: v ? true : null })}
						onToggleVoltage={toggleVoltage}
						pmaxValue={pmaxLocal}
						pminValue={pminLocal}
						tree={categoryTree}
						voltages={voltages}
					/>
				</aside>

				<div>
					<ActiveFilters
						filters={activeFilters}
						onClearAll={clearAll}
						onRemove={(update) => navigate(update)}
					/>
					<div className="mb-5 flex flex-wrap items-center gap-3 border-border border-b pb-3">
						<button
							aria-controls="filter-drawer"
							aria-expanded={filterOpen}
							aria-haspopup="dialog"
							className="flex h-9 cursor-pointer items-center gap-2 border border-border bg-white px-3 font-display font-semibold text-[12px] text-near-black uppercase tracking-[0.08em] lg:hidden"
							onClick={() => setFilterOpen(true)}
							type="button"
						>
							<SlidersHorizontal size={15} />
							Filtros
							{activeFilters.length > 0 && (
								<span className="flex h-4 min-w-4 items-center justify-center bg-emach-red px-1 font-bold text-[10px] text-white">
									{activeFilters.length}
								</span>
							)}
						</button>
						<div className="hidden text-[13px] text-gray-60 sm:block">
							{productCount}
						</div>

						<div className="ml-auto flex items-center gap-2 sm:gap-4">
							<select
								className="emach-select emach-select--sm w-40 sm:w-45"
								onChange={(e) => navigate({ sort: e.target.value as SortKey })}
								value={sort}
							>
								<option value="relevance">Relevância</option>
								<option value="price-asc">Menor preço</option>
								<option value="price-desc">Maior preço</option>
								<option value="name-asc">A–Z</option>
								<option value="newest">Mais recentes</option>
							</select>

							<div className="flex border border-border">
								<button
									aria-label="Grade"
									className={cn(
										"flex size-9 cursor-pointer items-center justify-center border-none",
										view === "grid"
											? "bg-near-black text-white"
											: "bg-white text-near-black"
									)}
									onClick={() => setView("grid")}
									type="button"
								>
									<Grid3x3 size={14} />
								</button>
								<button
									aria-label="Lista"
									className={cn(
										"flex size-9 cursor-pointer items-center justify-center border-none",
										view === "list"
											? "bg-near-black text-white"
											: "bg-white text-near-black"
									)}
									onClick={() => setView("list")}
									type="button"
								>
									<List size={14} />
								</button>
							</div>
						</div>
					</div>

					<div className="mb-4 text-[13px] text-gray-60 sm:hidden">
						{productCount}
					</div>

					<div
						aria-busy={isPending}
						className={cn(isPending && "pointer-events-none opacity-60")}
					>
						{view === "grid" ? (
							<div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
								{tools.map((t) => (
									<ProductCard
										key={t.id}
										tool={t}
										voltages={voltagesByTool?.get(t.id)}
									/>
								))}
							</div>
						) : (
							<div className="flex flex-col">
								{tools.map((t) => (
									<Link
										className="-mx-3 flex cursor-pointer items-center gap-4 border-gray-20 border-b px-3 py-4 transition-colors duration-200 hover:bg-image-bg motion-reduce:transition-none sm:gap-6 sm:py-5"
										href={`/product/${t.slug}`}
										key={t.id}
									>
										<div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-image-bg sm:w-35">
											<ProductImage
												alt={t.name}
												categorySlug={t.primaryCategory?.slug ?? ""}
												sizes="(max-width: 640px) 96px, 140px"
												src={t.primaryImage?.url}
											/>
										</div>
										<div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
											<div className="min-w-0">
												<SectionLabel>
													{t.primaryCategory?.name ?? ""}
												</SectionLabel>
												<div className="mt-1 font-medium text-[15px] sm:text-[18px]">
													{t.name}
												</div>
												<div className="mt-1.5 text-[12px] text-gray-60 sm:text-[13px]">
													SKU {t.defaultVariant.sku}
													{t.defaultVariant.voltage
														? ` · ${t.defaultVariant.voltage}`
														: ""}
													{t.hasOtherVariants ? " · mais opções" : ""}
												</div>
											</div>
											<div className="shrink-0 sm:text-right">
												<div className="font-bold text-[18px] tabular-nums sm:text-[20px]">
													{fmtNumericBRL(
														t.defaultVariant.discountedAmount ??
															t.defaultVariant.priceAmount
													)}
												</div>
												{t.defaultVariant.discountedAmount && (
													<div className="text-[12px] text-gray-60 tabular-nums line-through">
														{fmtNumericBRL(t.defaultVariant.priceAmount)}
													</div>
												)}
											</div>
										</div>
									</Link>
								))}
							</div>
						)}
					</div>

					{tools.length === 0 && (
						<div className="py-20 text-center text-gray-60">
							<div className="font-medium text-[15px]">
								Nenhum produto encontrado
							</div>
							<div className="mt-1.5 text-[13px]">
								Ajuste os filtros para ver mais resultados.
							</div>
						</div>
					)}

					{totalPages > 1 && (
						<div className="mt-8 flex items-center justify-center gap-2">
							<EmachButton
								disabled={page <= 1}
								onClick={() => navigatePage(page - 1)}
								size="sm"
								variant="ghost"
							>
								Anterior
							</EmachButton>
							<span className="px-3 text-[13px] tabular-nums">
								Página <strong>{page}</strong> de {totalPages}
							</span>
							<EmachButton
								disabled={page >= totalPages}
								onClick={() => navigatePage(page + 1)}
								size="sm"
								variant="ghost"
							>
								Próxima
							</EmachButton>
						</div>
					)}
				</div>
			</PageContainer>

			<FilterDrawer
				activeCount={activeFilters.length}
				onClearAll={clearAll}
				onClose={() => setFilterOpen(false)}
				open={filterOpen}
				total={total}
			>
				<FilterPanel
					activeSlug={currentCategorySlug}
					idPrefix="mobile"
					onApplyPrice={applyPriceFilters}
					onlyPromo={onlyPromo}
					onPmaxChange={setPmaxLocal}
					onPminChange={setPminLocal}
					onSelectCategory={(slug) => navigate({ cat: slug })}
					onTogglePromo={(v) => navigate({ promo: v ? true : null })}
					onToggleVoltage={toggleVoltage}
					pmaxValue={pmaxLocal}
					pminValue={pminLocal}
					tree={categoryTree}
					voltages={voltages}
				/>
			</FilterDrawer>
		</main>
	);
}
