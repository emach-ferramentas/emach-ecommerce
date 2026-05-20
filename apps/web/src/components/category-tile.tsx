"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface CategoryTileCategory {
	description: string | null;
	imageUrl: string | null;
	name: string;
	slug: string;
}

interface CategoryTileProps {
	category: CategoryTileCategory;
	index: number;
}

export function CategoryTile({ category, index }: CategoryTileProps) {
	const indexLabel = String(index + 1).padStart(2, "0");

	return (
		<Link
			className="group relative block aspect-3/4 overflow-hidden border border-transparent bg-image-bg shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[transform,border-color,box-shadow] duration-300 ease-out hover:scale-[1.015] hover:border-emach-red hover:shadow-[0_10px_28px_rgba(0,0,0,0.1)] motion-reduce:transition-none motion-reduce:hover:scale-100"
			href={`/catalog?cat=${category.slug}`}
		>
			{category.imageUrl ? (
				<Image
					alt=""
					aria-hidden="true"
					className="object-cover transition-transform duration-400 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
					fill
					sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
					src={category.imageUrl}
				/>
			) : (
				<div
					aria-hidden="true"
					className="absolute inset-0 bg-image-bg"
				/>
			)}

			{/* Gradient bottom→top sobre a imagem pra legibilidade do texto */}
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/42 to-transparent"
			/>

			{/* Outline gigante "01" — sai parcialmente do card */}
			<span
				aria-hidden="true"
				className="pointer-events-none absolute right-[-24px] bottom-[-48px] font-display font-medium text-[200px] text-transparent leading-none transition-[color] duration-300 ease-out [-webkit-text-stroke:2px_rgba(255,255,255,0.35)] group-hover:[-webkit-text-stroke:2px_#da291c]"
			>
				{indexLabel}
			</span>

			{/* Bloco de texto + CTA */}
			<div className="absolute right-5 bottom-5 left-5 flex flex-col gap-3 text-white">
				<h3 className="font-display font-medium text-[42px] leading-[0.95] tracking-[0.005em] [text-shadow:0_2px_12px_rgba(0,0,0,0.45)] lg:text-[48px]">
					{category.name}
				</h3>
				<span aria-hidden="true" className="h-[2px] w-12 bg-emach-red" />
				<span className="inline-flex items-center gap-2 font-bold font-display text-[13px] uppercase tracking-[0.14em]">
					Explorar
					<ArrowRight
						aria-hidden="true"
						className="transition-transform duration-250 ease-out group-hover:translate-x-2 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
						size={16}
						strokeWidth={2}
					/>
				</span>
			</div>
		</Link>
	);
}
