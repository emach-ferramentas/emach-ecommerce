// apps/web/src/app/(shop)/product/[slug]/_components/plate-media.tsx
"use client";

import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@emach/ui/components/dialog";
import { Play } from "lucide-react";
import Image from "next/image";

interface PlateMediaProps {
	/** Imagem da célula (2ª foto do produto; fallback de poster do vídeo). */
	image: { url: string } | null;
	name: string;
	video: { url: string; poster: string | null } | null;
}

const MEDIA_SIZES = "(min-width: 1024px) 40vw, 100vw";

/**
 * Conteúdo da célula de mídia da placa técnica: vídeo (Dialog) → segunda
 * foto → nada (o caller nem renderiza a célula). Preenche o pai, que dá o
 * tamanho (célula 2×2 no desktop, bloco full-width no mobile).
 */
export function PlateMedia({ image, name, video }: PlateMediaProps) {
	if (video) {
		const posterUrl = video.poster ?? image?.url ?? null;
		return (
			<Dialog>
				<DialogTrigger className="group relative flex h-full w-full cursor-pointer items-center justify-center bg-image-bg focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2">
					{posterUrl ? (
						<Image
							alt={`${name} — vídeo`}
							className="object-contain p-4"
							fill
							sizes={MEDIA_SIZES}
							src={posterUrl}
						/>
					) : (
						<Play
							aria-hidden="true"
							className="size-10 text-gray-60"
							strokeWidth={1.5}
						/>
					)}
					<span className="absolute right-3 bottom-3 z-[1] flex items-center gap-1.5 bg-near-black/85 px-2.5 py-1 font-bold font-display text-[11px] text-white uppercase tracking-[0.08em]">
						<Play aria-hidden="true" className="size-3 fill-white" />
						Ver em ação
					</span>
				</DialogTrigger>
				<DialogContent className="border-none bg-black/95 p-0 ring-0">
					<DialogTitle className="sr-only">{`${name} — vídeo`}</DialogTitle>
					{/* biome-ignore lint/a11y/useMediaCaption: vídeo de produto sem legendas (v1 lean, issue #137) */}
					<video
						autoPlay
						className="h-full w-full"
						controls
						poster={video.poster ?? undefined}
						src={video.url}
					/>
				</DialogContent>
			</Dialog>
		);
	}

	if (image) {
		return (
			<div className="relative flex h-full w-full items-center justify-center bg-image-bg">
				<Image
					alt={name}
					className="object-contain p-4"
					fill
					sizes={MEDIA_SIZES}
					src={image.url}
				/>
			</div>
		);
	}

	return null;
}
