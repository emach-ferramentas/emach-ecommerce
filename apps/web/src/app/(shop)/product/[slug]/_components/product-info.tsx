"use client";

import type { ToolDetail } from "@emach/db/queries/tools";
import { cn } from "@emach/ui/lib/utils";
import {
	Check,
	CheckCircle,
	Share2,
	ShieldCheck,
	ShoppingBag,
	Truck,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmachButton } from "@/components/emach-button";
import { FreightCalculator } from "@/components/freight-calculator";
import { ProductRating } from "@/components/product-rating";
import { QuantityPicker } from "@/components/quantity-picker";
import { SectionLabel } from "@/components/section-label";
import { useCartActions } from "@/lib/cart-context";
import type { CartItemSnapshot } from "@/lib/cart-store";
import { fmtBRL, fmtNumericBRL, numericToCents } from "@/lib/format";
import { effectiveAutoDiscountCents } from "@/lib/promotions";
import { StickyBuyBar } from "./sticky-buy-bar";

interface ProductInfoProps {
	activePromotion: ToolDetail["activePromotion"];
	primaryCategoryName: string | null;
	primaryCategorySlug: string | null;
	primaryImageUrl: string | null;
	reviewStats: ToolDetail["reviewStats"];
	stockByVariant: ToolDetail["stockByVariant"];
	tool: ToolDetail["tool"];
	variants: ToolDetail["variants"];
}

function applyDiscount(
	priceAmount: string,
	promotion: ToolDetail["activePromotion"]
): string | null {
	if (!promotion) {
		return null;
	}
	const baseCents = numericToCents(priceAmount);
	const discountedCents = effectiveAutoDiscountCents(
		baseCents,
		promotion.discountType,
		promotion.discountValue
	);
	if (discountedCents >= baseCents) {
		return null;
	}
	return (discountedCents / 100).toFixed(2);
}

export function ProductInfo({
	tool,
	variants,
	activePromotion,
	stockByVariant,
	reviewStats,
	primaryCategoryName,
	primaryCategorySlug,
	primaryImageUrl,
}: ProductInfoProps) {
	// React Compiler memoiza derivações automaticamente — sem useMemo manual.
	const orderedVariants = [...variants].sort((a, b) => {
		if (a.isDefault !== b.isDefault) {
			return a.isDefault ? -1 : 1;
		}
		return a.sortOrder - b.sortOrder;
	});

	const initialVariant = orderedVariants[0];
	const [selectedVariantId, setSelectedVariantId] = useState<string>(
		initialVariant?.id ?? ""
	);
	const [qty, setQty] = useState(1);
	const [shared, setShared] = useState(false);
	const [showSticky, setShowSticky] = useState(false);
	const buyActionsRef = useRef<HTMLDivElement>(null);
	const { add, clear } = useCartActions();
	const router = useRouter();

	// Mostra a barra sticky só depois que a buy box inline foi rolada pra cima
	// (acima do viewport) — não aparece no load nem enquanto ela está à vista.
	useEffect(() => {
		const el = buyActionsRef.current;
		if (!el) {
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				setShowSticky(
					!entry.isIntersecting && entry.boundingClientRect.top < 0
				);
			},
			{ threshold: 0 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const selected =
		orderedVariants.find((v) => v.id === selectedVariantId) ?? initialVariant;

	if (!selected) {
		return (
			<div className="w-full space-y-6 lg:w-[480px]">
				<h1 className="font-display font-medium text-[36px] leading-[1.1] tracking-[-0.01em]">
					{tool.name}
				</h1>
				<p className="text-[14px] text-gray-60">
					Variante indisponível no momento.
				</p>
			</div>
		);
	}

	const discounted = applyDiscount(selected.priceAmount, activePromotion);
	const finalAmount = discounted ?? selected.priceAmount;
	const inStock = stockByVariant[selected.id] ?? false;
	const installmentCents = Math.round(numericToCents(finalAmount) / 12);
	const baseCents = numericToCents(selected.priceAmount);
	const finalCents = numericToCents(finalAmount);
	const discountPct =
		discounted != null && baseCents > 0
			? Math.round((1 - finalCents / baseCents) * 100)
			: 0;
	const savingsCents = baseCents - finalCents;
	const variantPricesDiffer =
		new Set(
			orderedVariants.map(
				(v) => applyDiscount(v.priceAmount, activePromotion) ?? v.priceAmount
			)
		).size > 1;

	function buildCartItem(): CartItemSnapshot {
		return {
			toolId: tool.id,
			variantId: selected.id,
			slug: tool.slug ?? tool.id,
			name: tool.name,
			sku: selected.sku,
			voltage: selected.voltage,
			priceAmount: finalAmount,
			imageUrl: primaryImageUrl,
			categoryName: primaryCategoryName,
			categorySlug: primaryCategorySlug,
		};
	}

	function handleAddToCart() {
		if (!inStock) {
			toast.error("Variante esgotada");
			return;
		}
		add(buildCartItem(), qty);
		toast.success(`${tool.name} adicionado ao carrinho`);
	}

	function handleBuyNow() {
		if (!inStock) {
			toast.error("Variante esgotada");
			return;
		}
		clear();
		add(buildCartItem(), qty);
		router.push("/checkout");
	}

	async function handleShare() {
		const url =
			typeof window === "undefined"
				? `/product/${tool.slug ?? tool.id}`
				: window.location.href;
		const data = {
			title: `${tool.name} · EMACH`,
			text: tool.description ?? tool.name,
			url,
		};
		try {
			if (navigator.share) {
				await navigator.share(data);
				return;
			}
			await navigator.clipboard.writeText(url);
			setShared(true);
			toast.success("Link copiado");
			window.setTimeout(() => setShared(false), 1600);
		} catch {
			// user cancelled or unsupported — noop
		}
	}

	return (
		<div className="w-full space-y-6 lg:w-[480px]">
			{primaryCategoryName && (
				<SectionLabel tone="accent">{primaryCategoryName}</SectionLabel>
			)}

			<div>
				<h1 className="mt-3 font-display font-medium text-[36px] leading-[1.1] tracking-[-0.01em]">
					{tool.name}
				</h1>
				<div className="mt-2 text-[13px] text-gray-60">SKU {selected.sku}</div>
				{reviewStats.count > 0 && reviewStats.avg != null && (
					<ProductRating average={reviewStats.avg} className="mt-3" />
				)}
			</div>

			<div className="border-border border-y py-5">
				<div className="flex items-center gap-3">
					{discountPct > 0 && (
						<span className="bg-emach-red px-2 py-1 font-bold font-display text-[14px] text-white tracking-[0.04em]">
							−{discountPct}%
						</span>
					)}
					<span className="font-bold font-display text-[40px] tabular-nums">
						{fmtNumericBRL(finalAmount)}
					</span>
					{discounted != null && (
						<span className="text-[16px] text-gray-60 tabular-nums line-through">
							{fmtNumericBRL(selected.priceAmount)}
						</span>
					)}
				</div>
				{savingsCents > 0 && (
					<div className="mt-1.5 font-semibold text-[13px] text-success-text">
						Você economiza {fmtBRL(savingsCents)}
					</div>
				)}
				<div className="mt-1 text-[13px] text-gray-60">
					Em até <strong>12× de {fmtBRL(installmentCents)}</strong> sem juros
				</div>
			</div>

			{orderedVariants.length > 1 && (
				<fieldset className="m-0 min-w-0 border-0 p-0">
					<legend className="mb-2.5 font-semibold text-base">Voltagem</legend>
					<div className="flex flex-wrap gap-2">
						{orderedVariants.map((v) => {
							const variantStock = stockByVariant[v.id] ?? false;
							const isActive = v.id === selectedVariantId;
							const vPrice =
								applyDiscount(v.priceAmount, activePromotion) ?? v.priceAmount;
							return (
								<button
									aria-pressed={isActive}
									className={cn(
										"flex min-w-[120px] flex-col gap-1 border-2 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2",
										!variantStock &&
											"cursor-not-allowed border-gray-20 border-dashed opacity-45",
										variantStock &&
											isActive &&
											"border-emach-red bg-near-black text-white",
										variantStock &&
											!isActive &&
											"border-gray-20 bg-background text-foreground hover:border-foreground"
									)}
									disabled={!variantStock}
									key={v.id}
									onClick={() => variantStock && setSelectedVariantId(v.id)}
									type="button"
								>
									<span className="flex items-center justify-between gap-2">
										<span className="font-display font-semibold text-[12px] uppercase tracking-[0.12em] opacity-75">
											{v.voltage ?? "Padrão"}
										</span>
										{!variantStock && (
											<span className="opacity-100">
												<span className="border border-emach-red/60 px-1.5 font-display text-[9px] text-emach-red-hover uppercase tracking-[0.08em]">
													Esgotado
												</span>
											</span>
										)}
									</span>
									{variantPricesDiffer && (
										<span
											className={cn(
												"font-bold text-[15px] tabular-nums",
												!variantStock && "line-through"
											)}
										>
											{fmtNumericBRL(vPrice)}
										</span>
									)}
								</button>
							);
						})}
					</div>
				</fieldset>
			)}

			<div className="space-y-3" ref={buyActionsRef}>
				<div className="flex items-stretch gap-3">
					<QuantityPicker onChange={setQty} value={qty} />
					<EmachButton
						disabled={!inStock}
						full
						icon={<ShoppingBag size={16} />}
						onClick={handleAddToCart}
						size="md"
						variant="dark"
					>
						{inStock ? "Adicionar ao carrinho" : "Esgotado"}
					</EmachButton>
				</div>
				<EmachButton
					disabled={!inStock}
					full
					icon={<Zap size={16} />}
					onClick={handleBuyNow}
					size="md"
					variant="primary"
				>
					Comprar agora
				</EmachButton>
			</div>

			<button
				aria-label="Compartilhar produto"
				className="emach-ghost-btn inline-flex items-center gap-2 font-semibold text-[13px] text-gray-60"
				onClick={handleShare}
				type="button"
			>
				{shared ? (
					<>
						<Check className="text-success" size={14} />
						Link copiado
					</>
				) : (
					<>
						<Share2 size={14} />
						Compartilhar
					</>
				)}
			</button>

			<FreightCalculator
				quantity={qty}
				subtotal={numericToCents(finalAmount) * qty}
				toolId={tool.id}
			/>

			<div className="flex flex-col border border-border sm:flex-row">
				<div className="flex flex-1 items-center gap-2.5 border-border border-b px-4 py-3 sm:border-r sm:border-b-0">
					<Truck size={16} />
					<div>
						<div className="font-semibold text-[12px]">Frete Brasil</div>
						<div className="text-[10.5px] text-gray-60">pelo seu CEP</div>
					</div>
				</div>
				<div className="flex flex-1 items-center gap-2.5 border-border border-b px-4 py-3 sm:border-r sm:border-b-0">
					<CheckCircle size={16} />
					<div>
						<div className="font-semibold text-[12px]">Garantia 2 anos</div>
						<div className="text-[10.5px] text-gray-60">com a marca</div>
					</div>
				</div>
				<div className="flex flex-1 items-center gap-2.5 px-4 py-3">
					<ShieldCheck size={16} />
					<div>
						<div className="font-semibold text-[12px]">Compra segura</div>
						<div className="text-[10.5px] text-gray-60">nota fiscal</div>
					</div>
				</div>
			</div>

			<StickyBuyBar
				categorySlug={primaryCategorySlug ?? undefined}
				imageUrl={primaryImageUrl}
				inStock={inStock}
				onAdd={handleAddToCart}
				priceLabel={fmtNumericBRL(finalAmount)}
				productName={tool.name}
				variantLabel={selected.voltage ?? "Padrão"}
				visible={showSticky}
			/>
		</div>
	);
}
