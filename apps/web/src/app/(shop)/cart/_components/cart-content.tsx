"use client";

import { HOME_CRUMB } from "@/components/breadcrumb";
import { CartEmpty } from "@/components/cart-empty";
import { CartItemRow } from "@/components/cart-item-row";
import { CartTotals } from "@/components/cart-totals";
import { PageHead } from "@/components/page-head";
import { Panel } from "@/components/panel";
import { useCart } from "@/lib/cart-context";
import { useRemoveWithUndo } from "@/lib/use-remove-with-undo";

export function CartContent() {
	const { items, setQty } = useCart();
	const { removing, handleRemove } = useRemoveWithUndo();

	return (
		<div className="pb-16">
			<div className="shop-wrap">
				<PageHead
					current="Carrinho"
					title="Seu carrinho"
					trail={[HOME_CRUMB]}
				/>

				{items.length === 0 ? (
					<CartEmpty centered />
				) : (
					<div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
						<div className="border-ink border-t-2">
							{items.map((item) => (
								<CartItemRow
									item={item}
									key={item.variantId}
									leaving={removing === item.variantId}
									onQuantityChange={(next) => setQty(item.variantId, next)}
									onRemove={() => handleRemove(item.variantId)}
								/>
							))}
						</div>

						<Panel
							as="aside"
							className="lg:sticky lg:top-24"
							title="Resumo"
							tone="canteiro"
						>
							<CartTotals context="page" />
						</Panel>
					</div>
				)}
			</div>
		</div>
	);
}
