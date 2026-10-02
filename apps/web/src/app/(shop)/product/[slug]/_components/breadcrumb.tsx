import { ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

interface BreadcrumbProps {
	category: { slug: string; name: string } | null;
	productName: string;
}

const linkClass =
	"inline-flex min-h-8 items-center text-ink-2 underline underline-offset-[3px]";

/** Trilha estrutural da página de produto. */
export function Breadcrumb({ category, productName }: BreadcrumbProps) {
	const trail: { href: Route; label: string }[] = [
		{ href: "/", label: "Início" },
		{ href: "/catalog", label: "Catálogo" },
		...(category
			? [{ href: `/catalog/${category.slug}` as Route, label: category.name }]
			: []),
	];
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
						{productName}
					</span>
				</li>
			</ol>
		</nav>
	);
}
