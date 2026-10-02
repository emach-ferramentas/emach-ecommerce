import { type Crumb, HOME_CRUMB } from "@/components/breadcrumb";

export const ACCOUNT_TRAIL: readonly Crumb[] = [
	HOME_CRUMB,
	{ href: "/dashboard", label: "Minha conta" },
];

export const ORDERS_CRUMB: Crumb = {
	href: "/dashboard/pedidos",
	label: "Pedidos",
};
