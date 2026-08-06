"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@emach/ui/components/tabs";
import type { OrderListItem } from "@/lib/orders/queries";
import {
	countByTab,
	ORDER_TAB_LABEL,
	ORDER_TABS,
	type OrderTab,
	statusToTab,
} from "@/lib/orders/status";
import { OrderCard } from "./order-card";
import { OrdersEmptyState } from "./orders-empty-state";

function filterByTab(orders: OrderListItem[], tab: OrderTab): OrderListItem[] {
	if (tab === "all") {
		return orders;
	}
	return orders.filter((o) => statusToTab(o.status) === tab);
}

export function OrdersTabs({ orders }: { orders: OrderListItem[] }) {
	const counts = countByTab(orders.map((o) => o.status));

	return (
		<Tabs defaultValue="all">
			<TabsList variant="line">
				{ORDER_TABS.map((tab) => (
					<TabsTrigger
						className="h-auto min-h-11 flex-1 border-none px-0 py-3.5 font-semibold text-[13px]/[14px] data-active:text-near-black"
						key={tab}
						value={tab}
					>
						<span>{ORDER_TAB_LABEL[tab]}</span>
						<span className="ml-1.5 font-normal text-gray-60">
							{counts[tab]}
						</span>
					</TabsTrigger>
				))}
			</TabsList>

			{ORDER_TABS.map((tab) => {
				const list = filterByTab(orders, tab);
				return (
					<TabsContent className="mt-6" key={tab} value={tab}>
						{list.length === 0 ? (
							<OrdersEmptyState statusLabel={ORDER_TAB_LABEL[tab]} />
						) : (
							<div>
								{list.map((o) => (
									<OrderCard key={o.id} order={o} />
								))}
							</div>
						)}
					</TabsContent>
				);
			})}
		</Tabs>
	);
}
