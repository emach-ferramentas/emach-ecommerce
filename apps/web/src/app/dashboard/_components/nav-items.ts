import type { Route } from "next";

export interface NavItem {
	exact?: boolean;
	href: Route;
	label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
	{ label: "Início", href: "/dashboard", exact: true },
	{ label: "Pedidos", href: "/dashboard/pedidos" },
	{ label: "Reembolso e devoluções", href: "/dashboard/reembolso" },
	{ label: "Meus dados", href: "/dashboard/dados-pessoais" },
];

export function isAccountNavActive(
	pathname: string,
	{ href, exact }: NavItem
): boolean {
	if (pathname === href) {
		return true;
	}
	return !exact && pathname.startsWith(`${href}/`);
}
