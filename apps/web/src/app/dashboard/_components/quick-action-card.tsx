import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

export function QuickActionCard({
	href,
	Icon,
	title,
	description,
	flag,
}: {
	Icon: LucideIcon;
	description: string;
	flag?: React.ReactNode;
	href: Route;
	title: string;
}) {
	return (
		<Link
			className="flex flex-col gap-2 rounded-[5px] border border-line bg-paper p-5 text-ink no-underline transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
			href={href}
		>
			<Icon aria-hidden="true" className="mb-1 size-6" strokeWidth={1.6} />
			<span className="font-extrabold text-[17px]">{title}</span>
			<span className="text-[14px] text-ink-2">{description}</span>
			{flag ? <span className="mt-1">{flag}</span> : null}
		</Link>
	);
}
