"use client";

import { Bell, Eye, ShoppingCart } from "lucide-react";
import Link from "next/link";

import { useQuickView } from "@/components/quick-view";
import type { CardAction } from "@/lib/card-action";
import { useCartActions } from "@/lib/cart-context";
import type { CartItemSnapshot } from "@/lib/cart-store";

export function QuickViewButton({
	name,
	slug,
}: {
	name: string;
	slug: string;
}) {
	const openQuickView = useQuickView();
	return (
		<button
			aria-label={`Ver rápido: ${name}`}
			className="absolute right-1.5 bottom-1.5 z-[2] inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-[3px] border border-line bg-paper px-2.5 font-bold text-[13px] text-ink shadow-[0_4px_10px_-4px_rgba(22,25,29,0.25)] hover:border-ink sm:right-2.5 sm:bottom-2.5 sm:gap-1.5 sm:px-3 sm:text-[14px]"
			onClick={() => openQuickView(slug)}
			type="button"
		>
			<Eye aria-hidden="true" className="size-4 sm:size-5" />
			Ver rápido
		</button>
	);
}

const buttonBase =
	"mt-2.5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[3px] border-[1.5px] px-2 text-center font-bold text-[14px] leading-tight no-underline sm:px-4 sm:text-[15px]";
const darkButton = `${buttonBase} border-transparent bg-grafite text-on-dark hover:bg-black`;
const lineButton = `${buttonBase} border-line-strong bg-paper text-ink hover:border-ink`;

interface CardActionButtonProps {
	action: CardAction;
	item: CartItemSnapshot;
	name: string;
	slug: string;
}

/** Botão do card: adicionar, escolher voltagem (abre o "Ver rápido") ou avisar. */
export function CardActionButton({
	action,
	item,
	name,
	slug,
}: CardActionButtonProps) {
	const { add, openSheet } = useCartActions();
	const openQuickView = useQuickView();

	switch (action) {
		case "add":
			return (
				<button
					className={darkButton}
					onClick={() => {
						add(item, 1);
						openSheet();
					}}
					type="button"
				>
					<ShoppingCart
						aria-hidden="true"
						className="size-[18px] max-sm:hidden"
					/>
					<span className="sm:hidden">Adicionar</span>
					<span className="max-sm:hidden">Adicionar ao carrinho</span>
					<span className="sr-only">: {name}</span>
				</button>
			);
		case "choose-voltage":
			return (
				<button
					className={darkButton}
					onClick={() => openQuickView(slug)}
					type="button"
				>
					Escolher voltagem
					<span className="sr-only">: {name}</span>
				</button>
			);
		case "notify":
			return (
				<Link className={lineButton} href={`/product/${slug}`}>
					<Bell aria-hidden="true" className="size-[18px] max-sm:hidden" />
					<span className="sm:hidden">Avise-me</span>
					<span className="max-sm:hidden">Avise-me quando chegar</span>
					<span className="sr-only">: {name}</span>
				</Link>
			);
		default:
			return (
				<Link className={lineButton} href={`/product/${slug}`}>
					Ver produto
					<span className="sr-only">: {name}</span>
				</Link>
			);
	}
}
