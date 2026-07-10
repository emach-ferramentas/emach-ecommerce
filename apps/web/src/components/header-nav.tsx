"use client";

import { cn } from "@emach/ui/lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSectionInView } from "@/lib/use-section-in-view";

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
	// Scroll-spy: em /sobre, "Filiais" marca enquanto a seção #filiais está na tela.
	const filiaisInView = useSectionInView("filiais", pathname === "/sobre");
	const activeHref =
		pathname === "/sobre" && filiaisInView ? "/sobre#filiais" : pathname;

	return (
		<nav
			aria-label="Navegação principal"
			className="flex items-center gap-[22px]"
		>
			{navLinks.map((link) => {
				const active = link.href === activeHref && !currentCat;
				return (
					<Link
						aria-current={active ? "page" : undefined}
						className={cn(
							"relative inline-block pb-1 font-display font-semibold text-ms uppercase tracking-[0.04em] transition-colors",
							"after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-emach-red after:transition-transform after:duration-300 after:ease-out after:content-['']",
							"hover:after:scale-x-100",
							"focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2",
							active
								? "text-white after:scale-x-100"
								: "text-white/75 hover:text-white"
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
