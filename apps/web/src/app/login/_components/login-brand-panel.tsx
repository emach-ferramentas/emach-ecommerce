"use client";

import {
	AnimatePresence,
	domAnimation,
	LazyMotion,
	m,
	type TargetAndTransition,
	type Transition,
	useReducedMotion,
} from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { AuthHomeLogo } from "./auth-home-logo";

const PRODUCTS = [
	"/images/hero-imagens/emach_hero_01_product.png",
	"/images/hero-imagens/emach_hero_02_product.png",
	"/images/hero-imagens/emach_hero_03_product.png",
] as const;

const CAROUSEL_MS = 3800;

function FloatingTool({
	float,
	reduceMotion,
	sizes,
	slotClassName,
	src,
	transition,
}: {
	float: TargetAndTransition | undefined;
	reduceMotion: boolean;
	sizes: string;
	slotClassName: string;
	src: string;
	transition: Transition | undefined;
}) {
	return (
		<m.div
			animate={float}
			aria-hidden="true"
			className={slotClassName}
			transition={transition}
		>
			<AnimatePresence initial={false}>
				<m.div
					animate={{ opacity: 1, scale: 1 }}
					className="absolute inset-0"
					exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
					initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.08 }}
					key={src}
					transition={{
						duration: reduceMotion ? 0 : 0.8,
						ease: [0.16, 1, 0.3, 1],
					}}
				>
					<Image
						alt=""
						className="object-contain"
						fill
						sizes={sizes}
						src={src}
					/>
				</m.div>
			</AnimatePresence>
		</m.div>
	);
}

export function LoginBrandPanel() {
	const isDesktop = useIsDesktop();
	const reduceMotion = useReducedMotion() ?? false;
	const [toolIndex, setToolIndex] = useState(0);

	useEffect(() => {
		if (!isDesktop || reduceMotion) {
			return;
		}
		const id = setInterval(() => {
			setToolIndex((i) => (i + 1) % PRODUCTS.length);
		}, CAROUSEL_MS);
		return () => clearInterval(id);
	}, [isDesktop, reduceMotion]);

	const floatTransition = (duration: number, delay: number) =>
		reduceMotion
			? undefined
			: ({
					duration,
					delay,
					repeat: Number.POSITIVE_INFINITY,
					ease: "easeInOut",
				} as const);
	const heroFloat = reduceMotion ? undefined : { y: [0, -16, 0] };
	const satelliteFloat = reduceMotion ? undefined : { y: [0, -11, 0] };
	const glowAnimate = reduceMotion
		? undefined
		: { scale: [1, 1.12, 1], opacity: [0.55, 0.9, 0.55] };
	const glowTransition = reduceMotion
		? undefined
		: ({
				duration: 4,
				repeat: Number.POSITIVE_INFINITY,
				ease: "easeInOut",
			} as const);

	return (
		<LazyMotion features={domAnimation} strict>
			<div className="relative isolate hidden flex-col justify-between overflow-hidden bg-near-black px-20 py-20 text-white lg:flex">
				{isDesktop && (
					<>
						{/* Background image */}
						<Image
							alt=""
							aria-hidden="true"
							className="z-0 object-cover"
							fill
							priority
							sizes="60vw"
							src="/emach-login-bg.png"
						/>
						{/* Legibility vignette over the photo */}
						<div
							aria-hidden="true"
							className="emach-bg-login-vignette pointer-events-none absolute inset-0 z-1"
						/>

						{/* Pulsing red glow behind the hero tool */}
						<m.div
							animate={glowAnimate}
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 left-1/2 z-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
							style={{
								width: "clamp(320px, 38vw, 620px)",
								height: "clamp(320px, 38vw, 620px)",
								background:
									"radial-gradient(circle, rgb(from var(--emach-red) r g b / 0.28) 0%, rgb(from var(--emach-red) r g b / 0.08) 42%, transparent 70%)",
								filter: "blur(48px)",
							}}
							transition={glowTransition}
						/>

						{/* Satellite — upper-left, behind (carrossel) */}
						<FloatingTool
							float={satelliteFloat}
							reduceMotion={reduceMotion}
							sizes="22vw"
							slotClassName="pointer-events-none absolute top-[12%] left-[4%] z-5 h-[26%] w-[36%] -rotate-12 opacity-55 blur-[2px] brightness-75 drop-shadow-[0_30px_25px_rgba(0,0,0,0.6)]"
							src={PRODUCTS[(toolIndex + 1) % PRODUCTS.length]}
							transition={floatTransition(7, 0.6)}
						/>

						{/* Satellite — upper-right, behind (carrossel) */}
						<FloatingTool
							float={satelliteFloat}
							reduceMotion={reduceMotion}
							sizes="22vw"
							slotClassName="pointer-events-none absolute top-[16%] right-[2%] z-5 h-[24%] w-[34%] rotate-14 opacity-50 blur-[2px] brightness-75 drop-shadow-[0_30px_25px_rgba(0,0,0,0.6)]"
							src={PRODUCTS[(toolIndex + 2) % PRODUCTS.length]}
							transition={floatTransition(5.5, 1.1)}
						/>

						{/* Hero — centered, in front (carrossel, maior) */}
						<FloatingTool
							float={heroFloat}
							reduceMotion={reduceMotion}
							sizes="46vw"
							slotClassName="pointer-events-none absolute top-[30%] left-1/2 z-10 h-[50%] w-[76%] -translate-x-1/2 -rotate-3 drop-shadow-[0_60px_40px_rgba(0,0,0,0.6)]"
							src={PRODUCTS[toolIndex]}
							transition={floatTransition(6, 0)}
						/>
					</>
				)}

				{/* Logo — top-left (sempre renderizado: SVG leve) */}
				<AuthHomeLogo className="relative z-20 h-10 self-start" tone="white" />

				{/* Impact phrase — bottom-left */}
				<div className="relative z-20">
					<h2 className="font-display font-semibold text-[clamp(34px,3.6vw,52px)] uppercase leading-[0.92] tracking-[-0.01em]">
						Ferramenta certa.
						<br />
						Trabalho <span className="text-emach-red">certo</span>.
					</h2>
					<span className="mt-4 block font-display font-semibold text-[11px] text-white/45 uppercase tracking-[0.2em]">
						EMACH Profissional
					</span>
				</div>
			</div>
		</LazyMotion>
	);
}
