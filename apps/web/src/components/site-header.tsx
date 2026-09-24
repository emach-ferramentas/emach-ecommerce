"use client";

import { cn } from "@emach/ui/lib/utils";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";

import { AccountMenu } from "@/components/account-menu";
import { CartSheet } from "@/components/cart-sheet";
import { HeaderNav } from "@/components/header-nav";
import { MobileMenu } from "@/components/mobile-menu";
import { SearchOverlay } from "@/components/search-overlay";
import { useCart } from "@/lib/cart-context";

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
	const { totalCount } = useCart();
	const [searchOpen, setSearchOpen] = useState(false);
	const [cartOpen, setCartOpen] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [pulse, setPulse] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const prevCount = useRef(totalCount);

	useEffect(() => {
		if (totalCount > prevCount.current) {
			setPulse(true);
			const t = window.setTimeout(() => setPulse(false), 450);
			return () => window.clearTimeout(t);
		}
		prevCount.current = totalCount;
		return;
	}, [totalCount]);

	useEffect(() => {
		if (!overlay) {
			return;
		}
		const onScroll = () => {
			setScrolled(window.scrollY > 0);
		};
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [overlay]);

	const solid = scrolled || menuOpen;
	const headerClass = overlay
		? `fixed top-0 right-0 left-0 z-30 flex h-14 items-center justify-between px-5 transition-colors duration-200 sm:px-8 md:px-10 ${
				solid ? "bg-black" : "bg-transparent"
			}`
		: "sticky top-0 z-30 flex h-14 items-center justify-between bg-black px-5 sm:px-8 md:px-10";

	return (
		<>
			<a
				className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-4 focus-visible:z-50 focus-visible:bg-white focus-visible:px-4 focus-visible:py-2 focus-visible:font-semibold focus-visible:text-near-black focus-visible:text-sm focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2"
				href="#main-content"
			>
				Pular para o conteúdo
			</a>
			<header className={headerClass}>
				<div className="flex items-center gap-2 md:gap-8">
					<button
						aria-controls="mobile-menu"
						aria-expanded={menuOpen}
						aria-haspopup="dialog"
						aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
						className="-ml-2 flex size-11 cursor-pointer items-center justify-center text-white md:hidden"
						onClick={() => setMenuOpen((v) => !v)}
						type="button"
					>
						{menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
					</button>
					<Link
						className={cn(
							"focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2",
							menuOpen && "max-md:hidden"
						)}
						href="/"
						onClick={() => setMenuOpen(false)}
					>
						<Image
							alt="EMACH"
							className={cn(
								"transition-all duration-300",
								overlay && !scrolled
									? "h-[26px] w-[140px] md:h-[37px] md:w-[200px]"
									: "h-[26px] w-[140px]"
							)}
							height={37}
							priority
							src="/emach-logo.svg"
							width={200}
						/>
					</Link>
					<div className="hidden md:block">
						<Suspense
							fallback={<nav className="flex items-center gap-[22px]" />}
						>
							<HeaderNav />
						</Suspense>
					</div>
				</div>

				<div className="-mr-2.5 flex items-center gap-0.5 text-white">
					<button
						aria-label="Buscar"
						className="flex cursor-pointer items-center p-2.5 text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
						onClick={() => {
							setMenuOpen(false);
							setSearchOpen(true);
						}}
						type="button"
					>
						<Search className="size-6" />
					</button>
					<button
						aria-label={`Carrinho com ${totalCount} ${totalCount === 1 ? "item" : "itens"}`}
						className="flex cursor-pointer items-center p-2.5 text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
						onClick={() => {
							setMenuOpen(false);
							setCartOpen(true);
						}}
						type="button"
					>
						<span className="relative">
							<ShoppingBag className="size-6" />
							{totalCount > 0 && (
								<span
									aria-hidden="true"
									className="emach-cart-badge absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-none bg-emach-red px-1 font-bold text-[10px] text-white"
									data-pulse={pulse ? "true" : undefined}
								>
									{totalCount}
								</span>
							)}
						</span>
					</button>
					<div className="hidden md:block">
						<Suspense fallback={null}>
							<AccountMenu />
						</Suspense>
					</div>
				</div>
			</header>

			{/* Overlays usam hooks de navegação/sessão (usePathname etc.); sob
			    cacheComponents precisam de Suspense para o shell prerenderizar em
			    rotas dinâmicas ([param] sem generateStaticParams). */}
			<Suspense fallback={null}>
				<MobileMenu onClose={() => setMenuOpen(false)} open={menuOpen} />
				<SearchOverlay onClose={() => setSearchOpen(false)} open={searchOpen} />
				<CartSheet onOpenChange={setCartOpen} open={cartOpen} />
			</Suspense>
		</>
	);
}
