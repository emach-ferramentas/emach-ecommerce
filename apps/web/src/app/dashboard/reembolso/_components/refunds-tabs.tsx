"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@emach/ui/components/tabs";
import type { RefundListItem } from "@/lib/refunds/queries";
import {
	countRefundsByTab,
	REFUND_TAB_LABEL,
	REFUND_TABS,
	type RefundTab,
	statusToRefundTab,
} from "@/lib/refunds/status";
import { RefundCard } from "./refund-card";
import { RefundsEmptyState } from "./refunds-empty-state";

export function RefundsTabs({ refunds }: { refunds: RefundListItem[] }) {
	const counts = countRefundsByTab(refunds.map((r) => r.status));

	return (
		<Tabs defaultValue="em_andamento">
			<TabsList variant="line">
				{REFUND_TABS.map((tab) => (
					<TabsTrigger
						className="h-auto min-h-11 flex-1 border-none px-0 py-3.5 font-semibold text-[13px]/[14px] data-active:text-near-black"
						key={tab}
						value={tab}
					>
						<span>{REFUND_TAB_LABEL[tab]}</span>
						<span className="ml-1.5 font-normal text-gray-60">
							{counts[tab]}
						</span>
					</TabsTrigger>
				))}
			</TabsList>

			{REFUND_TABS.map((tab) => (
				<TabsContent className="mt-6" key={tab} value={tab}>
					<RefundsList refunds={refunds} tab={tab} />
				</TabsContent>
			))}
		</Tabs>
	);
}

function RefundsList({
	refunds,
	tab,
}: {
	refunds: RefundListItem[];
	tab: RefundTab;
}) {
	const filtered = refunds.filter((r) => statusToRefundTab(r.status) === tab);
	if (filtered.length === 0) {
		return <RefundsEmptyState tabLabel={REFUND_TAB_LABEL[tab]} />;
	}
	return (
		<div>
			{filtered.map((refund) => (
				<RefundCard key={refund.id} refund={refund} />
			))}
		</div>
	);
}
