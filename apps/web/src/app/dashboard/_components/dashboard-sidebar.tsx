"use client";

import { cn } from "@emach/ui/lib/utils";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useSignOut } from "@/lib/use-sign-out";
import { AccountAvatar } from "./account-avatar";
import { NAV_ITEMS } from "./nav-items";

// "/dashboard" é prefixo de todas as outras rotas da conta, então só casa exato.
export function isAccountNavActive(pathname: string, href: string): boolean {
	if (pathname === href) {
		return true;
	}
	return href !== "/dashboard" && pathname.startsWith(`${href}/`);
}

interface DashboardSidebarProps {
	userEmail: string;
	userImage?: string | null;
	userName: string;
}

export function DashboardSidebar({
	userEmail,
	userImage,
	userName,
}: DashboardSidebarProps) {
	const pathname = usePathname();
	const handleSignOut = useSignOut();

	return (
		<aside className="hidden h-full flex-col border-black border-r-2 bg-near-black pt-8 text-white md:flex">
			<div className="flex items-center gap-3 border-white/10 border-b px-[22px] pb-[22px]">
				<AccountAvatar
					className="size-[42px]"
					fallbackClassName="text-[16px]"
					image={userImage}
					name={userName}
				/>
				<div className="min-w-0">
					<div className="truncate font-semibold text-[15px] leading-tight">
						{userName}
					</div>
					<div className="mt-0.5 truncate text-[11.5px] text-gray-50">
						{userEmail}
					</div>
				</div>
			</div>

			<nav aria-label="Navegação da conta" className="flex flex-1 flex-col">
				{NAV_ITEMS.map((item) => {
					if (item.kind === "link") {
						const active = isAccountNavActive(pathname, item.href);
						return (
							<Link
								aria-current={active ? "page" : undefined}
								className={cn(
									"block border-transparent border-l-[3px] px-[22px] py-3 font-semibold text-[13px] tracking-[0.04em]",
									active
										? "border-l-emach-red bg-white/5 text-white"
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
							className="block w-full border-transparent border-l-[3px] px-[22px] py-3 text-left font-semibold text-[13px] text-gray-50 tracking-[0.04em] hover:text-white"
							key={item.label}
							onClick={() => toast.info(`${item.label}: em breve`)}
							type="button"
						>
							{item.label}
						</button>
					);
				})}

				<div className="mt-auto py-2">
					<div className="mb-2 h-px bg-white/8" />
					<button
						className="flex w-full items-center gap-2 border-transparent border-l-[3px] px-[22px] py-3 text-left font-semibold text-[13px] text-gray-50 tracking-[0.04em] hover:text-white"
						onClick={handleSignOut}
						type="button"
					>
						<LogOut className="h-4 w-4" strokeWidth={1.6} />
						Sair
					</button>
				</div>
			</nav>
		</aside>
	);
}
