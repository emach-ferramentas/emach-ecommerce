"use client";

import { cn } from "@emach/ui/lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const navLinks: {
  href: "/" | "/catalog" | "/sobre" | "/sobre#filiais";
  label: string;
}[] = [
  { href: "/catalog", label: "Catálogo" },
  { href: "/sobre", label: "Sobre" },
  { href: "/sobre#filiais", label: "Filiais" },
];

export function HeaderNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCat = searchParams.get("cat");
  const [urlHash, setUrlHash] = useState("");

  useEffect(() => {
    const readHash = () => setUrlHash(window.location.hash);

    readHash();
    window.addEventListener("hashchange", readHash);

    const orig = history.pushState.bind(history);
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      orig(...args);
      setTimeout(readHash, 0);
    };

    return () => {
      window.removeEventListener("hashchange", readHash);
      history.pushState = orig;
    };
  }, []);

  return (
    <nav className="flex items-center gap-[22px]">
      {navLinks.map((link) => {
        const [linkPath, linkHash] = link.href.split("#");
        const linkHashFull = linkHash ? `#${linkHash}` : "";
        const [, linkQuery] = link.href.split("?");
        const linkCat = linkQuery
          ? new URLSearchParams(linkQuery).get("cat")
          : null;
        const active =
          pathname === linkPath &&
          urlHash === linkHashFull &&
          (linkCat ? currentCat === linkCat : !currentCat);
        return (
          <Link
            className={cn(
              "relative inline-block pb-1 font-display font-semibold text-ms uppercase tracking-[0.04em] transition-colors",
              "after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-emach-red after:transition-transform after:duration-300 after:ease-out after:content-['']",
              "hover:after:scale-x-100",
              active
                ? "text-white after:scale-x-100"
                : "text-white/75 hover:text-white",
            )}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
