"use client";

import { ArrowRight, Disc3, Drill, HardHat, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Ícone de fallback por categoria raiz (espelha CATEGORY_ICONS de product-image.tsx).
const CATEGORY_ICONS: Record<string, React.ElementType> = {
	acessorios: Disc3,
	equipamentos: HardHat,
	"ferramentas-eletricas": Drill,
	"ferramentas-manuais": Wrench,
};

interface CategoryTileCategory {
	description: string | null;
	imageUrl: string | null;
	name: string;
	slug: string;
}

interface CategoryTileProps {
	/** Destaque automático (auto-cycle do grid) — espelha o estado :hover. */
	active?: boolean;
	category: CategoryTileCategory;
	index: number;
}

export function CategoryTile({ active, category, index }: CategoryTileProps) {
	const indexLabel = String(index + 1).padStart(2, "0");
	const FallbackIcon = CATEGORY_ICONS[category.slug] ?? Wrench;

	return (
		<Link
			className="group emach-bg-tile-spot relative block aspect-4/5 overflow-hidden rounded-[2px] border border-white/14 transition-[transform,border-color] duration-[var(--card-dur)] ease-[var(--card-ease)] hover:-translate-y-[3px] hover:border-white/32 data-[active=true]:-translate-y-[3px] data-[active=true]:border-white/32 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
			data-active={active ? "true" : undefined}
			href={`/catalog/${category.slug}`}
		>
			{/* Número marca d'água — sangra o canto, acende em vermelho no destaque */}
			<span
				aria-hidden="true"
				className="pointer-events-none absolute right-[-10px] bottom-[-30px] z-[1] font-display font-semibold text-[220px] text-transparent leading-none transition-[color] duration-[var(--card-dur)] ease-[var(--card-ease)] [-webkit-text-stroke:2px_rgba(255,255,255,0.34)] group-hover:[-webkit-text-stroke:2px_#da291c] group-data-[active=true]:[-webkit-text-stroke:2px_#da291c]"
			>
				{indexLabel}
			</span>

			{/* Ferramenta (PNG recortado) flutua com cor plena — sem overlay por cima.
			    Sem imagem: ícone da categoria sobre o spotlight, acende junto do tile. */}
			{category.imageUrl ? (
				<div className="absolute inset-x-[10%] top-[5%] bottom-[30%] z-[2]">
					<Image
						alt=""
						aria-hidden="true"
						className="object-contain transition-transform duration-[var(--card-dur-image)] ease-[var(--card-ease)] group-hover:scale-[1.05] group-data-[active=true]:scale-[1.05] motion-reduce:transition-none"
						fill
						sizes="(min-width: 1024px) 20vw, (min-width: 768px) 40vw, 80vw"
						src={category.imageUrl}
					/>
				</div>
			) : (
				<div className="absolute inset-x-[10%] top-[5%] bottom-[30%] z-[2] flex items-center justify-center">
					<FallbackIcon
						aria-hidden="true"
						className="h-auto w-[46%] text-white/16 transition-[color,transform] duration-[var(--card-dur)] ease-[var(--card-ease)] group-hover:scale-[1.05] group-hover:text-white/30 group-data-[active=true]:scale-[1.05] group-data-[active=true]:text-white/30 motion-reduce:transition-none"
						strokeWidth={1.2}
					/>
				</div>
			)}

			{/* Degradê escuro só na base — pro texto, nunca sobre a ferramenta */}
			<div
				aria-hidden="true"
				className="emach-bg-tile-foot absolute inset-x-0 bottom-0 z-[1] h-[46%]"
			/>

			{/* Bloco de texto + CTA */}
			<div className="absolute right-5 bottom-5 left-5 z-[3] flex flex-col gap-2 text-white">
				<h3 className="font-display font-medium text-[28px] leading-[0.95] tracking-[0.005em] [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
					{category.name}
				</h3>
				<span
					aria-hidden="true"
					className="h-[2px] w-12 bg-emach-red opacity-0 transition-opacity duration-[var(--card-dur)] ease-[var(--card-ease)] group-hover:opacity-100 group-data-[active=true]:opacity-100 motion-reduce:transition-none"
				/>
				<span className="inline-flex items-center gap-2 font-bold font-display text-[13px] uppercase tracking-[0.14em]">
					Explorar
					<ArrowRight
						aria-hidden="true"
						className="transition-transform duration-[var(--card-dur)] ease-[var(--card-ease)] group-hover:translate-x-2 group-data-[active=true]:translate-x-2 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
						size={16}
						strokeWidth={2}
					/>
				</span>
			</div>
		</Link>
	);
}
