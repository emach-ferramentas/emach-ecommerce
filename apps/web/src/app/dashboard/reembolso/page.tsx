import type { Metadata } from "next";
import { CountTabs } from "@/app/dashboard/_components/count-tabs";
import { PageHead } from "@/components/page-head";
import { listClientRefunds } from "@/lib/refunds/queries";
import {
	countRefundsByTab,
	REFUND_TAB_LABEL,
	REFUND_TABS,
	type RefundTab,
	statusToRefundTab,
} from "@/lib/refunds/status";
import { requireCurrentClient } from "@/lib/session";
import { RefundCard } from "./_components/refund-card";
import { RefundsEmptyState } from "./_components/refunds-empty-state";

export const metadata: Metadata = {
	title: "Devoluções e reembolso",
};

export default async function ReembolsoPage() {
	const session = await requireCurrentClient();
	const refunds = await listClientRefunds(session.user.id);
	const counts = countRefundsByTab(refunds.map((r) => r.status));
	const tabs = REFUND_TABS.map((tab) => ({
		value: tab,
		label: REFUND_TAB_LABEL[tab],
		count: counts[tab],
	}));

	function refundsIn(tab: RefundTab) {
		const list = refunds.filter((r) => statusToRefundTab(r.status) === tab);
		if (list.length === 0) {
			return <RefundsEmptyState tabLabel={REFUND_TAB_LABEL[tab]} />;
		}
		return (
			<div className="space-y-4">
				{list.map((refund) => (
					<RefundCard key={refund.id} refund={refund} />
				))}
			</div>
		);
	}

	return (
		<>
			<PageHead title="Devoluções e reembolso" />
			<CountTabs defaultValue="em_andamento" tabs={tabs}>
				{refundsIn}
			</CountTabs>
		</>
	);
}
