"use server";

import { db } from "@emach/db";
import { searchTools, type ToolSearchResult } from "@emach/db/queries/catalog";

export async function searchToolsAction(
	q: string
): Promise<ToolSearchResult[]> {
	const trimmed = q.trim();
	if (trimmed.length < 2) {
		return [];
	}
	return await searchTools(db, trimmed, 8);
}
