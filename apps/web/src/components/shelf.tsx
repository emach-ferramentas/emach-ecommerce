"use client";

import { cn } from "@emach/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

interface ShelfProps {
	/** Cards já renderizados no servidor, um por item. */
	children: React.ReactNode;
	/** Prateleira dentro de página de catálogo: 3 por vez em vez de 4. */
	dense?: boolean;
	headingLevel?: 2 | 3;
	href: Route;
	imageSrc: string | null;
	inStockCount: number | null;
	itemCount: number;
	productCount: number;
	title: string;
}

function productsLabel(n: number) {
	return n === 1 ? "Ver o produto" : `Ver os ${n} produtos`;
}

const arrowClass =
	"grid size-11 cursor-pointer place-items-center rounded-[3px] border-[1.5px] border-line-strong bg-paper hover:enabled:border-ink disabled:cursor-default disabled:opacity-35 max-md:hidden";

/**
 * Prateleira horizontal: título que leva à lista completa, setas no desktop,
 * arraste no celular e um card final com a foto que abre todos os produtos.
 */
export function Shelf({
	children,
	dense = false,
	headingLevel = 3,
	href,
	imageSrc,
	inStockCount,
	itemCount,
	productCount,
	title,
}: ShelfProps) {
	const Heading = `h${headingLevel}` as const;
	const titleId = useId();
	const trackRef = useRef<HTMLDivElement>(null);
	const [edges, setEdges] = useState({
		atEnd: false,
		atStart: true,
		fits: false,
	});

	function measure() {
		const track = trackRef.current;
		if (!track) {
			return;
		}
		const max = track.scrollWidth - track.clientWidth;
		setEdges({
			atEnd: track.scrollLeft >= max - 2,
			atStart: track.scrollLeft <= 2,
			fits: max <= 2,
		});
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: mede uma vez e a cada resize; measure só lê o ref
	useEffect(() => {
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, []);

	function page(direction: 1 | -1) {
		const track = trackRef.current;
		if (!track) {
			return;
		}
		const reduce = window.matchMedia(
			"(prefers-reduced-motion: reduce)"
		).matches;
		track.scrollBy({
			left: direction * track.clientWidth,
			behavior: reduce ? "auto" : "smooth",
		});
	}

	return (
		<section aria-labelledby={titleId} className="min-w-0">
			<div className="mb-4 flex items-end justify-between gap-x-5 gap-y-2 border-ink border-b-2 pb-3 max-md:items-start">
				<div>
					<Heading
						className="font-display font-extrabold text-[clamp(1.55rem,1.15rem+1vw,2.1rem)] uppercase leading-[0.98]"
						id={titleId}
					>
						<Link
							className="text-ink no-underline decoration-2 hover:underline"
							href={href}
						>
							{title}
						</Link>
					</Heading>
					<p className="mt-[5px] text-[14px] text-ink-muted tabular-nums">
						{productCount} {productCount === 1 ? "produto" : "produtos"}
						{inStockCount !== null && `, ${inStockCount} em estoque`}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Link
						className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap px-2 font-bold text-[14.5px] text-ink no-underline hover:underline max-md:pr-0"
						href={href}
					>
						Ver todos
						<ChevronRight aria-hidden="true" className="size-4" />
					</Link>
					{!edges.fits && (
						<>
							<button
								aria-label={`Anteriores em ${title}`}
								className={arrowClass}
								disabled={edges.atStart}
								onClick={() => page(-1)}
								type="button"
							>
								<ChevronLeft aria-hidden="true" className="size-5" />
							</button>
							<button
								aria-label={`Próximos em ${title}`}
								className={arrowClass}
								disabled={edges.atEnd}
								onClick={() => page(1)}
								type="button"
							>
								<ChevronRight aria-hidden="true" className="size-5" />
							</button>
						</>
					)}
				</div>
			</div>
			<div
				className={cn(
					"-mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[76%] grid-flow-col gap-2.5 overflow-x-auto overscroll-x-contain px-4 pt-0.5 pb-1.5 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:gap-4 md:px-0 [&::-webkit-scrollbar]:hidden [&>*]:min-w-0 [&>*]:snap-start",
					dense
						? "md:auto-cols-[calc((100%_-_22.4px)/2.4)] xl:auto-cols-[calc((100%_-_32px)/3)]"
						: "md:auto-cols-[calc((100%_-_22.4px)/2.4)] lg:auto-cols-[calc((100%_-_32px)/3)] xl:auto-cols-[calc((100%_-_48px)/4)]"
				)}
				onScroll={measure}
				ref={trackRef}
			>
				{children}
				<Link
					className="group relative flex min-h-full items-end overflow-hidden rounded-[5px] bg-grafite text-white no-underline"
					href={href}
				>
					{imageSrc && (
						<Image
							alt=""
							className="object-cover opacity-55 transition-[transform,opacity] duration-500 ease-out-expo group-hover:scale-[1.04] group-hover:opacity-45 motion-reduce:transition-none"
							fill
							sizes="(min-width: 1296px) 300px, 76vw"
							src={imageSrc}
						/>
					)}
					<span className="relative z-[1] grid gap-2.5 p-4 md:p-5">
						<b className="font-display font-extrabold text-[26px] uppercase leading-[0.95] md:text-[30px]">
							{title}
						</b>
						<span className="inline-flex items-center gap-1.5 font-bold text-[15px]">
							{productsLabel(Math.max(productCount, itemCount))}
							<ChevronRight aria-hidden="true" className="size-5" />
						</span>
					</span>
				</Link>
			</div>
		</section>
	);
}
