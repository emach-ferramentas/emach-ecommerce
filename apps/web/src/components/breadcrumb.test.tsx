// @vitest-environment node
import type { Route } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Breadcrumb, CATALOG_CRUMB, HOME_CRUMB } from "./breadcrumb";

const CHEVRON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right size-3.5" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';
const LINK =
	"inline-flex min-h-8 items-center text-ink-2 underline underline-offset-[3px]";
const item = (href: string, label: string) =>
	`<li class="inline-flex items-center gap-1.5"><a class="${LINK}" href="${href}">${label}</a>${CHEVRON}</li>`;

const PRODUCT_12B1379 = `<nav aria-label="Você está em" class="pt-2.5 pb-1.5 text-[13.5px] text-ink-muted md:pt-[18px] md:text-[14px]"><ol class="flex flex-wrap items-center gap-1.5">${item("/", "Início")}${item("/catalog", "Catálogo")}${item("/catalog/furadeiras", "Furadeiras")}<li class="min-w-0"><span aria-current="page" class="line-clamp-1">Furadeira X</span></li></ol></nav>`;

describe("Breadcrumb", () => {
	it("reproduz a trilha da página de produto", () => {
		const html = renderToStaticMarkup(
			<Breadcrumb
				current="Furadeira X"
				trail={[
					HOME_CRUMB,
					CATALOG_CRUMB,
					{ href: "/catalog/furadeiras" as Route, label: "Furadeiras" },
				]}
			/>
		);
		expect(html).toBe(PRODUCT_12B1379);
	});

	it("marca só a página atual com aria-current e sem link", () => {
		const html = renderToStaticMarkup(
			<Breadcrumb current="Carrinho" trail={[HOME_CRUMB]} />
		);
		expect(html.match(/aria-current="page"/g)).toHaveLength(1);
		expect(html).not.toContain(">Carrinho</a>");
		expect(html).toContain(
			'<span aria-current="page" class="line-clamp-1">Carrinho</span>'
		);
	});
});
