"use client";

// Conteúdo puro de cada elemento do hero (issue #210): decide SE renderiza
// (dado presente); ONDE renderiza é do chamador (posicionado absoluto no
// hero-slide ou pilha segura mobile). Markup/tipografia ATUAIS da loja — o
// renderer do dashboard é miniatura de card; paridade é de âncora, não de px.
// Sem margens de fluxo: espaçamento é responsabilidade do placement/pilha.
import type { Banner } from "@emach/db/schema/banner";
import { cn } from "@emach/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { type MotionValue, m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
	EmachButton,
	type emachButtonVariants,
} from "@/components/emach-button";
import type { ElementKey } from "@/lib/composition/composition-schema";
import { type CountdownParts, formatCountdown } from "@/lib/countdown";
import { resolveHeroSpecs } from "@/lib/hero-specs";

export type HeroElementBanner = Pick<
	Banner,
	| "title"
	| "subtitle"
	| "specs"
	| "badgeText"
	| "ctaLabel"
	| "ctaHref"
	| "ctaVariant"
	| "countdownTarget"
>;

interface CtaStyle {
	className?: string;
	variant: VariantProps<typeof emachButtonVariants>["variant"];
}

// Mapeia a variante do banco para a EmachButton. `white` reaproveita primary
// sobrescrevendo as cores; `ghost` = outline-light (ações sobre dark do DESIGN.md).
const CTA_VARIANT_MAP: Record<HeroElementBanner["ctaVariant"], CtaStyle> = {
	red: { variant: "primary" },
	dark: { variant: "dark", className: "border-white/25" },
	white: {
		variant: "primary",
		className: "border-transparent bg-white text-near-black hover:bg-white/90",
	},
	ghost: { variant: "outline-light" },
};

function HeroCta({
	banner,
	full,
}: {
	banner: HeroElementBanner;
	full: boolean;
}) {
	if (!(banner.ctaLabel && banner.ctaHref)) {
		return null;
	}
	const style = CTA_VARIANT_MAP[banner.ctaVariant];
	return (
		// ctaHref vem como string do banco; typedRoutes não valida em runtime.
		<Link
			className={cn("inline-flex", full && "flex w-full")}
			href={banner.ctaHref as Route}
		>
			<EmachButton
				className={style.className}
				full={full}
				icon={<ArrowRight className="size-4" />}
				size="lg"
				variant={style.variant}
			>
				{banner.ctaLabel}
			</EmachButton>
		</Link>
	);
}

// Contador regressivo do hero. Ticker por segundo com auto-hide ao expirar é
// comportamento da loja (issue #210, adendo 7) — a composition só posiciona.
// Calcula só pós-mount pra evitar mismatch de hidratação.
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
			className="font-display font-semibold text-[15px] text-white tabular-nums tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[17px]"
			role="timer"
		>
			{parts.days}d {parts.hours}h {parts.minutes}m {parts.seconds}s
		</span>
	);
}

// Ficha técnica do hero (#158): valores de banner.specs como <ul> semântico.
function HeroSpecs({ specs }: { specs: string[] | null }) {
	const values = resolveHeroSpecs(specs);
	if (values.length === 0) {
		return null;
	}
	return (
		<div className="max-w-[44ch] font-display text-[13px] text-white/90 uppercase tracking-[0.08em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[15px]">
			<span aria-hidden="true" className="text-white/55">
				Ficha técnica
			</span>
			<ul aria-label="Ficha técnica" className="inline">
				{values.map((spec) => (
					<li
						className="inline before:mx-1.5 before:text-white/40 before:content-['·']"
						key={spec}
					>
						{spec}
					</li>
				))}
			</ul>
		</div>
	);
}

// Classes estáticas (Tailwind JIT exige literal — sem interpolação de string).
const TITLE_ALIGN_CLASS: Record<"start" | "center" | "end", string> = {
	start: "items-start",
	center: "items-center",
	end: "items-end",
};

function HeroTitle({
	banner,
	headingTag,
	align,
}: {
	banner: HeroElementBanner;
	headingTag: "h1" | "h2";
	align: "start" | "center" | "end";
}) {
	if (!banner.title) {
		return null;
	}
	const HeadingTag = headingTag;
	return (
		<div className={cn("flex flex-col", TITLE_ALIGN_CLASS[align])}>
			<HeadingTag className="text-balance font-display font-medium text-[clamp(44px,6vw,84px)] text-white uppercase leading-[0.9] tracking-[-0.01em] drop-shadow-[0_3px_18px_rgba(0,0,0,0.7)]">
				{banner.title}
			</HeadingTag>
			<span aria-hidden="true" className="my-4 h-[3px] w-16 bg-emach-red" />
		</div>
	);
}

// Despacho por elemento (produto NÃO passa aqui — precisa de caixa + motion).
// Retorna null quando o dado de conteúdo está vazio: elemento ligado na
// composition mas sem dado não renderiza caixa vazia.
export function renderHeroElement(
	key: Exclude<ElementKey, "product">,
	banner: HeroElementBanner,
	opts: {
		headingTag: "h1" | "h2";
		ctaFull: boolean;
		align?: "start" | "center" | "end";
	}
): ReactNode {
	switch (key) {
		case "badge":
			return banner.badgeText ? (
				<span className="inline-block bg-white px-2.5 py-0.5 font-display font-semibold text-[11px] text-near-black uppercase tracking-[0.06em]">
					{banner.badgeText}
				</span>
			) : null;
		case "title":
			return (
				<HeroTitle
					align={opts.align ?? "start"}
					banner={banner}
					headingTag={opts.headingTag}
				/>
			);
		case "subtitle":
			return banner.subtitle ? (
				<p className="max-w-[44ch] font-sans text-[15px] text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] lg:text-[17px]">
					{banner.subtitle}
				</p>
			) : null;
		case "specs":
			return <HeroSpecs specs={banner.specs} />;
		case "countdown":
			return banner.countdownTarget ? (
				<HeroCountdown target={banner.countdownTarget} />
			) : null;
		case "cta":
			return <HeroCta banner={banner} full={opts.ctaFull} />;
		default:
			return null;
	}
}

export interface HeroProductMotionProps {
	isActive: boolean;
	isFirst: boolean;
	parallaxX: MotionValue<number>;
	parallaxY: MotionValue<number>;
	// false quando OUTRA camada já renderiza o MESMO asset com priority (ex.:
	// produto sem override mobile ecoa em desktop + pilha/posicionado mobile) —
	// evita 2 <link rel=preload> pro mesmo produto no slide ativo. Default true.
	preload?: boolean;
	reduceMotion: boolean;
	url: string;
}

type ProductImageLoadProps = Pick<
	ComponentProps<typeof Image>,
	"fetchPriority" | "loading" | "priority"
>;

// preload=false cede o preload à outra camada (mobile é o tráfego majoritário
// do ecommerce — mantém priority). loading="eager" evita virar lazy sem gerar
// o <link rel=preload> que `priority` cria.
function productImageLoadProps(
	isFirst: boolean,
	preload: boolean
): ProductImageLoadProps {
	if (preload) {
		return { priority: isFirst, fetchPriority: isFirst ? "high" : "auto" };
	}
	if (isFirst) {
		return { loading: "eager" };
	}
	return {};
}

// Miolo do produto: parallax + float + realce de slide ativo — inalterados da
// versão pré-#210. A caixa dimensionada por fora é OBRIGATÓRIA (issue #210,
// armadilha 2): o <Image fill> colapsa a 0×0 sem width/height no wrapper.
export function HeroProductMotion({
	isActive,
	isFirst,
	parallaxX,
	parallaxY,
	reduceMotion,
	url,
	preload = true,
}: HeroProductMotionProps) {
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
		<m.div
			animate={animate}
			className="relative h-full w-full"
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
					fill
					quality={85}
					sizes="(max-width: 1024px) 92vw, 42vw"
					src={url}
					{...productImageLoadProps(isFirst, preload)}
				/>
			</m.div>
		</m.div>
	);
}
