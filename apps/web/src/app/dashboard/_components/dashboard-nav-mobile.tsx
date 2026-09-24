"use client";

import { cn } from "@emach/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { isAccountNavActive } from "./dashboard-sidebar";
import { NAV_ITEMS } from "./nav-items";

export function DashboardNavMobile() {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Navegação da conta"
			className="flex gap-1 overflow-x-auto border-white/10 border-b bg-near-black px-3 md:hidden"
		>
			{NAV_ITEMS.map((item) => {
				if (item.kind === "link") {
					const active = isAccountNavActive(pathname, item.href);
					return (
						<Link
							aria-current={active ? "page" : undefined}
							className={cn(
								"inline-flex min-h-11 items-center whitespace-nowrap border-transparent border-b-[3px] px-3 font-semibold text-[13px] tracking-[0.04em]",
								active
									? "border-b-emach-red text-white"
									: "text-gray-50 hover:text-white"
							)}
							href={item.href}
							key={item.label}
						>
							{item.label}
						</Link>
					);
				}
				return (
					<button
						className="inline-flex min-h-11 items-center whitespace-nowrap border-transparent border-b-[3px] px-3 font-semibold text-[13px] text-gray-50 tracking-[0.04em] hover:text-white"
						key={item.label}
						onClick={() => toast.info(`${item.label}: em breve`)}
						type="button"
					>
						{item.label}
					</button>
				);
			})}
		</nav>
	);
}
