// apps/web/src/app/(shop)/product/[slug]/_components/product-specs.tsx
import type { ToolDetail } from "@emach/db/queries/tools";
import { cn } from "@emach/ui/lib/utils";

import { EMPTY_ATTRIBUTE, formatAttribute } from "@/lib/attribute-format";
import { PRODUCT_COPY } from "../_lib/product-copy";
import { toDescriptionParagraphs } from "./description-paragraphs";

interface ProductSpecsProps {
	attributes: ToolDetail["attributes"];
	/** Código da variante default (o da escolhida aparece na caixa de compra). */
	sku: string | null;
	tool: ToolDetail["tool"];
}

const sectionTitle =
	"font-display font-extrabold text-[clamp(1.9rem,1.3rem+1.6vw,2.75rem)] uppercase leading-[0.98]";

/** "Sobre o produto" (descrição) ao lado da ficha técnica em tabela. */
export function ProductSpecs({ attributes, sku, tool }: ProductSpecsProps) {
	const paragraphs = toDescriptionParagraphs(tool.description);
	const rows: { label: string; value: string }[] = [...attributes]
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((attr) => ({
			label: attr.definition.label,
			value: formatAttribute(attr),
		}))
		.filter((row) => row.value !== EMPTY_ATTRIBUTE);
	if (tool.manufacturerName) {
		rows.push({ label: PRODUCT_COPY.brand, value: tool.manufacturerName });
	}
	if (tool.model) {
		rows.push({ label: PRODUCT_COPY.model, value: tool.model });
	}
	if (sku) {
		rows.push({ label: PRODUCT_COPY.code, value: sku });
	}

	if (paragraphs.length === 0 && rows.length === 0) {
		return null;
	}

	return (
		<div className="shop-wrap grid gap-6 py-9 md:py-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
			{paragraphs.length > 0 && (
				<section aria-labelledby="sobre-produto" className="max-w-[68ch]">
					<h2 className={sectionTitle} id="sobre-produto">
						{PRODUCT_COPY.about}
					</h2>
					<div className="mt-4 text-[16.5px] text-ink-2 leading-[1.65]">
						{paragraphs.map((paragraph) => (
							<p
								className={cn(
									"first:mt-0",
									paragraph.tight ? "mt-0.5" : "mt-3.5"
								)}
								key={paragraph.key}
							>
								{paragraph.text}
							</p>
						))}
					</div>
				</section>
			)}
			{rows.length > 0 && (
				<section aria-labelledby="ficha-tecnica">
					<h2 className={sectionTitle} id="ficha-tecnica">
						{PRODUCT_COPY.specs}
					</h2>
					<dl className="mt-[18px] border-ink border-t-2">
						{rows.map((row) => (
							<div
								className="grid grid-cols-2 gap-3 border-line border-b py-[11px] text-[15px] md:grid-cols-[42%_1fr]"
								key={`${row.label}:${row.value}`}
							>
								<dt className="text-ink-muted">{row.label}</dt>
								<dd className="font-semibold tabular-nums [overflow-wrap:anywhere]">
									{row.value}
								</dd>
							</div>
						))}
					</dl>
				</section>
			)}
		</div>
	);
}
