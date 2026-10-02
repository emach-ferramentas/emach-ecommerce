import { ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

export interface Crumb {
	href: Route;
	label: string;
}

export const HOME_CRUMB: Crumb = { href: "/", label: "Início" };
export const CATALOG_CRUMB: Crumb = { href: "/catalog", label: "Catálogo" };

const linkClass =
	"inline-flex min-h-8 items-center text-ink-2 underline underline-offset-[3px]";

export function Breadcrumb({
	current,
	trail,
}: {
	current: string;
	trail: readonly Crumb[];
}) {
	return (
		<nav
			aria-label="Você está em"
			className="pt-2.5 pb-1.5 text-[13.5px] text-ink-muted md:pt-[18px] md:text-[14px]"
		>
			<ol className="flex flex-wrap items-center gap-1.5">
				{trail.map((item) => (
					<li className="inline-flex items-center gap-1.5" key={item.href}>
						<Link className={linkClass} href={item.href}>
							{item.label}
						</Link>
						<ChevronRight aria-hidden="true" className="size-3.5" />
					</li>
				))}
				<li className="min-w-0">
					<span aria-current="page" className="line-clamp-1">
						{current}
					</span>
				</li>
			</ol>
		</nav>
	);
}
