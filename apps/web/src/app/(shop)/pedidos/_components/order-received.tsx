import { cn } from "@emach/ui/lib/utils";
import { CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

import { PAGE_TITLE_CLASS } from "@/components/page-head";

export function OrderReceived({
	actions,
	children,
	meta,
	title,
}: {
	actions: ReactNode;
	children: ReactNode;
	meta?: ReactNode;
	title: string;
}) {
	return (
		<section className="rounded-[5px] border border-line bg-canteiro px-5 py-7 md:px-8 md:py-9">
			<CircleCheck aria-hidden="true" className="size-9 text-ok" />
			<h1 className={cn(PAGE_TITLE_CLASS, "mt-4")}>{title}</h1>
			{meta ? <div className="mt-3">{meta}</div> : null}
			<p className="mt-4 max-w-[60ch] text-[16px] text-ink-2 leading-relaxed">
				{children}
			</p>
			<div className="mt-6 flex flex-wrap gap-3">{actions}</div>
		</section>
	);
}

export function OrderNumber({ number }: { number: string }) {
	return (
		<p className="text-[15px] text-ink-2">
			Pedido{" "}
			<span className="font-extrabold text-[22px] text-ink tabular-nums">
				{number}
			</span>
		</p>
	);
}
