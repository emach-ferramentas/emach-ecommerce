// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	type HeroElementBanner,
	renderHeroElement,
} from "./hero-element-renders";

const BASE =
	"cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[2px] border font-sans font-semibold tracking-[0.04em] transition-all duration-180 focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2 active:translate-y-px active:brightness-90 active:duration-75 disabled:pointer-events-none disabled:opacity-60 aria-busy:pointer-events-none motion-reduce:active:translate-y-0";
const BASE_TRANSPARENT = BASE.replace("border ", "border border-transparent ");
const LG = "h-13 px-[30px] text-sm";

const FROZEN: Record<
	`${HeroElementBanner["ctaVariant"]}-${"inline" | "full"}`,
	string
> = {
	"red-inline": `inline-flex ${BASE_TRANSPARENT} bg-emach-red text-white hover:bg-emach-red-hover ${LG}`,
	"red-full": `${BASE_TRANSPARENT} bg-emach-red text-white hover:bg-emach-red-hover ${LG} w-full flex`,
	"dark-inline": `inline-flex ${BASE} bg-near-black text-white hover:bg-black ${LG} border-white/25`,
	"dark-full": `${BASE} bg-near-black text-white hover:bg-black ${LG} w-full border-white/25 flex`,
	"white-inline": `inline-flex ${BASE} ${LG} border-transparent bg-white text-near-black hover:bg-white/90`,
	"white-full": `${BASE} ${LG} w-full border-transparent bg-white text-near-black hover:bg-white/90 flex`,
	"ghost-inline": `inline-flex ${BASE} border-white/70 bg-transparent text-white hover:border-white hover:bg-white hover:text-near-black ${LG}`,
	"ghost-full": `${BASE} border-white/70 bg-transparent text-white hover:border-white hover:bg-white hover:text-near-black ${LG} w-full flex`,
};

const ANCHOR =
	/^<a class="([^"]*)" href="([^"]*)"><svg [^>]*lucide-arrow-right/;

function renderCta(
	ctaVariant: HeroElementBanner["ctaVariant"],
	ctaFull: boolean
): RegExpMatchArray | null {
	const html = renderToStaticMarkup(
		renderHeroElement(
			"cta",
			{
				badgeText: null,
				countdownTarget: null,
				ctaHref: "/catalog",
				ctaLabel: "Ver ofertas",
				ctaVariant,
				specs: null,
				subtitle: null,
				title: null,
			},
			{ ctaFull, headingTag: "h2" }
		)
	);
	return html.match(ANCHOR);
}

describe("CTA do hero congelado", () => {
	for (const ctaVariant of ["red", "dark", "white", "ghost"] as const) {
		for (const layout of ["inline", "full"] as const) {
			it(`${ctaVariant} ${layout} mantém as classes de 12b1379`, () => {
				const match = renderCta(ctaVariant, layout === "full");
				expect(match?.[1]).toBe(FROZEN[`${ctaVariant}-${layout}`]);
				expect(match?.[2]).toBe("/catalog");
			});
		}
	}
});
