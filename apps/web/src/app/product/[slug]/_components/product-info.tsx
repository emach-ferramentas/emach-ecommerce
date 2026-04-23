"use client";

import {
	Check,
	CheckCircle,
	Share2,
	ShoppingBag,
	Truck,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmachBadge } from "@/components/emach-badge";
import { EmachButton } from "@/components/emach-button";
import { FreightCalculator } from "@/components/freight-calculator";
import { ProductRating } from "@/components/product-rating";
import { QuantityPicker } from "@/components/quantity-picker";
import { SectionLabel } from "@/components/section-label";
import { useCart } from "@/lib/cart-context";
import { fmtBRL } from "@/lib/format";
import type { Product } from "@/lib/mock-data";

interface ProductInfoProps {
	product: Product;
}

function getBadgeVariant(badge: string) {
	if (badge === "Promoção") {
		return "promo" as const;
	}
	return "dark" as const;
}

export function ProductInfo({ product }: ProductInfoProps) {
	const [selectedVoltage, setSelectedVoltage] = useState<string | null>(
		product.voltage?.[0] ?? null
	);
	const [qty, setQty] = useState(1);
	const [shared, setShared] = useState(false);
	const { add, clear } = useCart();
	const router = useRouter();

	function handleAddToCart() {
		add(product, qty);
		toast.success(`${product.name} adicionado ao carrinho`);
	}

	function handleBuyNow() {
		clear();
		add(product, qty);
		router.push("/checkout");
	}

	async function handleShare() {
		const url =
			typeof window === "undefined"
				? `/product/${product.slug}`
				: window.location.href;
		const data = {
			title: `${product.name} — EMACH`,
			text: product.shortDescription.join(" · "),
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
		<div className="w-[480px] space-y-6">
			<SectionLabel tone="accent">{product.category}</SectionLabel>

			<div>
				<h1 className="mt-3 font-display font-medium text-[36px] leading-[1.1] tracking-[-0.01em]">
					{product.name}
				</h1>
				{product.badge && (
					<EmachBadge className="mt-2" variant={getBadgeVariant(product.badge)}>
						{product.badge}
					</EmachBadge>
				)}
				<div className="mt-2 text-[13px] text-gray-60">SKU {product.sku}</div>
				{product.rating && (
					<ProductRating average={product.rating.average} className="mt-3" />
				)}
			</div>

			<div className="border-border border-y py-5">
				<div className="flex items-baseline gap-3">
					<span className="font-bold font-display text-[40px] tabular-nums">
						{fmtBRL(product.price)}
					</span>
					{product.originalPrice && (
						<span className="text-[16px] text-gray-50 tabular-nums line-through">
							{fmtBRL(product.originalPrice)}
						</span>
					)}
				</div>
				<div className="mt-1.5 text-[13px] text-gray-60">
					Em até{" "}
					<strong>12× de {fmtBRL(Math.round(product.price / 12))}</strong> sem
					juros
				</div>
			</div>

			<ul className="space-y-1.5 text-[15px] text-gray-60 leading-relaxed">
				{product.shortDescription.map((item) => (
					<li className="flex gap-2" key={item}>
						<span aria-hidden className="text-foreground">
							•
						</span>
						<span>{item}</span>
					</li>
				))}
			</ul>

			{product.voltage && product.voltage.length > 1 && (
				<div>
					<div className="mb-2.5 font-semibold text-md">Voltagem</div>
					<div className="flex gap-2">
						{product.voltage.map((v) => (
							<button
								className={`emach-chip min-w-16 ${selectedVoltage === v ? "emach-chip--active" : ""}`}
								key={v}
								onClick={() => setSelectedVoltage(v)}
								type="button"
							>
								{v}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="space-y-3">
				<div className="flex items-stretch gap-3">
					<QuantityPicker onChange={setQty} value={qty} />
					<EmachButton
						full
						icon={<ShoppingBag size={16} />}
						onClick={handleAddToCart}
						size="md"
						variant="dark"
					>
						Adicionar ao carrinho
					</EmachButton>
				</div>
				<EmachButton
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

			<FreightCalculator subtotal={product.price * qty} />

			<div className="flex h-16 justify-between rounded-sm bg-gray-10 px-5">
				<div className="flex items-center gap-2">
					<Truck size={16} />
					<div>
						<div className="font-semibold text-sm">Frete grátis</div>
						<div className="text-gray-60 text-xs">acima de R$ 299</div>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<CheckCircle size={16} />
					<div>
						<div className="font-semibold text-sm">Garantia 2 anos</div>
						<div className="text-gray-60 text-xs">direto com a marca</div>
					</div>
				</div>
			</div>
		</div>
	);
}
