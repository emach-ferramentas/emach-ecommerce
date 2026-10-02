"use client";

import { Menu, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";

import { AccountMenu } from "@/components/account-menu";
import { CartSheet } from "@/components/cart-sheet";
import { HeaderSearch } from "@/components/header-search";
import { MobileMenu } from "@/components/mobile-menu";
import { useCart, useCartSheet } from "@/lib/cart-context";
import { fmtBRL } from "@/lib/format";
import type { StoreNav } from "@/lib/store-nav";

export function HeaderBar({ nav }: { nav: StoreNav }) {
	const { subtotalCents, totalCount } = useCart();
	const { open: cartOpen, setOpen: setCartOpen } = useCartSheet();
	const [menuOpen, setMenuOpen] = useState(false);
	const [pulse, setPulse] = useState(false);
	const prevCount = useRef(totalCount);

	// A gaveta vive no CartProvider e sobrevive à troca de página. Sem isto, voltar
	// no histórico com ela aberta a reabre na página anterior com o scroll travado.
	// Layout effect para fechar antes do paint da página nova.
	useLayoutEffect(() => () => setCartOpen(false), [setCartOpen]);

	useEffect(() => {
		if (totalCount > prevCount.current) {
			setPulse(true);
			const t = window.setTimeout(() => setPulse(false), 450);
			prevCount.current = totalCount;
			return () => window.clearTimeout(t);
		}
		prevCount.current = totalCount;
		return;
	}, [totalCount]);

	const cartLabel = `Carrinho, ${totalCount} ${totalCount === 1 ? "item" : "itens"}`;

	return (
		<>
			<header className="relative z-30 border-line border-b bg-paper text-ink">
				<div className="shop-wrap grid grid-cols-[auto_1fr_auto] items-center gap-x-1.5 gap-y-1 pt-2 pb-2.5 md:min-h-[84px] md:gap-x-7 md:py-0">
					<div className="flex items-center gap-1.5">
						<button
							aria-controls="mobile-menu"
							aria-expanded={menuOpen}
							aria-haspopup="dialog"
							aria-label="Abrir menu"
							className="-ml-2.5 grid size-11 cursor-pointer place-items-center rounded-[3px] hover:bg-canteiro lg:hidden"
							onClick={() => setMenuOpen(true)}
							type="button"
						>
							<Menu aria-hidden="true" className="size-6" />
						</button>
						<Link
							aria-label="EMACH Ferramentas, página inicial"
							className="inline-flex min-h-11 items-center rounded-[3px] focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
							href="/"
						>
							<Image
								alt=""
								className="h-auto w-[118px] md:w-[158px]"
								height={377}
								priority
								src="/emach-logo-black.svg"
								width={2041}
							/>
						</Link>
					</div>

					<HeaderSearch className="col-span-full row-start-2 md:col-span-1 md:col-start-2 md:row-start-1" />

					<div className="flex items-center gap-1">
						<div className="max-md:hidden">
							<Suspense fallback={null}>
								<AccountMenu />
							</Suspense>
						</div>
						<button
							aria-label={cartLabel}
							className="relative flex min-h-11 cursor-pointer items-center gap-3.5 rounded-[3px] text-left hover:bg-canteiro max-md:size-11 max-md:justify-center md:min-h-[52px] md:px-3"
							onClick={() => setCartOpen(true)}
							type="button"
						>
							<ShoppingCart aria-hidden="true" className="size-6" />
							<span
								aria-hidden="true"
								className={`emach-cart-badge absolute top-0 left-6 grid h-5 min-w-5 place-items-center rounded-[10px] px-1.5 font-extrabold text-[12px] text-white tabular-nums md:top-0.5 md:left-[26px] ${totalCount > 0 ? "bg-emach-red" : "bg-grafite-2"}`}
								data-pulse={pulse ? "true" : undefined}
							>
								{totalCount}
							</span>
							<span className="max-md:hidden">
								<b className="block font-bold text-[14.5px] leading-tight">
									Carrinho
								</b>
								<small className="block whitespace-nowrap text-[12.5px] text-ink-muted tabular-nums leading-tight max-lg:hidden">
									{totalCount > 0 ? fmtBRL(subtotalCents) : "Vazio"}
								</small>
							</span>
						</button>
					</div>
				</div>
			</header>

			{/* Overlays usam hooks de navegação/sessão (usePathname etc.); sob
			    cacheComponents precisam de Suspense para o shell prerenderizar em
			    rotas dinâmicas ([param] sem generateStaticParams). */}
			<Suspense fallback={null}>
				<MobileMenu
					nav={nav}
					onClose={() => setMenuOpen(false)}
					open={menuOpen}
				/>
				<CartSheet onOpenChange={setCartOpen} open={cartOpen} />
			</Suspense>
		</>
	);
}
