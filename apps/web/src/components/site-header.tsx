"use client";

import { Search, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";

import { AccountMenu } from "@/components/account-menu";
import { CartSheet } from "@/components/cart-sheet";
import { HeaderNav } from "@/components/header-nav";
import { SearchOverlay } from "@/components/search-overlay";
import { useCart } from "@/lib/cart-context";

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const { totalCount } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
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

  const headerClass = overlay
    ? `fixed top-0 right-0 left-0 z-30 flex h-14 items-center justify-between px-10 transition-colors duration-200 ${
        scrolled ? "bg-black" : "bg-transparent"
      }`
    : "sticky top-0 z-30 flex h-14 items-center justify-between bg-black px-10";

  return (
    <>
      <header className={headerClass}>
        <div className="flex items-center gap-8">
          <Link href="/">
            <Image
              alt="EMACH"
              className={
                overlay && !scrolled
                  ? "h-[37px] w-[200px] transition-all duration-300"
                  : "h-[26px] w-[140px] transition-all duration-300"
              }
              height={37}
              priority
              src="/emach-logo.svg"
              width={200}
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
            <Search className="size-6" />
          </button>
          <button
            aria-label={`Carrinho com ${totalCount} itens`}
            className="relative cursor-pointer text-white/80 hover:text-white"
            onClick={() => setCartOpen(true)}
            type="button"
          >
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
          </button>
          <AccountMenu />
        </div>
      </header>

      <SearchOverlay onClose={() => setSearchOpen(false)} open={searchOpen} />
      <CartSheet onOpenChange={setCartOpen} open={cartOpen} />
    </>
  );
}
