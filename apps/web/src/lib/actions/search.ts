"use server";

import { db } from "@emach/db";
import { searchTools, type ToolSearchResult } from "@emach/db/queries/tools";
import { headers } from "next/headers";

import { getClientIp } from "@/lib/client-ip";
import { log } from "@/lib/evlog";
import { searchLimiter } from "@/lib/rate-limit";

export async function searchToolsAction(
	q: string
): Promise<ToolSearchResult[]> {
	const trimmed = q.trim();
	if (trimmed.length < 2) {
		return [];
	}

	const ip = getClientIp(await headers());
	if (ip) {
		const { success } = await searchLimiter.limit(`search:${ip}`);
		if (!success) {
			log.warn({ action: "search_rate_limited" });
			return [];
		}
	} else {
		log.warn({ action: "search_rate_limit_skipped_no_ip" });
	}

	return await searchTools(db, trimmed, 8);
}
