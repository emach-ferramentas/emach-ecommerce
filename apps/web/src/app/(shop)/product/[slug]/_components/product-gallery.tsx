"use client";

import { cn } from "@emach/ui/lib/utils";
import { Play } from "lucide-react";
import { useState } from "react";
import InnerImageZoom from "react-inner-image-zoom";
import { ProductImage } from "@/components/product-image";
import "react-inner-image-zoom/es/styles.min.css";
import "./product-gallery.css";
import { buildSlots, type GallerySlot, slotKey } from "./gallery-slots";

interface ProductGalleryProps {
	categorySlug: string;
	images: { url: string }[];
	name: string;
	video?: { url: string; poster: string | null } | null;
}

// Serve a imagem principal otimizada (AVIF/WebP, redimensionada) pelo otimizador
// do Next — o original em alta-res fica só no zoom. Corta o LCP do PDP, que era a
// <img> crua do Supabase em tamanho cheio.
const NEXT_IMG_WIDTHS = [640, 828, 1080, 1200] as const;
// A galeria é full-width no mobile e metade da tela no desktop (lg:w-1/2);
// o browser escolhe a largura do srcSet por este `sizes` (mobile pega 640w em vez
// de 1080w, baixando ainda mais o LCP no celular).
const GALLERY_SIZES = "(min-width: 1024px) 50vw, 100vw";

function optimizedSrc(url: string, w = 1080) {
	return `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=75`;
}

function optimizedSrcSet(url: string) {
	return NEXT_IMG_WIDTHS.map((w) => `${optimizedSrc(url, w)} ${w}w`).join(", ");
}

interface ThumbButtonProps {
	categorySlug: string;
	index: number;
	isActive: boolean;
	name: string;
	onClick: () => void;
	slot: GallerySlot;
}

function ThumbButton({
	categorySlug,
	index,
	isActive,
	name,
	onClick,
	slot,
}: ThumbButtonProps) {
	const isVideo = slot.kind === "video";
	const thumbSrc =
		slot.kind === "video" ? (slot.poster ?? undefined) : slot.url;
	const label = isVideo ? `${name} — vídeo` : `${name} — imagem ${index + 1}`;

	return (
		<button
			aria-label={label}
			className={cn(
				"relative size-11 shrink-0 cursor-pointer overflow-hidden border-2 bg-white focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2",
				isActive ? "border-emach-red" : "border-border"
			)}
			onClick={onClick}
			type="button"
		>
			<ProductImage
				alt={label}
				categorySlug={categorySlug}
				sizes="80px"
				src={thumbSrc}
			/>
			{isVideo && (
				<span
					aria-hidden="true"
					className="absolute inset-0 flex items-center justify-center bg-black/30"
				>
					<Play className="size-6 fill-white text-white drop-shadow" />
				</span>
			)}
		</button>
	);
}

export function ProductGallery({
	categorySlug,
	images,
	name,
	video,
}: ProductGalleryProps) {
	const slots = buildSlots(images, video);
	const [activeThumb, setActiveThumb] = useState(0);
	const activeSlot = slots[activeThumb] ?? slots[0];

	const renderThumb = (slot: GallerySlot, i: number) => (
		<ThumbButton
			categorySlug={categorySlug}
			index={i}
			isActive={activeThumb === i}
			key={slotKey(slot)}
			name={name}
			onClick={() => setActiveThumb(i)}
			slot={slot}
		/>
	);

	const renderMainSlot = () => {
		if (!activeSlot) {
			return <ProductImage alt={name} categorySlug={categorySlug} priority />;
		}
		if (activeSlot.kind === "video") {
			return (
				// biome-ignore lint/a11y/useMediaCaption: vídeo de produto sem legendas (v1 lean, issue #137)
				<video
					className="h-full w-full bg-image-bg object-contain"
					controls
					poster={activeSlot.poster ?? undefined}
					preload="metadata"
					src={activeSlot.url}
				/>
			);
		}
		return (
			<InnerImageZoom
				imgAttributes={{
					alt: name,
					fetchPriority: "high",
					sizes: GALLERY_SIZES,
					srcSet: optimizedSrcSet(activeSlot.url),
				}}
				src={optimizedSrc(activeSlot.url)}
				zoomScale={1}
				zoomSrc={activeSlot.url}
			/>
		);
	};

	return (
		<div className="w-full lg:w-1/2">
			<div className="relative aspect-square w-full overflow-hidden bg-image-bg">
				{renderMainSlot()}
				{slots.length > 1 && (
					<div className="absolute bottom-3 left-3 z-[2] flex max-w-[calc(100%-4.5rem)] gap-2 overflow-x-auto">
						{slots.map((slot, i) => renderThumb(slot, i))}
					</div>
				)}
			</div>
		</div>
	);
}
