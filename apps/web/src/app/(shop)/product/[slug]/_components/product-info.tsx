"use client";

import type { ToolDetail } from "@emach/db/queries/tools";
import { HardHat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { QtyStepper } from "@/components/buy/qty-stepper";
import { VoltagePicker } from "@/components/buy/voltage-picker";
import { ProductRating } from "@/components/product-rating";
import { StockLine } from "@/components/stock-line";
import { useCartActions } from "@/lib/cart-context";
import { fmtNumericBRL } from "@/lib/format";
import { installmentLabel, installmentText } from "@/lib/installments";
import {
	buildCartItem,
	type CartItemSource,
	initialVariantId,
	sellableVariants,
	variantPrice,
	voltageLabel,
} from "@/lib/purchase";
import type { ToolService } from "@/lib/services";
import { PRODUCT_COPY } from "../_lib/product-copy";
import { StickyBuyBar } from "./sticky-buy-bar";

interface ProductInfoProps {
	activePromotion: ToolDetail["activePromotion"];
	product: CartItemSource;
	reviewStats: ToolDetail["reviewStats"];
	services: ToolService[];
	specChips: string[];
	stockByVariant: ToolDetail["stockByVariant"];
	tool: ToolDetail["tool"];
	variants: ToolDetail["variants"];
}

const bigButton =
	"inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-[3px] px-[22px] font-bold text-[16px] disabled:cursor-not-allowed disabled:opacity-45";

export function ProductInfo({
	activePromotion,
	product,
	reviewStats,
	services,
	specChips,
	stockByVariant,
	tool,
	variants,
}: ProductInfoProps) {
	// Variante sem preço (rascunho do dashboard) não entra na compra; se nenhuma
	// sobrar, cai no aviso de indisponível abaixo.
	const options = sellableVariants(variants);
	const [variantId, setVariantId] = useState(() => initialVariantId(options));
	const [qty, setQty] = useState(1);
	const [voltageError, setVoltageError] = useState(false);
	const pickerRef = useRef<HTMLDivElement>(null);
	const { add, clear, openSheet } = useCartActions();
	const router = useRouter();
	// A navegação pro checkout é a maior janela morta da página: sem isso o
	// usuário aperta, nada muda, e ele aperta de novo.
	const [isNavigating, startNavigation] = useTransition();

	const selected = options.find((v) => v.id === variantId) ?? null;
	// Sem escolha ainda, o preço mostrado é o da default (1ª da lista).
	const shown = selected ?? options[0];

	if (!shown) {
		return (
			<div className="min-w-0">
				<h1 className="font-display font-extrabold text-[clamp(2rem,1.4rem+1.4vw,2.7rem)] uppercase leading-[0.98]">
					{tool.name}
				</h1>
				<p className="mt-4 text-[15px] text-ink-muted">
					{PRODUCT_COPY.noVariant}
				</p>
			</div>
		);
	}

	const price = variantPrice(shown.priceAmount, activePromotion);
	const anyInStock = options.some((v) => stockByVariant[v.id]);
	const inStockVoltages = options
		.filter((v) => stockByVariant[v.id] && v.voltage)
		.map((v) => voltageLabel(v.voltage).name);
	const pricesDiffer =
		new Set(
			options.map(
				(v) => variantPrice(v.priceAmount, activePromotion).finalAmount
			)
		).size > 1;
	const installments = installmentLabel(price.finalCents);

	/** Variante pronta para o carrinho, ou `null` pedindo a voltagem antes. */
	function requireVariant() {
		if (selected && stockByVariant[selected.id]) {
			return selected;
		}
		setVoltageError(true);
		pickerRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
		pickerRef.current?.querySelector<HTMLInputElement>("input:enabled")?.focus({
			preventScroll: true,
		});
		return null;
	}

	function cartItem(variant: (typeof options)[number]) {
		return buildCartItem(
			product,
			variant,
			variantPrice(variant.priceAmount, activePromotion).finalAmount
		);
	}

	function handleAddToCart() {
		const variant = requireVariant();
		if (!variant) {
			return;
		}
		add(cartItem(variant), qty);
		openSheet();
	}

	function handleBuyNow() {
		const variant = requireVariant();
		if (!variant) {
			return;
		}
		clear();
		add(cartItem(variant), qty);
		startNavigation(() => {
			router.push("/checkout");
		});
	}

	return (
		<div className="min-w-0">
			{services.length > 0 && (
				<div className="mb-3 flex flex-wrap gap-1.5">
					{services.map((service) => (
						<Link
							className="inline-flex min-h-8 items-center gap-1.5 rounded-[3px] bg-grafite px-2.5 font-bold text-[12.5px] text-on-dark uppercase tracking-[0.04em] no-underline [font-stretch:80%] hover:bg-black"
							href={service.href}
							key={service.slug}
						>
							<HardHat aria-hidden="true" className="size-[15px]" />
							{service.name}
						</Link>
					))}
				</div>
			)}

			<h1 className="font-display font-extrabold text-[clamp(2rem,1.4rem+1.4vw,2.7rem)] uppercase leading-[0.98]">
				{tool.name}
			</h1>
			<p className="mt-2.5 text-[13.5px] text-ink-muted [overflow-wrap:anywhere]">
				{tool.manufacturerName &&
					`${PRODUCT_COPY.brand} ${tool.manufacturerName} · `}
				{PRODUCT_COPY.code}{" "}
				<span className="tabular-nums">{selected?.sku ?? shown.sku}</span>
			</p>
			{reviewStats.count > 0 && reviewStats.avg != null && (
				<ProductRating average={reviewStats.avg} className="mt-2.5" />
			)}
			{specChips.length > 0 && (
				<ul className="mt-3.5 flex flex-wrap gap-1.5">
					{specChips.map((chip) => (
						<li
							className="inline-flex min-h-[30px] items-center rounded-[3px] border border-line bg-canteiro px-2.5 font-semibold text-[13.5px] tabular-nums"
							key={chip}
						>
							{chip}
						</li>
					))}
				</ul>
			)}

			<div className="mt-5 border-line border-t pt-5">
				<p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span className="font-extrabold text-[34px] tabular-nums leading-none tracking-[-0.02em] md:text-[40px]">
						{fmtNumericBRL(price.finalAmount)}
					</span>
					{price.hasDiscount && (
						<>
							<span className="text-[16px] text-ink-muted tabular-nums line-through">
								<span className="sr-only">Antes </span>
								{fmtNumericBRL(shown.priceAmount)}
							</span>
							<span className="rounded-[3px] bg-grafite px-2 py-0.5 font-bold text-[13px] text-on-dark">
								−{price.discountPct}%
							</span>
						</>
					)}
				</p>
				<p className="mt-2 text-[16px] tabular-nums">
					{installments ? (
						<>
							{PRODUCT_COPY.installmentsLead}{" "}
							<b className="font-extrabold">{installments}</b>{" "}
							{PRODUCT_COPY.installmentsTail}
						</>
					) : (
						PRODUCT_COPY.cashOnly
					)}
				</p>
				<p className="mt-1 text-[14px] text-ink-muted">
					{PRODUCT_COPY.paymentMethods}
				</p>

				{anyInStock ? (
					<>
						{options.length > 1 && (
							<div ref={pickerRef}>
								<VoltagePicker
									error={voltageError}
									onChange={(id) => {
										setVariantId(id);
										setVoltageError(false);
									}}
									options={options.map((v) => ({
										id: v.id,
										inStock: stockByVariant[v.id] ?? false,
										priceLabel: pricesDiffer
											? fmtNumericBRL(
													variantPrice(v.priceAmount, activePromotion)
														.finalAmount
												)
											: null,
										voltage: v.voltage,
									}))}
									value={variantId}
								/>
							</div>
						)}
						<p className="mt-4 text-[14.5px]">
							<StockLine className="text-[14.5px]" inStock />
							{options.length > 1 && inStockVoltages.length > 0 && (
								<span className="font-bold text-ok">
									{" "}
									em {inStockVoltages.join(" e ")}
								</span>
							)}
						</p>
						<div className="mt-3.5 flex gap-2.5">
							<QtyStepper onChange={setQty} value={qty} />
							<button
								className={`${bigButton} flex-1 bg-emach-red text-white hover:bg-emach-red-hover max-md:px-3 max-md:text-[15px]`}
								onClick={handleAddToCart}
								type="button"
							>
								{PRODUCT_COPY.addToCart}
							</button>
						</div>
						<button
							aria-busy={isNavigating}
							className={`${bigButton} mt-2.5 bg-grafite text-on-dark hover:bg-black`}
							disabled={isNavigating}
							onClick={handleBuyNow}
							type="button"
						>
							{isNavigating
								? PRODUCT_COPY.openingCheckout
								: PRODUCT_COPY.buyNow}
						</button>
					</>
				) : (
					<>
						<p className="mt-4">
							<StockLine className="text-[14.5px]" inStock={false} />
						</p>
						<p className="mt-3.5 rounded-[5px] border border-line-strong border-dashed px-4 py-3.5 text-[14.5px] text-ink-2">
							{PRODUCT_COPY.outOfStock}
						</p>
					</>
				)}
			</div>

			<StickyBuyBar
				inStock={anyInStock}
				installmentsLabel={installmentText(price.finalCents)}
				onAdd={handleAddToCart}
				priceLabel={fmtNumericBRL(price.finalAmount)}
			/>
		</div>
	);
}
