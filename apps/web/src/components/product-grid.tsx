"use client";

import type { ToolListItem } from "@emach/db/queries/tools";
import type { Voltage } from "@emach/db/schema/tools";
import { ProductCard } from "@/components/product-card";

interface ProductGridProps {
	/** Repassado ao ProductCard: "elevated" sobre fundo escuro (promoções). */
	surface?: "dark" | "elevated";
	tools: ToolListItem[];
	/** Voltagens por toolId, para os selos do card. */
	voltagesByTool?: Map<string, Voltage[]>;
}

export function ProductGrid({
	surface,
	tools,
	voltagesByTool,
}: ProductGridProps) {
	return (
		<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
			{tools.map((tool, index) => (
				<div
					className="emach-reveal-item"
					key={tool.id}
					style={{ "--i": index } as React.CSSProperties}
				>
					<ProductCard
						surface={surface}
						tool={tool}
						voltages={voltagesByTool?.get(tool.id)}
					/>
				</div>
			))}
		</div>
	);
}
