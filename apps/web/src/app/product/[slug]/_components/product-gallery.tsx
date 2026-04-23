"use client";

import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@emach/ui/components/carousel";
import { cn } from "@emach/ui/lib/utils";
import { useState } from "react";
import InnerImageZoom from "react-inner-image-zoom";
import { ProductImage } from "@/components/product-image";
import "react-inner-image-zoom/es/styles.min.css";
import "./product-gallery.css";

interface ProductGalleryProps {
	categorySlug: string;
	images: string[];
	name: string;
}

const MAX_STATIC_THUMBS = 5;

interface ThumbButtonProps {
	categorySlug: string;
	index: number;
	isActive: boolean;
	name: string;
	onClick: () => void;
	src: string | undefined;
}

function ThumbButton({
	categorySlug,
	index,
	isActive,
	name,
	onClick,
	src,
}: ThumbButtonProps) {
	return (
		<button
			aria-label={`${name} — imagem ${index + 1}`}
			className={cn(
				"relative aspect-square w-full cursor-pointer overflow-hidden border-2 bg-image-bg",
				isActive ? "border-emach-red" : "border-transparent"
			)}
			onClick={onClick}
			type="button"
		>
			<ProductImage
				alt={`${name} — miniatura ${index + 1}`}
				categorySlug={categorySlug}
				sizes="80px"
				src={src}
			/>
		</button>
	);
}

export function ProductGallery({
	categorySlug,
	images,
	name,
}: ProductGalleryProps) {
	const slots = images.length > 0 ? images : [undefined];
	const [activeThumb, setActiveThumb] = useState(0);
	const activeSrc = slots[activeThumb] ?? slots[0];
	const needsCarousel = slots.length > MAX_STATIC_THUMBS;

	const renderThumb = (src: string | undefined, i: number) => (
		<ThumbButton
			categorySlug={categorySlug}
			index={i}
			isActive={activeThumb === i}
			key={src ?? i}
			name={name}
			onClick={() => setActiveThumb(i)}
			src={src}
		/>
	);

	return (
		<div className="flex w-1/2 flex-col justify-center lg:flex-row lg:gap-3">
			{slots.length > 1 && (
				<aside className="order-2 mt-3 md:order-1 md:mt-0 md:w-24">
					{/* Mobile: grid horizontal */}
					<div className="grid grid-cols-4 gap-2 lg:hidden">
						{slots.map((src, i) => renderThumb(src, i))}
					</div>

					{/* Desktop: coluna vertical — estática ou carrossel */}
					<div className="hidden lg:block">
						{needsCarousel ? (
							<Carousel
								className="relative w-full py-10"
								opts={{ align: "start", slidesToScroll: 1 }}
								orientation="vertical"
							>
								<CarouselContent className="-mt-2 h-[412px]">
									{slots.map((src, i) => (
										<CarouselItem className="basis-1/5 pt-2" key={src ?? i}>
											{renderThumb(src, i)}
										</CarouselItem>
									))}
								</CarouselContent>
								<CarouselPrevious className="top-0 size-8" />
								<CarouselNext className="bottom-0 size-8" />
							</Carousel>
						) : (
							<div className="flex flex-col gap-2">
								{slots.map((src, i) => renderThumb(src, i))}
							</div>
						)}
					</div>
				</aside>
			)}

			<div className="order-1 lg:order-2 lg:flex-1">
				<div className="relative aspect-square w-5/6 overflow-hidden bg-image-bg">
					{activeSrc ? (
						<InnerImageZoom
							imgAttributes={{ alt: name }}
							src={activeSrc}
							zoomScale={2}
							zoomSrc={activeSrc}
						/>
					) : (
						<ProductImage alt={name} categorySlug={categorySlug} priority />
					)}
				</div>
			</div>
		</div>
	);
}
