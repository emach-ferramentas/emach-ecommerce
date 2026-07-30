"use client";

// Um slide do hero montado a partir de banner.composition (issue #210):
// fundo (modos mobile atuais + zoom/focal), glow (assinatura da loja — sempre),
// gradiente de legibilidade, elementos desktop posicionados na ordem
// SAFE_STACK_ORDER (z-order determinístico) e mobile via partition.
import type { Banner } from "@emach/db/schema/banner";
import { cn } from "@emach/ui/lib/utils";
import { m } from "framer-motion";
import Image from "next/image";
import {
	type BannerComposition,
	type ElementKey,
	type ElementPlacement,
	partitionMobileElements,
	SAFE_STACK_ORDER,
	type Viewport,
} from "@/lib/composition/composition-schema";
import {
	backgroundToStyle,
	focalToObjectPosition,
	GRADIENT_CLASS,
	placementToStyle,
	textSide,
} from "@/lib/composition/placement-css";
import {
	type HeroElementBanner,
	HeroProductMotion,
	type HeroProductMotionProps,
	renderHeroElement,
} from "./hero-element-renders";
import { HeroSafeStack, HeroStackProduct } from "./hero-safe-stack";

export type HeroSlideBanner = Pick<
	Banner,
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
	| "countdownTarget"
>;

// Resolução do fundo mobile por modo (desktop nunca muda):
//   none → sem imagem · custom → mobile url (fallback desktop) · inherit → desktop.
function resolveMobileBg(banner: HeroSlideBanner): string | null {
	switch (banner.backgroundMobileMode) {
		case "none":
			return null;
		case "custom":
			return banner.backgroundImageMobileUrl ?? banner.backgroundImageUrl;
		default:
			return banner.backgroundImageUrl;
	}
}

// Fundo com zoom + ponto focal (#210): o wrapper do <Image> leva o scale
// (transformOrigin = focal) e o <Image> leva object-position = focal. Quando
// URL e config coincidem nos dois viewports, um único <Image> cobre tudo.
function HeroBackground({
	banner,
	composition,
	isFirst,
}: {
	banner: HeroSlideBanner;
	composition: BannerComposition;
	isFirst: boolean;
}) {
	const desktopBg = banner.backgroundImageUrl;
	const mobileBg = resolveMobileBg(banner);
	const desktopCfg = composition.desktop.background;
	const mobileCfg = composition.mobile.background ?? desktopCfg;
	const sharedBg =
		desktopBg != null &&
		mobileBg === desktopBg &&
		composition.mobile.background === undefined;
	const fetchPriority = isFirst ? "high" : "auto";

	return (
		<div className="absolute inset-0 overflow-hidden bg-black">
			{desktopBg != null && (
				<div
					className={cn("absolute inset-0", !sharedBg && "hidden lg:block")}
					style={backgroundToStyle(desktopCfg)}
				>
					<Image
						alt={banner.altText ?? ""}
						className="object-cover"
						fetchPriority={fetchPriority}
						fill
						priority={isFirst}
						quality={75}
						sizes="100vw"
						src={desktopBg}
						style={{ objectPosition: focalToObjectPosition(desktopCfg.focal) }}
					/>
				</div>
			)}
			{!sharedBg && mobileBg != null && (
				<div
					className="absolute inset-0 lg:hidden"
					style={backgroundToStyle(mobileCfg)}
				>
					<Image
						alt={banner.altText ?? ""}
						className="object-cover"
						fetchPriority={fetchPriority}
						fill
						priority={isFirst}
						quality={75}
						sizes="100vw"
						src={mobileBg}
						style={{ objectPosition: focalToObjectPosition(mobileCfg.focal) }}
					/>
				</div>
			)}
		</div>
	);
}

// Glow vermelho — assinatura cinematográfica da loja (a composition não governa
// o glow). Pulse (repaint de blur(40px) por frame) é caro no mobile — anima só
// no desktop; no mobile fica estático.
function HeroGlow({
	isDesktop,
	reduceMotion,
}: {
	isDesktop: boolean;
	reduceMotion: boolean;
}) {
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

type HeroMotion = Omit<HeroProductMotionProps, "url">;

// Produto POSICIONADO (desktop sempre; mobile só override): caixa com dimensão
// explícita (armadilha 2) — a scale do placement multiplica por cima.
function HeroPositionedProduct({
	banner,
	placement,
	viewport,
	mobileProductRenders,
	...motion
}: HeroMotion & {
	banner: HeroSlideBanner;
	placement: ElementPlacement;
	viewport: Viewport;
	mobileProductRenders: boolean;
}) {
	const url =
		viewport === "mobile"
			? (banner.productImageMobileUrl ?? banner.productImageUrl)
			: banner.productImageUrl;
	if (url == null) {
		return null;
	}
	// Sem productImageMobileUrl, a camada mobile (posicionada OU empilhada, ver
	// hero-safe-stack.tsx) cai pro mesmo productImageUrl do desktop — as duas
	// <Image priority> duplicariam o preload do mesmo asset. Desktop só cede
	// (preload=false) quando o mobile REALMENTE vai reivindicar esse preload
	// (mobileProductRenders); produto `{hidden:true}` no mobile não reivindica
	// nada — desktop mantém priority pra não perder o LCP. Mobile é o tráfego
	// majoritário e sempre mantém priority.
	const mobileClaimsSameUrl =
		mobileProductRenders && banner.productImageMobileUrl == null;
	const preload = viewport === "mobile" || !mobileClaimsSameUrl;
	return (
		<div
			className={cn(
				"absolute z-15",
				viewport === "desktop"
					? "hidden h-[60%] w-[38%] lg:block"
					: "h-[32%] w-[70%] lg:hidden"
			)}
			style={placementToStyle(placement, viewport)}
		>
			<HeroProductMotion preload={preload} url={url} {...motion} />
		</div>
	);
}

// Alinhamento de conteúdo/texto pela COLUNA da âncora do placement (decisão do
// controller pós Tasks 4-5): l→start, c→center, r→end. Classes estáticas —
// Tailwind JIT não vê string montada.
const ALIGN_BY_COL: Record<string, "start" | "center" | "end"> = {
	l: "start",
	c: "center",
	r: "end",
};

const TEXT_ALIGN_CLASS: Record<"start" | "center" | "end", string> = {
	start: "text-left",
	center: "text-center",
	end: "text-right",
};

// Elemento de texto/CTA posicionado absoluto. `w-max` é obrigatório (armadilha
// 1): sem ele, âncora perto da borda sofre shrink-to-fit e quebra palavra a
// palavra; o maxWidth (ch) do placement segue limitando.
function HeroPositionedElement({
	elementKey,
	placement,
	viewport,
	banner,
	headingTag,
}: {
	elementKey: Exclude<ElementKey, "product">;
	placement: ElementPlacement;
	viewport: Viewport;
	banner: HeroElementBanner;
	headingTag: "h1" | "h2";
}) {
	const align = ALIGN_BY_COL[placement.anchor.charAt(1)] ?? "center";
	const content = renderHeroElement(elementKey, banner, {
		align,
		ctaFull: false,
		headingTag,
	});
	if (content === null) {
		return null;
	}
	return (
		<div
			className={cn(
				"absolute z-20 w-max",
				TEXT_ALIGN_CLASS[align],
				viewport === "desktop" ? "hidden lg:block" : "lg:hidden"
			)}
			style={placementToStyle(placement, viewport)}
		>
			{content}
		</div>
	);
}

export interface HeroSlideProps extends HeroMotion {
	banner: HeroSlideBanner;
	composition: BannerComposition;
	isDesktop: boolean;
	isH1: boolean;
}

export function HeroSlide({
	banner,
	composition,
	isDesktop,
	isH1,
	...motion
}: HeroSlideProps) {
	const partition = partitionMobileElements(composition);
	// Produto mobile só reivindica preload quando vai de fato renderizar
	// (empilhado OU posicionado) — `{hidden:true}` deixa o produto fora dos
	// dois grupos, então ninguém no mobile reivindica.
	const mobileProductRenders =
		partition.stacked.includes("product") ||
		partition.positioned.some(([key]) => key === "product");
	// Contrato §gradiente: só título/subtítulo contam (specs não). Mesma regra
	// do h1Index (hero-carousel.tsx): campo preenchido E elemento LIGADO na
	// composition — sem elemento ligado, sem gradiente (nada visível pra proteger).
	const hasText =
		(banner.title != null &&
			composition.desktop.elements.title !== undefined) ||
		(banner.subtitle != null &&
			composition.desktop.elements.subtitle !== undefined);
	const headingTag = isH1 ? "h1" : "h2";

	return (
		<div className="absolute inset-0">
			<HeroBackground
				banner={banner}
				composition={composition}
				isFirst={motion.isFirst}
			/>

			<HeroGlow isDesktop={isDesktop} reduceMotion={motion.reduceMotion} />

			{/* Gradiente de legibilidade — só quando há título/subtítulo a proteger. */}
			{hasText && (
				<div
					aria-hidden="true"
					className={cn(
						"absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent",
						GRADIENT_CLASS[textSide(composition)]
					)}
				/>
			)}

			{/* Banner "imagem pura" (sem texto) COM imagem mobile: scrim inferior
			    só-mobile pra contraste de dots/CTA. Sem bg mobile o backdrop já é preto. */}
			{!hasText && resolveMobileBg(banner) != null && (
				<div
					aria-hidden="true"
					className="absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-black/75 to-transparent lg:hidden"
				/>
			)}

			{/* Desktop: todo elemento ligado é posicionado, na ordem fixa (z estável). */}
			{SAFE_STACK_ORDER.map((key) => {
				const placement = composition.desktop.elements[key];
				if (placement === undefined) {
					return null;
				}
				if (key === "product") {
					return (
						<HeroPositionedProduct
							banner={banner}
							key={key}
							mobileProductRenders={mobileProductRenders}
							placement={placement}
							viewport="desktop"
							{...motion}
						/>
					);
				}
				return (
					<HeroPositionedElement
						banner={banner}
						elementKey={key}
						headingTag={headingTag}
						key={key}
						placement={placement}
						viewport="desktop"
					/>
				);
			})}

			{/* Mobile: overrides posicionados + produto herdado + pilha segura. */}
			{partition.positioned.map(([key, placement]) =>
				key === "product" ? (
					<HeroPositionedProduct
						banner={banner}
						key={key}
						mobileProductRenders={mobileProductRenders}
						placement={placement}
						viewport="mobile"
						{...motion}
					/>
				) : (
					<HeroPositionedElement
						banner={banner}
						elementKey={key}
						headingTag={headingTag}
						key={key}
						placement={placement}
						viewport="mobile"
					/>
				)
			)}
			{partition.stacked.includes("product") && (
				<HeroStackProduct banner={banner} {...motion} />
			)}
			<HeroSafeStack
				banner={banner}
				headingTag={headingTag}
				keys={partition.stacked}
			/>
		</div>
	);
}
