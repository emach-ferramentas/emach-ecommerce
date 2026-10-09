import type { Metadata } from "next";
import { CountTabs } from "@/app/dashboard/_components/count-tabs";
import { PageHead } from "@/components/page-head";
import { listClientOrders } from "@/lib/orders/queries";
import {
	countByTab,
	ORDER_TAB_LABEL,
	ORDER_TABS,
	type OrderTab,
	statusToTab,
} from "@/lib/orders/status";
import { requireCurrentClient } from "@/lib/session";
import { OrderCard } from "./_components/order-card";
import { OrdersEmptyState } from "./_components/orders-empty-state";

export const metadata: Metadata = {
	title: "Meus pedidos",
};

export default async function PedidosPage() {
	const session = await requireCurrentClient();
	const orders = await listClientOrders(session.user.id);
	const counts = countByTab(orders.map((o) => o.status));
	const tabs = ORDER_TABS.map((tab) => ({
		value: tab,
		label: ORDER_TAB_LABEL[tab],
		count: counts[tab],
	}));

	function ordersIn(tab: OrderTab) {
		const list =
			tab === "all"
				? orders
				: orders.filter((o) => statusToTab(o.status) === tab);
		if (list.length === 0) {
			return <OrdersEmptyState statusLabel={ORDER_TAB_LABEL[tab]} />;
		}
		return (
			<div className="space-y-4">
				{list.map((o) => (
					<OrderCard key={o.id} order={o} />
				))}
			</div>
		);
	}

	return (
		<>
			<PageHead title="Pedidos" />
			<CountTabs defaultValue="all" tabs={tabs}>
				{ordersIn}
			</CountTabs>
		</>
	);
}
