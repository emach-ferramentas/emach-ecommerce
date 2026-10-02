"use server";

import type { Voltage } from "@emach/db/schema/tools";
import { headers } from "next/headers";
import { z } from "zod";

import type { ActionResultWith } from "@/lib/actions/types";
import { specChips } from "@/lib/attribute-format";
import { getClientIp } from "@/lib/client-ip";
import { log } from "@/lib/evlog";
import { getProductShell } from "@/lib/product-detail";
import { sellableVariants, variantPrice } from "@/lib/purchase";
import { quickViewLimiter } from "@/lib/rate-limit";

const inputSchema = z.object({
	slug: z
		.string()
		.trim()
		.min(1)
		.max(200)
		.regex(/^[\w-]+$/),
});

const QUICK_VIEW_IMAGES = 6;
const QUICK_VIEW_SPECS = 4;

export interface QuickViewVariant {
	baseAmount: string;
	discountPct: number;
	finalAmount: string;
	id: string;
	inStock: boolean;
	sku: string;
	voltage: Voltage | null;
}

export interface QuickViewProduct {
	categoryName: string | null;
	categorySlug: string | null;
	images: string[];
	name: string;
	slug: string;
	specs: string[];
	toolId: string;
	variants: QuickViewVariant[];
}

/** Dados do "Ver rápido": fotos, variantes vendáveis, preço com promoção e estoque. */
export async function quickViewAction(
	raw: unknown
): Promise<ActionResultWith<QuickViewProduct>> {
	const parsed = inputSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Produto inválido." };
	}
	const { slug } = parsed.data;

	try {
		const ip = getClientIp(await headers());
		if (ip) {
			const { success } = await quickViewLimiter.limit(`quick-view:${ip}`);
			if (!success) {
				log.warn({ action: "quick_view_rate_limited" });
				return {
					ok: false,
					error: "Muitas consultas seguidas. Aguarde alguns segundos.",
				};
			}
		} else {
			log.warn({ action: "quick_view_rate_limit_skipped_no_ip" });
		}

		const detail = await getProductShell(slug);
		if (!detail) {
			return { ok: false, error: "Produto não encontrado." };
		}

		const attributes = [...detail.attributes].sort(
			(a, b) => a.sortOrder - b.sortOrder
		);
		return {
			ok: true,
			data: {
				categoryName: detail.primaryCategory?.name ?? null,
				categorySlug: detail.primaryCategory?.slug ?? null,
				images: detail.images.slice(0, QUICK_VIEW_IMAGES).map((i) => i.url),
				name: detail.tool.name,
				slug,
				specs: specChips(attributes, QUICK_VIEW_SPECS),
				toolId: detail.tool.id,
				variants: sellableVariants(detail.variants).map((v) => {
					const price = variantPrice(v.priceAmount, detail.activePromotion);
					return {
						baseAmount: v.priceAmount,
						discountPct: price.discountPct,
						finalAmount: price.finalAmount,
						id: v.id,
						inStock: detail.stockByVariant[v.id] ?? false,
						sku: v.sku,
						voltage: v.voltage,
					};
				}),
			},
		};
	} catch (err) {
		log.error({
			action: "quick_view",
			error: err instanceof Error ? err.message : "erro inesperado",
			slug,
		});
		return { ok: false, error: "Não foi possível abrir o produto agora." };
	}
}
