import { db } from "@emach/db";
import { getCategoryBySlug } from "@emach/db/queries/categories";
import { getTools, type ToolListItem } from "@emach/db/queries/tools";
import { ProductCard } from "@/components/product-card";
import { ProductCardSkeleton } from "@/components/product-card-skeleton";
import { getCardExtras } from "@/lib/card-data";
import { PRODUCT_COPY } from "../_lib/product-copy";

interface RelatedProductsProps {
	categoryPath: string | null;
	toolId: string;
}

const RELATED_LIMIT = 4;
const SKELETON_SLOTS = [0, 1, 2, 3] as const;

const sectionClass = "border-line border-t bg-canteiro py-10 md:py-14";
const gridClass =
	"mt-[22px] grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 xl:grid-cols-4";

// Mesma caixa da seção real (título + grade de 4) para a troca skeleton→dados
// não deslocar a página.
export function RelatedProductsSkeleton() {
	return (
		<section aria-hidden="true" className={sectionClass}>
			<div className="shop-wrap">
				<div className="h-10 w-72 animate-pulse bg-canteiro-2" />
				<div className={gridClass}>
					{SKELETON_SLOTS.map((slot) => (
						<ProductCardSkeleton key={slot} />
					))}
				</div>
			</div>
		</section>
	);
}

export async function RelatedProducts({
	toolId,
	categoryPath,
}: RelatedProductsProps) {
	const picked: ToolListItem[] = [];
	const seen = new Set<string>([toolId]);

	function collect(tools: ToolListItem[]) {
		for (const tool of tools) {
			if (picked.length >= RELATED_LIMIT) {
				break;
			}
			if (!seen.has(tool.id)) {
				picked.push(tool);
				seen.add(tool.id);
			}
		}
	}

	const rootSlug = categoryPath?.split("/").filter(Boolean)[0];
	if (rootSlug) {
		const root = await getCategoryBySlug(db, rootSlug);
		if (root) {
			const { tools } = await getTools(db, {
				categoryId: root.id,
				excludeToolId: toolId,
				limit: RELATED_LIMIT,
				offset: 0,
				sort: "newest",
			});
			collect(tools);
		}
	}

	if (picked.length < RELATED_LIMIT) {
		const { tools } = await getTools(db, {
			excludeToolId: toolId,
			limit: RELATED_LIMIT + picked.length,
			offset: 0,
			sort: "newest",
		});
		collect(tools);
	}

	if (picked.length === 0) {
		return null;
	}

	const extras = await getCardExtras(picked.map((t) => t.id));

	return (
		<section aria-labelledby="relacionados-titulo" className={sectionClass}>
			<div className="shop-wrap">
				<h2
					className="font-display font-extrabold text-[clamp(1.9rem,1.3rem+1.6vw,2.75rem)] uppercase leading-[0.98]"
					id="relacionados-titulo"
				>
					{PRODUCT_COPY.related}
				</h2>
				<div className={gridClass}>
					{picked.map((tool) => (
						<ProductCard
							extras={extras[tool.id]}
							key={tool.id}
							size="compact"
							tool={tool}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
