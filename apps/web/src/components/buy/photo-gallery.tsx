"use client";

import { cn } from "@emach/ui/lib/utils";
import { ChevronLeft, ChevronRight, Play, Wrench } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { type GallerySlot, slotKey } from "@/lib/gallery-slots";

interface PhotoGalleryProps {
	name: string;
	/** Primeira foto com prioridade de carregamento (candidata a LCP). */
	priority?: boolean;
	sizes: string;
	slots: GallerySlot[];
	/** `side`: miniaturas em coluna (página de produto); `below`: em linha. */
	thumbs: "below" | "side";
}

const arrowClass =
	"absolute top-1/2 z-[2] grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-line bg-paper shadow-[0_2px_8px_rgba(22,25,29,0.12)] hover:border-ink disabled:cursor-default disabled:opacity-35 max-md:hidden";

/**
 * Galeria de fotos: trilho com rolagem por snap (deslizar no celular), setas,
 * contador e miniaturas. Vídeo do produto entra como um slide com controles.
 */
export function PhotoGallery({
	name,
	priority = false,
	sizes,
	slots,
	thumbs,
}: PhotoGalleryProps) {
	const trackRef = useRef<HTMLDivElement>(null);
	const [index, setIndex] = useState(0);
	const count = slots.length;

	function goTo(next: number) {
		const track = trackRef.current;
		const clamped = Math.max(0, Math.min(count - 1, next));
		setIndex(clamped);
		if (track) {
			const reduce = window.matchMedia(
				"(prefers-reduced-motion: reduce)"
			).matches;
			track.scrollTo({
				left: clamped * track.clientWidth,
				behavior: reduce ? "auto" : "smooth",
			});
		}
	}

	function onScroll() {
		const track = trackRef.current;
		if (!track) {
			return;
		}
		const current = Math.round(
			track.scrollLeft / Math.max(1, track.clientWidth)
		);
		if (current !== index) {
			setIndex(current);
		}
	}

	if (count === 0) {
		return (
			<div className="grid aspect-square place-items-center rounded-[5px] bg-well text-ink-muted">
				<Wrench aria-hidden="true" className="size-1/3" strokeWidth={1.2} />
				<span className="sr-only">{name}, sem foto</span>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"grid gap-3.5",
				thumbs === "side" && "md:grid-cols-[76px_minmax(0,1fr)]"
			)}
		>
			{count > 1 && (
				<div
					className={cn(
						"flex gap-2.5 overflow-x-auto [scrollbar-width:none]",
						thumbs === "side"
							? "max-md:hidden md:flex-col"
							: "order-2 justify-start"
					)}
				>
					{slots.map((slot, i) => (
						<button
							aria-current={i === index}
							aria-label={`${slot.kind === "video" ? "Vídeo" : "Foto"} ${i + 1} de ${count}`}
							className={cn(
								"relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-[3px] border-[1.5px] border-line bg-well p-1.5 hover:border-line-strong md:size-[76px]",
								i === index && "border-ink hover:border-ink"
							)}
							key={slotKey(slot)}
							onClick={() => goTo(i)}
							type="button"
						>
							{slot.kind === "image" ? (
								<Image
									alt=""
									className="object-contain p-1.5 mix-blend-multiply"
									fill
									sizes="76px"
									src={slot.url}
								/>
							) : (
								<span className="grid size-full place-items-center bg-grafite text-white">
									<Play aria-hidden="true" className="size-6 fill-white" />
								</span>
							)}
						</button>
					))}
				</div>
			)}

			<div className="relative overflow-hidden rounded-[5px] bg-well">
				<div
					className="flex aspect-square snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					onScroll={onScroll}
					ref={trackRef}
				>
					{slots.map((slot, i) => (
						<div
							className="relative shrink-0 grow-0 basis-full snap-start"
							key={slotKey(slot)}
						>
							{slot.kind === "image" ? (
								<Image
									alt={`${name}, foto ${i + 1} de ${count}`}
									className="object-contain p-5 mix-blend-multiply md:p-8"
									fill
									priority={priority && i === 0}
									sizes={sizes}
									src={slot.url}
								/>
							) : (
								// biome-ignore lint/a11y/useMediaCaption: vídeo de produto sem legendas (v1 lean, issue #137)
								<video
									className="absolute inset-0 size-full bg-grafite object-contain"
									controls
									poster={slot.poster ?? undefined}
									preload="metadata"
									src={slot.url}
								/>
							)}
						</div>
					))}
				</div>
				{count > 1 && (
					<>
						<button
							aria-label="Foto anterior"
							className={cn(arrowClass, "left-3")}
							disabled={index === 0}
							onClick={() => goTo(index - 1)}
							type="button"
						>
							<ChevronLeft aria-hidden="true" className="size-5" />
						</button>
						<button
							aria-label="Próxima foto"
							className={cn(arrowClass, "right-3")}
							disabled={index === count - 1}
							onClick={() => goTo(index + 1)}
							type="button"
						>
							<ChevronRight aria-hidden="true" className="size-5" />
						</button>
						<span
							aria-live="polite"
							className="absolute right-3 bottom-3 z-[2] rounded-full border border-line bg-paper px-2.5 py-1 font-bold text-[13px] tabular-nums"
						>
							{index + 1} / {count}
						</span>
					</>
				)}
			</div>
		</div>
	);
}
