"use client";

import { Button } from "@emach/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@emach/ui/components/sheet";
import { CircleCheckBig, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmachButton } from "@/components/emach-button";
import { ProductImage } from "@/components/product-image";
import { SectionLabel } from "@/components/section-label";
import { useCart } from "@/lib/cart-context";
import { fmtBRL } from "@/lib/format";

const FREE_SHIPPING_THRESHOLD = 29_900;

interface CartSheetProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
	const { items, setQty, remove } = useCart();
	const [removing, setRemoving] = useState<string | null>(null);

	function handleRemove(id: string) {
		setRemoving(id);
		window.setTimeout(() => {
			remove(id);
			setRemoving(null);
		}, 220);
	}

	const totalItems = items.reduce((s, i) => s + i.quantity, 0);
	const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
	const freeShippingProgress = Math.min(
		100,
		(subtotal / FREE_SHIPPING_THRESHOLD) * 100
	);
	const earnedFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="flex w-full flex-col p-0 sm:max-w-md"
				side="right"
			>
				<SheetHeader className="gap-0 border-b px-5 py-4">
					<SheetTitle className="flex items-center gap-2 font-bold font-display text-[15px] uppercase tracking-[0.14em]">
						Carrinho
						{totalItems > 0 && (
							<span
								className="font-medium text-[13px] tracking-[0.08em]"
								style={{ color: "var(--gray-60)" }}
							>
								· {totalItems} {totalItems === 1 ? "item" : "itens"}
							</span>
						)}
					</SheetTitle>
				</SheetHeader>

				{items.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
						<div
							className="mb-4 flex items-center justify-center rounded-full"
							style={{
								background: "var(--gray-10)",
								height: 64,
								width: 64,
							}}
						>
							<ShoppingBag size={28} style={{ color: "var(--gray-50)" }} />
						</div>
						<h2
							className="m-0 font-semibold"
							style={{ fontFamily: "var(--font-display)", fontSize: 24 }}
						>
							Carrinho vazio
						</h2>
						<p
							className="mt-2 max-w-[260px] text-[13px]"
							style={{ color: "var(--gray-60)" }}
						>
							Explore nosso catálogo e encontre as ferramentas certas para o seu
							trabalho.
						</p>
						<Link
							className="mt-6 w-full max-w-[220px]"
							href="/catalog"
							onClick={() => onOpenChange(false)}
						>
							<EmachButton full size="md" variant="primary">
								Ver catálogo
							</EmachButton>
						</Link>
					</div>
				) : (
					<>
						<div
							className="px-5 py-3.5"
							style={{ background: "var(--gray-10)" }}
						>
							{earnedFreeShipping ? (
								<div className="flex min-h-9 items-center gap-2.5 font-semibold text-[13px]">
									<CircleCheckBig
										size={18}
										style={{ color: "var(--success)" }}
									/>
									Você ganhou frete grátis!
								</div>
							) : (
								<>
									<div className="mb-2 min-h-5 text-[13px]">
										Faltam{" "}
										<strong>
											{fmtBRL(FREE_SHIPPING_THRESHOLD - subtotal)}
										</strong>{" "}
										para frete grátis.
									</div>
									<div className="h-1.5 overflow-hidden bg-white">
										<div
											style={{
												background: "var(--emach-red)",
												height: "100%",
												transition: "width 300ms ease",
												width: `${freeShippingProgress}%`,
											}}
										/>
									</div>
								</>
							)}
						</div>

						<div className="flex-1 overflow-y-auto px-5">
							{items.map(({ product, quantity }) => (
								<div
									className="emach-cart-item grid grid-cols-[80px_1fr_auto] items-start gap-3.5 py-4"
									data-leaving={removing === product.id ? "true" : undefined}
									key={product.id}
									style={{ borderBottom: "1px solid var(--gray-10)" }}
								>
									<div
										className="relative overflow-hidden"
										style={{
											background: "#ECECEC",
											height: 80,
											width: 80,
										}}
									>
										<ProductImage
											alt={product.name}
											categorySlug={product.categorySlug}
											sizes="80px"
											src={product.images[0]}
										/>
									</div>

									<div className="min-w-0">
										<SectionLabel>{product.category}</SectionLabel>
										<Link
											className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap font-medium text-[14px] hover:underline"
											href={`/product/${product.slug}`}
											onClick={() => onOpenChange(false)}
											title={product.name}
										>
											{product.name}
										</Link>
										<div
											className="mt-0.5 text-[11px]"
											style={{ color: "var(--gray-60)" }}
										>
											SKU {product.sku}
										</div>
										<div className="mt-2 flex flex-col items-start gap-1">
											<div
												className="emach-qty"
												style={{
													transform: "scale(0.85)",
													transformOrigin: "left",
												}}
											>
												<button
													aria-label="Diminuir"
													className="emach-qty__btn"
													onClick={() => setQty(product.id, quantity - 1)}
													type="button"
												>
													−
												</button>
												<div className="emach-qty__val">{quantity}</div>
												<button
													aria-label="Aumentar"
													className="emach-qty__btn emach-qty__btn--plus"
													onClick={() => setQty(product.id, quantity + 1)}
													type="button"
												>
													+
												</button>
											</div>
											<Button
												className="cursor-pointer text-gray-500 text-xs underline hover:bg-white"
												onClick={() => handleRemove(product.id)}
												size="sm"
												type="button"
												variant="ghost"
											>
												Remover
											</Button>
										</div>
									</div>

									<div
										className="pt-0.5 font-bold text-[14px]"
										style={{ fontVariantNumeric: "tabular-nums" }}
									>
										{fmtBRL(product.price * quantity)}
									</div>
								</div>
							))}
						</div>

						<div
							className="px-5 pt-4 pb-5"
							style={{ borderTop: "1px solid var(--gray-10)" }}
						>
							<div className="flex items-baseline justify-between">
								<span className="font-bold font-display text-[13px] uppercase tracking-[0.12em]">
									Subtotal
								</span>
								<span
									className="font-bold"
									style={{
										fontFamily: "var(--font-display)",
										fontSize: 24,
										fontVariantNumeric: "tabular-nums",
									}}
								>
									{fmtBRL(subtotal)}
								</span>
							</div>
							<div
								className="mb-3.5 text-right text-[11px]"
								style={{ color: "var(--gray-60)" }}
							>
								ou 12× de {fmtBRL(subtotal / 12)} sem juros
							</div>

							<Link
								className="mb-2 block"
								href="/checkout"
								onClick={() => onOpenChange(false)}
							>
								<EmachButton full size="lg" variant="primary">
									Finalizar compra
								</EmachButton>
							</Link>
							<Link
								className="block"
								href="/cart"
								onClick={() => onOpenChange(false)}
							>
								<EmachButton full size="md" variant="ghost">
									Ver carrinho
								</EmachButton>
							</Link>
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}
