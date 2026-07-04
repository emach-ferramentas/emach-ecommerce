"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@emach/ui/components/select";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type ReviewSortKey = "newest" | "rating-desc";

const SORT_LABELS: Record<ReviewSortKey, string> = {
	newest: "Mais recentes",
	"rating-desc": "Melhor avaliadas",
};

interface ReviewSortProps {
	current: ReviewSortKey;
}

export function ReviewSort({ current }: ReviewSortProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();

	function handleChange(value: string | null) {
		const params = new URLSearchParams(searchParams);
		if (value == null || value === "newest") {
			params.delete("reviewSort");
		} else {
			params.set("reviewSort", value);
		}
		params.delete("reviewPage");
		const qs = params.toString();
		const href = (qs ? `${pathname}?${qs}` : pathname) as Route;
		startTransition(() => {
			router.replace(href, { scroll: false });
		});
	}

	return (
		<div
			aria-busy={isPending}
			className="flex items-center gap-2"
			role="status"
		>
			<span className="font-display text-[10px] text-gray-60 uppercase tracking-[0.14em]">
				Ordenar
			</span>
			<Select onValueChange={handleChange} value={current}>
				<SelectTrigger className="h-8 min-w-[160px]">
					<SelectValue>
						{(value) => SORT_LABELS[value as ReviewSortKey]}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="newest">Mais recentes</SelectItem>
					<SelectItem value="rating-desc">Melhor avaliadas</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
