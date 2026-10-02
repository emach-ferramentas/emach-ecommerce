"use client";

import { PRODUCT_COPY } from "../_lib/product-copy";

interface StickyBuyBarProps {
	inStock: boolean;
	/** Linha de parcelas curta ("12x de R$ 44,68 sem juros" ou "À vista"). */
	installmentsLabel: string;
	onAdd: () => void;
	/** Preço já formatado (ex.: "R$ 1.849,00"). */
	priceLabel: string;
}

/**
 * Barra de compra fixa no rodapé do celular: preço, parcelas e o botão com
 * texto. Dispara o mesmo `onAdd` da caixa de compra (que cobra a voltagem).
 */
export function StickyBuyBar({
	installmentsLabel,
	inStock,
	onAdd,
	priceLabel,
}: StickyBuyBarProps) {
	return (
		<section
			aria-label={PRODUCT_COPY.stickyRegion}
			className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-line border-t bg-paper px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] shadow-bar md:hidden"
		>
			<div className="min-w-0 shrink-0">
				<b className="block font-extrabold text-[19px] tabular-nums leading-tight">
					{priceLabel}
				</b>
				<small className="block whitespace-nowrap text-[12.5px] text-ink-muted tabular-nums">
					{installmentsLabel}
				</small>
			</div>
			{inStock ? (
				<button
					className="inline-flex min-h-[52px] flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-[3px] bg-emach-red px-3 font-bold text-[15px] text-white hover:bg-emach-red-hover"
					onClick={onAdd}
					type="button"
				>
					{PRODUCT_COPY.addToCart}
				</button>
			) : (
				<p className="flex-1 text-right font-bold text-[15px] text-off">
					{PRODUCT_COPY.outOfStock}
				</p>
			)}
		</section>
	);
}
