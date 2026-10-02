"use client";

import { cn } from "@emach/ui/lib/utils";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSignOut } from "@/lib/use-sign-out";
import { isAccountNavActive, NAV_ITEMS } from "./nav-items";

const FOCUS_RING =
	"focus-visible:outline-2 focus-visible:outline-ink focus-visible:-outline-offset-2";

export function AccountNav({
	userEmail,
	userName,
}: {
	userEmail: string;
	userName: string;
}) {
	const pathname = usePathname();
	const handleSignOut = useSignOut();

	return (
		<>
			<nav
				aria-label="Navegação da conta"
				className="-mx-4 flex overflow-x-auto border-line border-b px-4 md:hidden"
			>
				{NAV_ITEMS.map((item) => {
					const active = isAccountNavActive(pathname, item);
					return (
						<Link
							aria-current={active ? "page" : undefined}
							className={cn(
								"-mb-px inline-flex min-h-12 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-[15px]",
								FOCUS_RING,
								active
									? "border-ink font-bold text-ink"
									: "border-transparent text-ink-2 hover:text-ink"
							)}
							href={item.href}
							key={item.href}
						>
							{item.label}
						</Link>
					);
				})}
			</nav>

			<aside className="hidden md:sticky md:top-4 md:block md:self-start md:pt-[18px]">
				<div className="border-line border-b pb-4">
					<div className="truncate font-bold text-[15px] text-ink">
						{userName}
					</div>
					<div className="mt-0.5 truncate text-[13.5px] text-ink-muted">
						{userEmail}
					</div>
				</div>
				<nav aria-label="Navegação da conta">
					{NAV_ITEMS.map((item) => {
						const active = isAccountNavActive(pathname, item);
						return (
							<Link
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex min-h-12 items-center border-line border-b px-3 text-[15px]",
									FOCUS_RING,
									active
										? "bg-canteiro font-bold text-ink"
										: "text-ink-2 hover:bg-canteiro hover:text-ink"
								)}
								href={item.href}
								key={item.href}
							>
								{item.label}
							</Link>
						);
					})}
					<button
						className={cn(
							"flex min-h-12 w-full cursor-pointer items-center gap-2 px-3 text-left text-[15px] text-ink-2 hover:bg-canteiro hover:text-ink",
							FOCUS_RING
						)}
						onClick={handleSignOut}
						type="button"
					>
						<LogOut aria-hidden="true" className="size-4" strokeWidth={1.8} />
						Sair
					</button>
				</nav>
			</aside>
		</>
	);
}
