"use client";

import { Search, ShoppingBag, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";

import { CartSheet } from "@/components/cart-sheet";
import { HeaderNav } from "@/components/header-nav";
import { SearchOverlay } from "@/components/search-overlay";
import { useCart } from "@/lib/cart-context";

export function SiteHeader() {
	const { totalCount } = useCart();
	const [searchOpen, setSearchOpen] = useState(false);
	const [cartOpen, setCartOpen] = useState(false);
	const [pulse, setPulse] = useState(false);
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

	return (
		<>
			<header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-black px-10">
				<div className="flex items-center gap-8">
					<Link href="/">
						<Image
							alt="EMACH"
							height={16}
							priority
							src="/emach-logo.svg"
							width={87}
						/>
					</Link>
					<Suspense fallback={<nav className="flex items-center gap-[22px]" />}>
						<HeaderNav />
					</Suspense>
				</div>

				<div className="flex items-center gap-[18px] text-white">
					<button
						aria-label="Buscar"
						className="cursor-pointer text-white/80 hover:text-white"
						onClick={() => setSearchOpen(true)}
						type="button"
					>
						<Search className="size-[18px]" />
					</button>
					<Link
						aria-label="Conta"
						className="text-white/80 hover:text-white"
						href="/login"
					>
						<User className="size-[18px]" />
					</Link>
					<button
						aria-label={`Carrinho com ${totalCount} itens`}
						className="relative cursor-pointer text-white/80 hover:text-white"
						onClick={() => setCartOpen(true)}
						type="button"
					>
						<ShoppingBag className="size-[18px]" />
						{totalCount > 0 && (
							<span
								aria-hidden="true"
								className="emach-cart-badge absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-none bg-emach-red px-1 font-bold text-[10px] text-white"
								data-pulse={pulse ? "true" : undefined}
							>
								{totalCount}
							</span>
						)}
					</button>
				</div>
			</header>

			<SearchOverlay onClose={() => setSearchOpen(false)} open={searchOpen} />
			<CartSheet onOpenChange={setCartOpen} open={cartOpen} />
		</>
	);
}
