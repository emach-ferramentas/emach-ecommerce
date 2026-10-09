// @vitest-environment node
import type { Route } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DeptNav } from "@/components/dept-nav";
import type { StoreNav } from "@/lib/store-nav";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const NAV: StoreNav = {
	services: [
		{
			href: "/catalog/reboco-e-acabamento" as Route,
			imageSrc: null,
			name: "Reboco e acabamento",
			productCount: 4,
			slug: "reboco-e-acabamento",
		},
		{
			href: "/catalog/demolicao" as Route,
			imageSrc: null,
			name: "Demolição",
			productCount: 2,
			slug: "demolicao",
		},
	],
	categories: [
		{
			href: "/catalog/acessorios" as Route,
			name: "Acessórios",
			productCount: 4,
			slug: "acessorios",
		},
	],
};

const CURRENT_LINK = /<a[^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g;

function currentLinks(at: string): string[] {
	pathname.current = at;
	const html = renderToStaticMarkup(<DeptNav nav={NAV} />);
	return [...html.matchAll(CURRENT_LINK)].map((m) => m[1] ?? "");
}

describe("DeptNav", () => {
	it("marca como ativo só o departamento da página aberta", () => {
		expect(currentLinks("/catalog/demolicao")).toEqual(["Demolição"]);
		expect(currentLinks("/catalog/acessorios")).toEqual(["Acessórios"]);
	});

	it("não marca nada fora de um departamento", () => {
		expect(currentLinks("/")).toEqual([]);
		expect(currentLinks("/product/lixadeira")).toEqual([]);
	});
});
