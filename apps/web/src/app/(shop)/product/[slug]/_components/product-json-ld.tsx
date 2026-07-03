import type { ToolDetail } from "@emach/db/queries/tools";
import { env } from "@emach/env/web";
import { numericToCents } from "@/lib/format";
import { effectiveAutoDiscountCents } from "@/lib/promotions";

const BASE_URL = env.NEXT_PUBLIC_SITE_URL;

function finalPriceAmount(
	priceAmount: string,
	promotion: ToolDetail["activePromotion"]
): string {
	if (!promotion) {
		return priceAmount;
	}
	const baseCents = numericToCents(priceAmount);
	const discountedCents = effectiveAutoDiscountCents(
		baseCents,
		promotion.discountType,
		promotion.discountValue
	);
	if (discountedCents >= baseCents) {
		return priceAmount;
	}
	return (discountedCents / 100).toFixed(2);
}

export function ProductJsonLd({ detail }: { detail: ToolDetail }) {
	const { tool, variants, images, stockByVariant, reviewStats } = detail;
	const url = `${BASE_URL}/product/${tool.slug ?? tool.id}`;

	const offers = variants.map((v) => ({
		"@type": "Offer",
		availability: stockByVariant[v.id]
			? "https://schema.org/InStock"
			: "https://schema.org/OutOfStock",
		price: finalPriceAmount(v.priceAmount, detail.activePromotion),
		priceCurrency: "BRL",
		sku: v.sku,
		url,
	}));

	const data = {
		"@context": "https://schema.org",
		"@type": "Product",
		name: tool.name,
		...(tool.description ? { description: tool.description } : {}),
		...(images.length > 0 ? { image: images.map((i) => i.url) } : {}),
		...(variants[0] ? { sku: variants[0].sku } : {}),
		...(tool.manufacturerName
			? { brand: { "@type": "Brand", name: tool.manufacturerName } }
			: {}),
		...(offers.length > 0
			? { offers: offers.length === 1 ? offers[0] : offers }
			: {}),
		...(reviewStats.count > 0 && reviewStats.avg !== null
			? {
					aggregateRating: {
						"@type": "AggregateRating",
						ratingValue: Number(reviewStats.avg.toFixed(2)),
						reviewCount: reviewStats.count,
					},
				}
			: {}),
	};

	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD exige <script> inline; "<" escapado bloqueia injeção via dados do catálogo
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, "\\u003c"),
			}}
			type="application/ld+json"
		/>
	);
}

export function BreadcrumbJsonLd({
	category,
	productName,
	slug,
}: {
	category: { slug: string; name: string } | null;
	productName: string;
	slug: string;
}) {
	const items = [
		{ name: "Início", item: BASE_URL },
		{ name: "Catálogo", item: `${BASE_URL}/catalog` },
		...(category
			? [
					{
						name: category.name,
						item: `${BASE_URL}/catalog?cat=${category.slug}`,
					},
				]
			: []),
		{ name: productName, item: `${BASE_URL}/product/${slug}` },
	];

	const data = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((entry, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: entry.name,
			item: entry.item,
		})),
	};

	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD exige <script> inline; "<" escapado bloqueia injeção via dados do catálogo
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, "\\u003c"),
			}}
			type="application/ld+json"
		/>
	);
}
