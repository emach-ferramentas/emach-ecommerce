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

function labelFor(value: string | null): string | undefined {
	return value === "newest" || value === "rating-desc"
		? SORT_LABELS[value]
		: undefined;
}

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
		// SAFETY: pathname vem de usePathname(), que devolve a rota atual sem query
		// (doc do Next, lida em next/dist/client/components/navigation.d.ts); qs é só
		// o URLSearchParams serializado, então o caminho continua sendo o da página.
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
			<span className="font-semibold text-[13px] text-ink-2">Ordenar</span>
			<Select onValueChange={handleChange} value={current}>
				<SelectTrigger
					aria-busy={isPending}
					className="h-11 min-w-[160px] transition-opacity aria-busy:pointer-events-none aria-busy:opacity-60 sm:h-8"
				>
					<SelectValue>{(value) => labelFor(value)}</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="newest">Mais recentes</SelectItem>
					<SelectItem value="rating-desc">Melhor avaliadas</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
