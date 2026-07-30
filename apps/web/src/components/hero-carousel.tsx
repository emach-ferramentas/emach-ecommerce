"use client";

import type { Banner } from "@emach/db/schema/banner";
import {
	Carousel,
	type CarouselApi,
	CarouselContent,
	CarouselItem,
} from "@emach/ui/components/carousel";
import { cn } from "@emach/ui/lib/utils";
import {
	domAnimation,
	LazyMotion,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "framer-motion";
import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { FALLBACK_BANNERS } from "@/components/hero/hero-fallbacks";
import { HeroSlide } from "@/components/hero/hero-slide";
import { resolveComposition } from "@/lib/composition/legacy-composition";
import { useIsDesktop } from "@/lib/use-is-desktop";

/**
 * Subconjunto de `banner` que o hero consome. Inclui badge e countdown
 * (slots #123): o builder do dashboard já os oferece, então o storefront honra.
 */
export type HeroBanner = Pick<
	Banner,
	| "id"
	| "backgroundImageUrl"
	| "backgroundImageMobileUrl"
	| "backgroundMobileMode"
	| "productImageUrl"
	| "productImageMobileUrl"
	| "title"
	| "subtitle"
	| "specs"
	| "altText"
	| "badgeText"
	| "ctaLabel"
	| "ctaHref"
	| "ctaVariant"
	| "layout"
	| "productScale"
	| "ctaScale"
	| "countdownTarget"
	| "composition"
>;

const AUTOPLAY_INTERVAL = 9000;
const PARALLAX_MAX = 15;
const PARALLAX_SPRING = { stiffness: 80, damping: 20, mass: 0.5 } as const;

export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
	const slides = banners.length > 0 ? banners : FALLBACK_BANNERS;
	const [api, setApi] = useState<CarouselApi>();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const reduceMotion = useReducedMotion() ?? false;
	const isDesktop = useIsDesktop();

	const mouseX = useMotionValue(0);
	const mouseY = useMotionValue(0);
	const parallaxX = useSpring(mouseX, PARALLAX_SPRING);
	const parallaxY = useSpring(mouseY, PARALLAX_SPRING);

	// Compositions resolvidas uma vez por render — reaproveitadas no h1Index e
	// no map de slides (evita resolver duas vezes por slide).
	const compositions = slides.map((b) => resolveComposition(b));
	// Primeiro slide com título VISÍVEL (campo preenchido E elemento ligado) vira
	// h1; demais títulos viram h2. Quando nenhum banner tem título visível, o
	// <h1> sr-only garante que a página nunca fique sem h1 (SEO + a11y).
	const h1Index = slides.findIndex(
		(b, i) =>
			b.title != null && compositions[i]?.desktop.elements.title !== undefined
	);

	useEffect(() => {
		if (!api) {
			return;
		}
		setSelectedIndex(api.selectedScrollSnap());
		const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
		api.on("select", onSelect);
		return () => {
			api.off("select", onSelect);
		};
	}, [api]);

	useEffect(() => {
		if (!api || slides.length < 2 || reduceMotion || paused) {
			return;
		}
		const id = window.setInterval(() => {
			api.scrollNext();
		}, AUTOPLAY_INTERVAL);
		return () => window.clearInterval(id);
	}, [api, slides.length, reduceMotion, paused]);

	const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
		if (reduceMotion) {
			return;
		}
		const rect = e.currentTarget.getBoundingClientRect();
		const relX = (e.clientX - rect.left) / rect.width - 0.5;
		const relY = (e.clientY - rect.top) / rect.height - 0.5;
		mouseX.set(relX * PARALLAX_MAX * 2);
		mouseY.set(relY * PARALLAX_MAX * 2);
	};

	const handleMouseLeave = () => {
		mouseX.set(0);
		mouseY.set(0);
	};

	return (
		<LazyMotion features={domAnimation} strict>
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: parallax decorativo mouse-only na hero; teclado/toque não dependem disto */}
			<section
				aria-label="Banner principal"
				className="relative h-[70svh] min-h-[30rem] w-full overflow-hidden bg-black lg:h-svh lg:min-h-0"
				onMouseLeave={handleMouseLeave}
				onMouseMove={handleMouseMove}
			>
				{/* h1 invisível para leitores de tela quando nenhum banner tem título visível */}
				{h1Index === -1 && (
					<h1 className="sr-only">EMACH — Ferramentas Profissionais</h1>
				)}
				<Carousel
					className="h-full w-full"
					opts={{ loop: true, align: "start" }}
					setApi={setApi}
				>
					<CarouselContent className="ml-0 h-[70svh] min-h-[30rem] lg:h-svh lg:min-h-0">
						{slides.map((banner, index) => (
							<CarouselItem
								className="relative h-[70svh] min-h-[30rem] pl-0 lg:h-svh lg:min-h-0"
								key={banner.id}
							>
								<HeroSlide
									banner={banner}
									composition={
										compositions[index] ?? resolveComposition(banner)
									}
									isActive={index === selectedIndex}
									isDesktop={isDesktop}
									isFirst={index === 0}
									isH1={index === h1Index}
									parallaxX={parallaxX}
									parallaxY={parallaxY}
									reduceMotion={reduceMotion}
								/>
							</CarouselItem>
						))}
					</CarouselContent>
				</Carousel>

				{slides.length > 1 && (
					<div className="absolute bottom-28 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 lg:bottom-10">
						{slides.map((banner, index) => (
							<button
								aria-current={index === selectedIndex ? "true" : undefined}
								aria-label={`Slide ${index + 1} de ${slides.length}`}
								className={cn(
									"relative h-[4px] w-8 cursor-pointer transition-colors duration-200 after:absolute after:-inset-y-5 after:right-0 after:left-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 sm:w-10",
									index === selectedIndex ? "bg-emach-red" : "bg-white/30"
								)}
								key={banner.id}
								onClick={() => api?.scrollTo(index)}
								type="button"
							/>
						))}
						{!reduceMotion && (
							<button
								aria-label={
									paused
										? "Retomar troca automática de slides"
										: "Pausar troca automática de slides"
								}
								aria-pressed={paused}
								className="relative ml-2 flex size-11 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
								onClick={() => setPaused((p) => !p)}
								type="button"
							>
								{paused ? (
									<Play className="size-4" />
								) : (
									<Pause className="size-4" />
								)}
							</button>
						)}
					</div>
				)}
			</section>
		</LazyMotion>
	);
}
