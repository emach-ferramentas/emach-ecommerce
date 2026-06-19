"use client";

import type { ToolListItem } from "@emach/db/queries/tools";
import type { Voltage } from "@emach/db/schema/tools";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@emach/ui/components/carousel";
import type { LinkProps } from "next/link";
import { ProductCard } from "@/components/product-card";
import { ProductGrid } from "@/components/product-grid";
import { SectionHeader } from "@/components/section-header";

interface ProductCarouselProps {
	label?: string;
	link?: {
		href: LinkProps<string>["href"];
		label: string;
		variant?: "underline" | "arrow";
	};
	title: string;
	tools: ToolListItem[];
	voltagesByTool?: Map<string, Voltage[]>;
}

// Acima deste limite vira carrossel; até ele, grid estático com stagger.
const CAROUSEL_THRESHOLD = 4;

// Setas pretas de cantos retos (DESIGN.md: border-radius 0 em interativos).
// No hover o fundo continua preto e o ícone acende em vermelho (vermelho
// sobre preto = assinatura Ferrari). hover:bg-foreground e hover:text-emach-red
// neutralizam o hover:bg-muted/hover:text-foreground do variant outline.
const ARROW_CLASS =
	"static size-10 translate-y-0 rounded-none border-0 bg-foreground text-background transition-colors hover:bg-foreground hover:text-emach-red disabled:opacity-30";

export function ProductCarousel({
	tools,
	label,
	title,
	link,
	voltagesByTool,
}: ProductCarouselProps) {
	const isCarousel = tools.length > CAROUSEL_THRESHOLD;

	if (!isCarousel) {
		return (
			<>
				<SectionHeader label={label} link={link} title={title} />
				<ProductGrid tools={tools} voltagesByTool={voltagesByTool} />
			</>
		);
	}

	const total = tools.length;

	return (
		<Carousel aria-label={title} opts={{ loop: true, align: "start" }}>
			<SectionHeader
				actions={
					<div className="hidden items-center gap-2 md:flex">
						<CarouselPrevious className={ARROW_CLASS} />
						<CarouselNext className={ARROW_CLASS} />
					</div>
				}
				label={label}
				link={link}
				title={title}
			/>
			{/* pt-2: folga pro hover-lift do card não ser cortado pelo overflow-hidden do track */}
			<CarouselContent className="-ml-5 pt-2">
				{tools.map((tool, i) => (
					<CarouselItem
						aria-label={`Slide ${i + 1} de ${total}`}
						className="pl-5 sm:basis-1/2 lg:basis-1/4"
						key={tool.id}
					>
						<ProductCard tool={tool} voltages={voltagesByTool?.get(tool.id)} />
					</CarouselItem>
				))}
			</CarouselContent>
		</Carousel>
	);
}
