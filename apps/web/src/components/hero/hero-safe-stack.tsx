"use client";

// Pilha segura mobile (issue #210, F3): elementos SEM override mobile empilham
// do terço inferior do 9:16 na ordem fixa recebida (SAFE_STACK_ORDER via
// partitionMobileElements) — texto à esquerda, ancorado 1:1 com o bloco de
// conteúdo incumbente (bottom-[22%], hero-carousel.tsx HeroContentBlock; o
// 16% de uma revisão anterior era aproximação do preview do dashboard, não a
// fonte de verdade). O CTA sai do fluxo da pilha e ocupa a faixa própria do
// incumbente (bottom-[9%]) — entre 22% e 9% ficam livres os dots/pause do
// carrossel (bottom-28 ≈ 17,9%), evitando colisão. O produto herdado tem box
// central própria FORA do fluxo da pilha (comportamento hardcoded atual
// formalizado). Itens da pilha NÃO aplicam scale (adendo 4).
import type { Banner } from "@emach/db/schema/banner";
import type { ElementKey } from "@/lib/composition/composition-schema";
import {
	type HeroElementBanner,
	HeroProductMotion,
	type HeroProductMotionProps,
	renderHeroElement,
} from "./hero-element-renders";

export function HeroSafeStack({
	banner,
	keys,
	headingTag,
}: {
	banner: HeroElementBanner;
	keys: ElementKey[];
	headingTag: "h1" | "h2";
}) {
	const textItems = keys.filter(
		(k): k is Exclude<ElementKey, "product" | "cta"> =>
			k !== "product" && k !== "cta"
	);
	// CTA sai do fluxo da pilha de texto: faixa própria em bottom-[9%] (1:1 com
	// o incumbente), não empilhado atrás do texto que termina em bottom-[22%].
	const cta = keys.includes("cta")
		? renderHeroElement("cta", banner, {
				align: "start",
				ctaFull: true,
				headingTag,
			})
		: null;
	if (textItems.length === 0 && cta === null) {
		return null;
	}
	return (
		<>
			{textItems.length > 0 && (
				<div className="absolute inset-x-[5%] bottom-[22%] z-20 flex flex-col items-start gap-3 text-left lg:hidden">
					{textItems.map((key) => {
						// Pilha é sempre texto à esquerda — comportamento mobile
						// atual da loja, não a composition do banner (que só
						// regula anchor/scale desktop).
						const content = renderHeroElement(key, banner, {
							align: "start",
							ctaFull: false,
							headingTag,
						});
						if (content === null) {
							return null;
						}
						return <div key={key}>{content}</div>;
					})}
				</div>
			)}
			{cta !== null && (
				<div className="absolute right-[5%] bottom-[9%] left-[5%] z-20 lg:hidden">
					{cta}
				</div>
			)}
		</>
	);
}

export function HeroStackProduct({
	banner,
	...motion
}: Omit<HeroProductMotionProps, "url"> & {
	banner: Pick<Banner, "productImageUrl" | "productImageMobileUrl">;
}) {
	const url = banner.productImageMobileUrl ?? banner.productImageUrl;
	if (url == null) {
		return null;
	}
	// Box absoluto 1:1 com o incumbente mobile (hero-carousel.tsx HeroProduct):
	// paridade de posição é o critério de aceite, não a aproximação 38/82 do
	// preview do dashboard (gap conhecido, ver disclaimer). Sem escala.
	return (
		<div className="absolute top-[46%] left-1/2 z-15 h-[52%] w-[92%] -translate-x-1/2 -translate-y-1/2 lg:hidden">
			<HeroProductMotion url={url} {...motion} />
		</div>
	);
}
