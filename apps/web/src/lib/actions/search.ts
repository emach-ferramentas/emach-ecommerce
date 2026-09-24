"use server";

import { db } from "@emach/db";
import { searchTools, type ToolSearchResult } from "@emach/db/queries/tools";
import { headers } from "next/headers";

import type { ActionResultWith } from "@/lib/actions/types";
import { fetchAutoPromosByToolId } from "@/lib/auto-promo";
import { getClientIp } from "@/lib/client-ip";
import { log } from "@/lib/evlog";
import { numericToCents } from "@/lib/format";
import { effectiveAutoDiscountCents } from "@/lib/promotions";
import { searchLimiter } from "@/lib/rate-limit";

export type SearchResult = ToolSearchResult & {
	/** Preço da default com a melhor auto-promo; null quando nenhuma baixa o preço. */
	discountedCents: number | null;
};

export async function searchToolsAction(
	q: string
): Promise<ActionResultWith<SearchResult[]>> {
	const trimmed = q.trim();
	if (trimmed.length < 2) {
		return { ok: true, data: [] };
	}

	try {
		const ip = getClientIp(await headers());
		if (ip) {
			const { success } = await searchLimiter.limit(`search:${ip}`);
			if (!success) {
				log.warn({ action: "search_rate_limited" });
				return {
					ok: false,
					error: "Muitas buscas seguidas. Aguarde alguns segundos.",
				};
			}
		} else {
			log.warn({ action: "search_rate_limit_skipped_no_ip" });
		}

		const tools = await searchTools(db, trimmed, 8);
		if (tools.length === 0) {
			return { ok: true, data: [] };
		}
		const promos = await fetchAutoPromosByToolId(
			db,
			tools.map((t) => t.id),
			new Date()
		);
		const data = tools.map((tool) => {
			const base = numericToCents(tool.defaultVariant.priceAmount);
			let best = base;
			for (const promo of promos.get(tool.id) ?? []) {
				best = Math.min(
					best,
					effectiveAutoDiscountCents(
						base,
						promo.discountType,
						promo.discountValue
					)
				);
			}
			return { ...tool, discountedCents: best < base ? best : null };
		});
		return { ok: true, data };
	} catch (err) {
		log.error({
			action: "search_tools",
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return { ok: false, error: "Não foi possível buscar agora." };
	}
}
