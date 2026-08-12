"use client";

import { cn } from "@emach/ui/lib/utils";
import { Disc3, Drill, Ruler, Shield, Wrench } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
	eletricas: Drill,
	manuais: Wrench,
	medicao: Ruler,
	seguranca: Shield,
	acessorios: Disc3,
};

interface ProductImageProps {
	alt?: string;
	categorySlug: string;
	priority?: boolean;
	sizes?: string;
	src?: string;
	zoom?: boolean;
}

const WRAPPER_BASE =
	"absolute inset-0 overflow-hidden transition-transform duration-[var(--card-dur-image)] ease-[var(--card-ease)] motion-reduce:transition-none";
const ZOOM_ON_HOVER =
	"group-hover:scale-[1.04] motion-reduce:group-hover:scale-100";

export function ProductImage({
	alt,
	categorySlug,
	priority = false,
	sizes = "25vw",
	src,
	zoom = false,
}: ProductImageProps) {
	const [loaded, setLoaded] = useState(false);
	// Fade-in no onLoad mata o "pop" da foto sobre o tile claro. Imagem
	// priority (candidata a LCP) renderiza visível direto — opacity-0 até a
	// hydration atrasaria a métrica sem ganho perceptual.
	const fade = !priority;

	if (src) {
		return (
			<div className={cn(WRAPPER_BASE, zoom && ZOOM_ON_HOVER)}>
				<Image
					alt={alt ?? ""}
					className={cn(
						"object-cover",
						fade &&
							"transition-opacity duration-300 ease-out motion-reduce:transition-none",
						fade && !loaded && "opacity-0"
					)}
					fill
					onLoad={fade ? () => setLoaded(true) : undefined}
					priority={priority}
					sizes={sizes}
					src={src}
				/>
			</div>
		);
	}

	const Icon = CATEGORY_ICONS[categorySlug] ?? Wrench;
	return (
		<div
			className={cn(
				"emach-bg-placeholder flex items-center justify-center",
				WRAPPER_BASE,
				zoom && ZOOM_ON_HOVER
			)}
		>
			<div className="flex size-[58%] items-center justify-center text-cinema-2 opacity-[0.82]">
				<Icon className="h-full w-full" strokeWidth={1.2} />
			</div>
			<div
				aria-hidden="true"
				className="emach-bg-placeholder-shadow absolute right-[20%] bottom-[8%] left-[20%] h-4 blur-sm"
			/>
		</div>
	);
}
