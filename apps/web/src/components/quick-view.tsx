"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useId, useState } from "react";

import { PhotoGallery } from "@/components/buy/photo-gallery";
import { QtyStepper } from "@/components/buy/qty-stepper";
import { VoltagePicker } from "@/components/buy/voltage-picker";
import { StockLine } from "@/components/stock-line";
import {
	type QuickViewProduct,
	quickViewAction,
} from "@/lib/actions/quick-view";
import { useCartActions } from "@/lib/cart-context";
import { fmtNumericBRL, numericToCents } from "@/lib/format";
import { buildSlots } from "@/lib/gallery-slots";
import { installmentLabel } from "@/lib/installments";
import { buildCartItem, initialVariantId } from "@/lib/purchase";
import { useOverlay } from "@/lib/use-overlay";

type OpenQuickView = (slug: string) => void;

const QuickViewContext = createContext<OpenQuickView>(() => undefined);

/** Abre o "Ver rápido" de um produto pelo slug. */
export function useQuickView(): OpenQuickView {
	return useContext(QuickViewContext);
}

/** Um só "Ver rápido" na árvore; os cards só pedem para abrir. */
export function QuickViewProvider({ children }: { children: React.ReactNode }) {
	const [slug, setSlug] = useState<string | null>(null);
	return (
		<QuickViewContext.Provider value={setSlug}>
			{children}
			{slug && <QuickViewDialog onClose={() => setSlug(null)} slug={slug} />}
		</QuickViewContext.Provider>
	);
}

type LoadState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "ready"; product: QuickViewProduct };

function QuickViewDialog({
	onClose,
	slug,
}: {
	onClose: () => void;
	slug: string;
}) {
	const titleId = useId();
	const panelRef = useOverlay(true, onClose);
	const [state, setState] = useState<LoadState>({ status: "loading" });

	useEffect(() => {
		let stale = false;
		setState({ status: "loading" });
		quickViewAction({ slug })
			.then((res) => {
				if (stale) {
					return;
				}
				setState(
					res.ok
						? { status: "ready", product: res.data }
						: { status: "error", message: res.error }
				);
			})
			.catch(() => {
				if (!stale) {
					setState({
						status: "error",
						message: "Não foi possível abrir o produto agora.",
					});
				}
			});
		return () => {
			stale = true;
		};
	}, [slug]);

	return (
		<div className="fixed inset-0 z-[70] grid place-items-center p-6 max-md:place-items-end max-md:p-0">
			<button
				aria-label="Fechar"
				className="fade-in absolute inset-0 animate-in cursor-default bg-grafite-deep/60 duration-200"
				onClick={onClose}
				tabIndex={-1}
				type="button"
			/>
			<div
				aria-busy={state.status === "loading"}
				aria-labelledby={titleId}
				aria-modal="true"
				className="relative max-h-[calc(100svh-48px)] w-[min(960px,100%)] animate-[emach-qv-in_380ms_var(--ease-expo)_both] overflow-y-auto overscroll-contain rounded-[5px] bg-paper shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] motion-reduce:animate-none max-md:max-h-[92svh] max-md:animate-[emach-sheet-in_380ms_var(--ease-expo)_both] max-md:rounded-t-xl max-md:rounded-b-none"
				ref={panelRef}
				role="dialog"
			>
				<span
					aria-hidden="true"
					className="mx-auto mt-2 block h-1 w-11 rounded-sm bg-line-strong md:hidden"
				/>
				<button
					aria-label="Fechar"
					className="absolute top-2.5 right-2.5 z-[3] grid size-11 cursor-pointer place-items-center rounded-[3px] border border-line bg-paper hover:bg-canteiro"
					onClick={onClose}
					type="button"
				>
					<X aria-hidden="true" className="size-6" />
				</button>
				{state.status === "ready" ? (
					<QuickViewBody
						onDone={onClose}
						product={state.product}
						titleId={titleId}
					/>
				) : (
					<div className="grid min-h-[320px] place-items-center p-8 text-center">
						<p className="text-[15px] text-ink-2" id={titleId}>
							{state.status === "loading"
								? "Carregando o produto…"
								: state.message}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

function QuickViewBody({
	onDone,
	product,
	titleId,
}: {
	onDone: () => void;
	product: QuickViewProduct;
	titleId: string;
}) {
	const { add, openSheet } = useCartActions();
	const [variantId, setVariantId] = useState(() =>
		initialVariantId(product.variants)
	);
	const [qty, setQty] = useState(1);
	const [voltageError, setVoltageError] = useState(false);

	const anyInStock = product.variants.some((v) => v.inStock);
	const selected = product.variants.find((v) => v.id === variantId) ?? null;
	// Sem escolha ainda, o preço mostrado é o da 1ª opção (a default).
	const shown = selected ?? product.variants[0] ?? null;
	const pricesDiffer =
		new Set(product.variants.map((v) => v.finalAmount)).size > 1;
	const installments = shown
		? installmentLabel(numericToCents(shown.finalAmount))
		: null;

	function handleAdd() {
		if (!selected) {
			setVoltageError(true);
			return;
		}
		add(
			buildCartItem(
				{
					categoryName: product.categoryName,
					categorySlug: product.categorySlug,
					imageUrl: product.images[0] ?? null,
					name: product.name,
					slug: product.slug,
					toolId: product.toolId,
				},
				selected,
				selected.finalAmount
			),
			qty
		);
		onDone();
		openSheet();
	}

	return (
		<div className="grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
			<div className="bg-paper pt-2 md:bg-well md:p-5">
				<PhotoGallery
					name={product.name}
					sizes="(min-width: 768px) 480px, 100vw"
					slots={buildSlots(
						product.images.map((url) => ({ url })),
						null
					)}
					thumbs="below"
				/>
			</div>
			<div className="flex flex-col px-4 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))] md:px-7 md:pt-7 md:pb-6">
				<StockLine inStock={anyInStock} />
				<h2
					className="mt-2.5 pr-0 font-display font-extrabold text-[25px] uppercase leading-[0.98] md:pr-10 md:text-[30px]"
					id={titleId}
				>
					{product.name}
				</h2>
				{product.specs.length > 0 && (
					<p className="mt-2 text-[14px] text-ink-muted tabular-nums">
						{product.specs.join(" · ")}
					</p>
				)}
				{shown && (
					<>
						<p className="mt-3 flex flex-wrap items-baseline gap-x-3 md:mt-[18px]">
							<span className="font-extrabold text-[30px] tabular-nums tracking-[-0.02em] md:text-[34px]">
								{fmtNumericBRL(shown.finalAmount)}
							</span>
							{shown.discountPct > 0 && (
								<span className="text-[15px] text-ink-muted tabular-nums line-through">
									{fmtNumericBRL(shown.baseAmount)}
								</span>
							)}
						</p>
						<p className="mt-2 text-[16px] tabular-nums">
							{installments ? (
								<>
									ou <b className="font-extrabold">{installments}</b> sem juros
									no cartão
								</>
							) : (
								"À vista no Pix, boleto ou cartão"
							)}
						</p>
					</>
				)}

				{anyInStock ? (
					<>
						{product.variants.length > 1 && (
							<VoltagePicker
								error={voltageError}
								onChange={(id) => {
									setVariantId(id);
									setVoltageError(false);
								}}
								options={product.variants.map((v) => ({
									id: v.id,
									inStock: v.inStock,
									priceLabel: pricesDiffer
										? fmtNumericBRL(v.finalAmount)
										: null,
									voltage: v.voltage,
								}))}
								value={variantId}
							/>
						)}
						<div className="mt-3.5 flex gap-2.5">
							<QtyStepper onChange={setQty} value={qty} />
							<button
								className="inline-flex min-h-[52px] flex-1 cursor-pointer items-center justify-center rounded-[3px] bg-emach-red px-4 font-bold text-[15px] text-white hover:bg-emach-red-hover md:text-[16px]"
								onClick={handleAdd}
								type="button"
							>
								Adicionar ao carrinho
							</button>
						</div>
					</>
				) : (
					<p className="mt-3.5 rounded-[5px] border border-line-strong border-dashed px-4 py-3.5 text-[14.5px] text-ink-2">
						Esgotado no momento.
					</p>
				)}

				<p className="mt-auto pt-[18px]">
					<Link
						className="inline-flex min-h-11 items-center gap-1 font-bold text-[15px] text-ink underline underline-offset-[3px]"
						href={`/product/${product.slug}`}
						onClick={onDone}
					>
						Ver página completa do produto
						<ChevronRight aria-hidden="true" className="size-5" />
					</Link>
				</p>
			</div>
		</div>
	);
}
