import { db } from "@emach/db";
import { getCategoryBySlug } from "@emach/db/queries/categories";
import { getTools, type ToolListItem } from "@emach/db/queries/tools";
import type { Route } from "next";
import { ProductCard } from "@/components/product-card";
import { ProductCardSkeleton } from "@/components/product-card-skeleton";
import { SectionHeader } from "@/components/section-header";

interface RelatedProductsProps {
	categoryPath: string | null;
	toolId: string;
}

const RELATED_LIMIT = 5;
const SKELETON_SLOTS = [0, 1, 2, 3, 4] as const;

// Mesma caixa da seção real (SectionHeader md + grid de 5) para a troca
// skeleton→dados não deslocar a página.
export function RelatedProductsSkeleton() {
	return (
		<section aria-hidden="true" className="pt-16 pb-20">
			<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]">
				<div className="mb-8 animate-pulse">
					<div className="h-3 w-36 bg-gray-20" />
					<div className="mt-2.5 h-7 w-64 bg-gray-20" />
				</div>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
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

	let rootCategory: { slug: string; name: string } | null = null;
	const rootSlug = categoryPath?.split("/").filter(Boolean)[0];
	if (rootSlug) {
		const root = await getCategoryBySlug(db, rootSlug);
		if (root) {
			rootCategory = { slug: root.slug, name: root.name };
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

	return (
		<section aria-label="Produtos relacionados" className="pt-16 pb-20">
			{/* Mesma coluna alinhada ao topo (galeria w-1/2 + buy box w-[480px]). */}
			<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]">
				<SectionHeader
					label="Continue explorando"
					link={{
						href: (rootCategory
							? `/catalog/${rootCategory.slug}`
							: "/catalog") as Route,
						label: "Ver categoria",
						variant: "arrow",
					}}
					title="Você também pode gostar"
					titleSize="md"
				/>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
					{picked.map((tool) => (
						<ProductCard key={tool.id} tool={tool} />
					))}
				</div>
			</div>
		</section>
	);
}
