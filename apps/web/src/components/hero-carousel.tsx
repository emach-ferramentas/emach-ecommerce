"use client";

import type { Banner } from "@emach/db/schema/banner";
import {
	Carousel,
	type CarouselApi,
	CarouselContent,
	CarouselItem,
} from "@emach/ui/components/carousel";
import { cn } from "@emach/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import {
	domAnimation,
	LazyMotion,
	type MotionValue,
	m,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "framer-motion";
import { ArrowRight, Pause, Play } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
	EmachButton,
	type emachButtonVariants,
} from "@/components/emach-button";
import { type CountdownParts, formatCountdown } from "@/lib/countdown";

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
	| "altText"
	| "badgeText"
	| "ctaLabel"
	| "ctaHref"
	| "ctaVariant"
	| "layout"
	| "productScale"
	| "ctaScale"
	| "countdownTarget"
>;

const AUTOPLAY_INTERVAL = 9000;
const PARALLAX_MAX = 15;
const PARALLAX_SPRING = { stiffness: 80, damping: 20, mass: 0.5 } as const;

// Fallback: a home nunca fica sem hero quando não há banner ativo no banco.
const FALLBACK_BANNERS: HeroBanner[] = [
	{
		id: "fallback-01",
		backgroundImageUrl: "/images/hero-imagens/emach_hero_01_bg.png",
		backgroundImageMobileUrl: null,
		backgroundMobileMode: "inherit",
		productImageUrl: "/images/hero-imagens/emach_hero_01_product.png",
		productImageMobileUrl: null,
		title: null,
		subtitle: null,
		altText: "EMACH — Potência redefinida",
		ctaLabel: "Ver Catálogo",
		ctaHref: "/catalog",
		ctaVariant: "red",
		layout: "split",
		badgeText: null,
		productScale: 100,
		ctaScale: 100,
		countdownTarget: null,
	},
	{
		id: "fallback-02",
		backgroundImageUrl: "/images/hero-imagens/emach_hero_02_bg.png",
		backgroundImageMobileUrl: null,
		backgroundMobileMode: "inherit",
		productImageUrl: "/images/hero-imagens/emach_hero_02_product.png",
		productImageMobileUrl: null,
		title: null,
		subtitle: null,
		altText: "EMACH — Linha profissional",
		ctaLabel: "Ver Catálogo",
		ctaHref: "/catalog",
		ctaVariant: "red",
		layout: "split",
		badgeText: null,
		productScale: 100,
		ctaScale: 100,
		countdownTarget: null,
	},
];

interface CtaStyle {
	className?: string;
	variant: VariantProps<typeof emachButtonVariants>["variant"];
}

// Mapeia a variante do banco para a EmachButton. `white` reaproveita primary
// sobrescrevendo as cores; `ghost` = outline-light (ações sobre dark do DESIGN.md).
const CTA_VARIANT_MAP: Record<HeroBanner["ctaVariant"], CtaStyle> = {
	red: { variant: "primary" },
	dark: { variant: "dark", className: "border-white/25" },
	white: {
		variant: "primary",
		className: "border-transparent bg-white text-near-black hover:bg-white/90",
	},
	ghost: { variant: "outline-light" },
};

interface LayoutConfig {
	/** Posição/alinhamento do bloco de conteúdo no desktop (lg). */
	content: string;
	/**
	 * "inline" = CTA renderizado dentro do bloco de conteúdo; caso contrário, a
	 * classe `lg:` que posiciona o CTA separado no canto (mobile é sempre a base
	 * full-width). Estendido em #130: `mirror_split` põe o CTA à esquerda.
	 */
	cta: "inline" | string;
	/** Posição/tamanho do produto no desktop (lg); null = layout sem produto. */
	product: string | null;
	/** Lado do texto no desktop — orienta a direção do gradiente de legibilidade. */
	textSide: "left" | "right" | "center";
}

// Posições do CTA separado no desktop (a base mobile full-width é comum a todos).
const CTA_CORNER_RIGHT = "lg:right-[4%] lg:bottom-[12%] lg:left-auto lg:w-auto";
const CTA_CENTER =
	"lg:left-1/2 lg:right-auto lg:bottom-[10%] lg:-translate-x-1/2 lg:w-auto";

// Mapa de posições por preset. Os 4 primeiros são os originais; os 4 últimos
// espelham `banner-layout-pos.ts` do dashboard (issue #130 / Hero Builder v2).
const LAYOUT_CONFIG: Record<HeroBanner["layout"], LayoutConfig> = {
	split: {
		content:
			"lg:left-[4%] lg:right-auto lg:bottom-[18%] lg:max-w-[44%] lg:items-start lg:text-left",
		product: "lg:left-[66%] lg:top-1/2 lg:h-[64%] lg:w-[40%]",
		cta: CTA_CORNER_RIGHT,
		textSide: "left",
	},
	stack_left: {
		content:
			"lg:left-[4%] lg:right-auto lg:bottom-[15%] lg:max-w-[48%] lg:items-start lg:text-left",
		product: "lg:left-[69%] lg:top-1/2 lg:h-[64%] lg:w-[42%]",
		cta: "inline",
		textSide: "left",
	},
	center_bottom: {
		content:
			"lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:bottom-[13%] lg:max-w-[70%] lg:items-center lg:text-center",
		product: "lg:left-1/2 lg:top-[34%] lg:h-[52%] lg:w-[40%]",
		cta: "inline",
		textSide: "center",
	},
	center_mid: {
		content:
			"lg:left-1/2 lg:right-auto lg:top-1/2 lg:bottom-auto lg:-translate-x-1/2 lg:-translate-y-1/2 lg:max-w-[72%] lg:items-center lg:text-center",
		product: null,
		cta: "inline",
		textSide: "center",
	},
	// produto topo-centro · texto esquerda-meio · CTA direita-baixo
	center_cta_right: {
		content:
			"lg:left-[4%] lg:right-auto lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2 lg:max-w-[44%] lg:items-start lg:text-left",
		product: "lg:left-1/2 lg:top-[34%] lg:h-[52%] lg:w-[42%]",
		cta: CTA_CORNER_RIGHT,
		textSide: "left",
	},
	// espelho do split: produto esquerda-meio · texto direita-meio · CTA direita-baixo
	mirror_split: {
		content:
			"lg:right-[4%] lg:left-auto lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2 lg:max-w-[44%] lg:items-end lg:text-right",
		product: "lg:left-[34%] lg:top-1/2 lg:h-[64%] lg:w-[40%]",
		cta: CTA_CORNER_RIGHT,
		textSide: "right",
	},
	// produto dominante centro · texto topo-centro · CTA centro-baixo
	hero_center: {
		content:
			"lg:left-1/2 lg:right-auto lg:top-[8%] lg:bottom-auto lg:-translate-x-1/2 lg:max-w-[70%] lg:items-center lg:text-center",
		product: "lg:left-1/2 lg:top-1/2 lg:h-[68%] lg:w-[46%]",
		cta: CTA_CENTER,
		textSide: "center",
	},
	// produto dominante centro · texto topo-centro · CTA direita-baixo (variação do hero_center)
	text_right: {
		content:
			"lg:left-1/2 lg:right-auto lg:top-[8%] lg:bottom-auto lg:-translate-x-1/2 lg:max-w-[70%] lg:items-center lg:text-center",
		product: "lg:left-1/2 lg:top-1/2 lg:h-[68%] lg:w-[46%]",
		cta: CTA_CORNER_RIGHT,
		textSide: "center",
	},
};

// Direção do gradiente de legibilidade conforme o lado do texto no desktop.
const GRADIENT_BY_SIDE: Record<LayoutConfig["textSide"], string> = {
	left: "lg:bg-gradient-to-r",
	right: "lg:bg-gradient-to-l",
	center: "lg:bg-gradient-to-t",
};

function HeroCta({
	banner,
	className,
}: {
	banner: HeroBanner;
	className?: string;
}) {
	if (!(banner.ctaLabel && banner.ctaHref)) {
		return null;
	}
	const style = CTA_VARIANT_MAP[banner.ctaVariant];
	return (
		// ctaHref vem como string do banco; typedRoutes não valida em runtime.
		<Link
			// Escala do CTA (#130) é ajuste fino de DESKTOP — gated no lg+ via CSS var.
			// No mobile fica `scale:1`, senão `left/right-5%` (90%) × 1.x transbordava.
			className={cn(
				"inline-flex [scale:1] lg:[scale:var(--cta-scale)]",
				className
			)}
			href={banner.ctaHref as Route}
			style={{ "--cta-scale": banner.ctaScale / 100 } as React.CSSProperties}
		>
			<EmachButton
				className={style.className}
				full
				icon={<ArrowRight className="size-4" />}
				size="lg"
				variant={style.variant}
			>
				{banner.ctaLabel}
			</EmachButton>
		</Link>
	);
}

// Resolução do fundo mobile por modo (desktop nunca muda):
//   none → sem imagem · custom → mobile url (fallback desktop) · inherit → desktop.
function resolveMobileBg(banner: HeroBanner): string | null {
	switch (banner.backgroundMobileMode) {
		case "none":
			return null;
		case "custom":
			return banner.backgroundImageMobileUrl ?? banner.backgroundImageUrl;
		default:
			return banner.backgroundImageUrl;
	}
}

// Fundo: desktop é sempre `backgroundImageUrl`. O mobile segue o modo (acima).
function HeroBackground({
	banner,
	isFirst,
}: {
	banner: HeroBanner;
	isFirst: boolean;
}) {
	const desktopBg = banner.backgroundImageUrl;
	const mobileBg = resolveMobileBg(banner);

	// Quando a mesma imagem serve desktop e mobile, um único <Image> cobre tudo.
	const sharedBg = desktopBg != null && mobileBg === desktopBg;
	const fetchPriority = isFirst ? "high" : "auto";

	return (
		<div className="absolute inset-0 bg-black">
			{desktopBg != null && (
				<Image
					alt={banner.altText ?? ""}
					className={cn("object-cover", !sharedBg && "hidden lg:block")}
					fetchPriority={fetchPriority}
					fill
					priority={isFirst}
					quality={75}
					sizes="100vw"
					src={desktopBg}
				/>
			)}
			{!sharedBg && mobileBg != null && (
				<Image
					alt={banner.altText ?? ""}
					className="object-cover lg:hidden"
					fetchPriority={fetchPriority}
					fill
					priority={isFirst}
					quality={75}
					sizes="100vw"
					src={mobileBg}
				/>
			)}
		</div>
	);
}

// Glow vermelho — assinatura cinematográfica. O pulse (repaint de blur(40px) por
// frame) é caro no mobile — anima só no desktop; no mobile fica estático.
function HeroGlow({ reduceMotion }: { reduceMotion: boolean }) {
	const [isDesktop, setIsDesktop] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 1024px)");
		const update = () => setIsDesktop(mq.matches);
		update();
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	}, []);
	const animated = !reduceMotion && isDesktop;
	return (
		<m.div
			animate={animated ? { opacity: [0.6, 1, 0.6] } : undefined}
			aria-hidden="true"
			className="pointer-events-none absolute top-1/2 left-1/2 z-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
			style={{
				width: "clamp(400px, 70vw, 900px)",
				height: "clamp(400px, 70vw, 900px)",
				background:
					"radial-gradient(circle, rgba(230,0,18,0.22) 0%, rgba(230,0,18,0.07) 40%, transparent 70%)",
				filter: "blur(40px)",
			}}
			transition={
				animated
					? {
							duration: 4,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						}
					: undefined
			}
		/>
	);
}

interface HeroProductProps {
	banner: HeroBanner;
	cfg: LayoutConfig;
	isActive: boolean;
	isFirst: boolean;
	parallaxX: MotionValue<number>;
	parallaxY: MotionValue<number>;
	reduceMotion: boolean;
}

// Produto central (opcional; ausente no layout center_mid).
function HeroProduct({
	banner,
	cfg,
	isActive,
	isFirst,
	parallaxX,
	parallaxY,
	reduceMotion,
}: HeroProductProps) {
	if (cfg.product === null || banner.productImageUrl == null) {
		return null;
	}
	const mobileProduct = banner.productImageMobileUrl ?? banner.productImageUrl;
	// Escala do produto (#130) é ajuste fino de DESKTOP. Vira CSS var no wrapper e a
	// classe `lg:[scale:var(--prod-scale)]` no m.div interno consome (cascata) —
	// compõe com o transform do framer (parallax + realce 1/0.94). No mobile fica
	// `scale:1`: a base `w-82%` já cabe; ×1.6 renderizava 525px num viewport de 400.
	const productScaleFactor = banner.productScale / 100;
	const floatAnimate = reduceMotion ? undefined : { y: [0, -15, 0] };
	const floatTransition = reduceMotion
		? undefined
		: ({
				duration: 5,
				repeat: Number.POSITIVE_INFINITY,
				ease: "easeInOut",
			} as const);
	const animate = reduceMotion
		? { opacity: 1, scale: 1 }
		: {
				opacity: isActive ? 1 : 0.35,
				scale: isActive ? 1 : 0.94,
			};
	return (
		// Wrapper centraliza (translate) e carrega a var; o scale fica no m.div
		// interno pra não brigar o translate de centragem com o scale no mesmo nó.
		<div
			className={cn(
				"absolute top-[46%] left-1/2 z-15 h-[52%] w-[92%] -translate-x-1/2 -translate-y-1/2",
				cfg.product
			)}
			style={{ "--prod-scale": productScaleFactor } as React.CSSProperties}
		>
			<m.div
				animate={animate}
				className="relative h-full w-full [scale:1] lg:[scale:var(--prod-scale)]"
				style={{ x: parallaxX, y: parallaxY }}
				transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
			>
				<m.div
					animate={floatAnimate}
					className="relative h-full w-full drop-shadow-[0_30px_24px_rgba(0,0,0,0.55)]"
					transition={floatTransition}
				>
					<Image
						alt=""
						className="object-contain"
						fetchPriority={isFirst ? "high" : "auto"}
						fill
						priority={isFirst}
						quality={85}
						sizes="(max-width: 1024px) 92vw, 42vw"
						src={mobileProduct}
					/>
				</m.div>
			</m.div>
		</div>
	);
}

// Contador regressivo do hero. Reusa `formatCountdown` (lib/countdown, mesmo
// util do PromoCountdown). Calcula só pós-mount pra evitar mismatch de
// hidratação; some quando expira. Display compacto e branco — o vermelho da
// tela é o CTA (DESIGN.md: vermelho uma vez por tela).
function HeroCountdown({ target }: { target: Date }) {
	const [parts, setParts] = useState<CountdownParts | null>(null);
	useEffect(() => {
		const t = target.getTime();
		const tick = () => setParts(formatCountdown(t - Date.now()));
		tick();
		const id = window.setInterval(tick, 1000);
		return () => window.clearInterval(id);
	}, [target]);
	if (parts === null || parts.done) {
		return null;
	}
	return (
		<span
			aria-live="off"
			className="mt-4 font-display font-semibold text-[15px] text-white tabular-nums tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[17px]"
			role="timer"
		>
			{parts.days}d {parts.hours}h {parts.minutes}m {parts.seconds}s
		</span>
	);
}

// Bloco de conteúdo: título + régua + subtítulo (+ CTA inline).
function HeroContentBlock({
	banner,
	cfg,
	isH1,
}: {
	banner: HeroBanner;
	cfg: LayoutConfig;
	isH1: boolean;
}) {
	const HeadingTag = isH1 ? "h1" : "h2";
	return (
		<div
			className={cn(
				"absolute z-20 flex flex-col items-start text-left",
				"right-[5%] bottom-[22%] left-[5%]",
				cfg.content
			)}
		>
			{banner.badgeText && (
				<span className="mb-3 inline-block bg-white px-2.5 py-0.5 font-display font-semibold text-[11px] text-near-black uppercase tracking-[0.06em]">
					{banner.badgeText}
				</span>
			)}
			{banner.title && (
				<>
					<HeadingTag className="text-balance font-display font-medium text-[clamp(44px,6vw,84px)] text-white uppercase leading-[0.9] tracking-[-0.01em] drop-shadow-[0_3px_18px_rgba(0,0,0,0.7)]">
						{banner.title}
					</HeadingTag>
					<span aria-hidden="true" className="my-4 h-[3px] w-16 bg-emach-red" />
				</>
			)}
			{banner.subtitle && (
				<p className="max-w-[44ch] font-sans text-[15px] text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[17px]">
					{banner.subtitle}
				</p>
			)}
			{banner.countdownTarget && (
				<HeroCountdown target={banner.countdownTarget} />
			)}
			{cfg.cta === "inline" && (
				<HeroCta banner={banner} className="mt-6 w-full lg:w-auto" />
			)}
		</div>
	);
}

interface HeroSlideContentProps {
	banner: HeroBanner;
	isActive: boolean;
	isFirst: boolean;
	isH1: boolean;
	parallaxX: MotionValue<number>;
	parallaxY: MotionValue<number>;
	reduceMotion: boolean;
}

function HeroSlideContent({
	banner,
	isActive,
	isFirst,
	isH1,
	parallaxX,
	parallaxY,
	reduceMotion,
}: HeroSlideContentProps) {
	const cfg = LAYOUT_CONFIG[banner.layout];
	const hasText = Boolean(banner.title || banner.subtitle);
	return (
		<div className="absolute inset-0">
			<HeroBackground banner={banner} isFirst={isFirst} />

			<HeroGlow reduceMotion={reduceMotion} />

			{/* Gradiente de legibilidade — só quando há texto overlay a proteger.
			    Sem título/subtítulo (fallback, "imagem pura"), a arte fica intacta. */}
			{hasText && (
				<div
					aria-hidden="true"
					className={cn(
						"absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent lg:from-black/80 lg:via-black/20 lg:to-transparent",
						GRADIENT_BY_SIDE[cfg.textSide]
					)}
				/>
			)}

			{/* Banner "imagem pura" (sem texto) COM imagem mobile: a arte é recortada e
			    os dots/CTA precisam de contraste — scrim inferior só-mobile. Quando não
			    há bg mobile (`none`), o backdrop já é preto → scrim seria preto-no-preto. */}
			{!hasText && resolveMobileBg(banner) != null && (
				<div
					aria-hidden="true"
					className="absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-black/75 to-transparent lg:hidden"
				/>
			)}

			<HeroProduct
				banner={banner}
				cfg={cfg}
				isActive={isActive}
				isFirst={isFirst}
				parallaxX={parallaxX}
				parallaxY={parallaxY}
				reduceMotion={reduceMotion}
			/>

			<HeroContentBlock banner={banner} cfg={cfg} isH1={isH1} />

			{/* CTA separado no canto (split, mirror_split, center_cta_right, hero_center);
				 a posição lg: vem de cfg.cta. Mobile vira full-width na base. */}
			{cfg.cta !== "inline" && (
				<HeroCta
					banner={banner}
					className={cn(
						"absolute right-[5%] bottom-[9%] left-[5%] z-20",
						cfg.cta
					)}
				/>
			)}
		</div>
	);
}

export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
	const slides = banners.length > 0 ? banners : FALLBACK_BANNERS;
	const [api, setApi] = useState<CarouselApi>();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const reduceMotion = useReducedMotion() ?? false;

	const mouseX = useMotionValue(0);
	const mouseY = useMotionValue(0);
	const parallaxX = useSpring(mouseX, PARALLAX_SPRING);
	const parallaxY = useSpring(mouseY, PARALLAX_SPRING);

	// Primeiro slide com título vira o <h1> da home; demais títulos viram <h2>.
	// Quando nenhum banner tem título (ex.: todos os fallbacks têm title:null),
	// o <h1> sr-only garante que a página nunca fique sem h1 (SEO + a11y).
	const h1Index = slides.findIndex((b) => b.title != null);

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
								<HeroSlideContent
									banner={banner}
									isActive={index === selectedIndex}
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
