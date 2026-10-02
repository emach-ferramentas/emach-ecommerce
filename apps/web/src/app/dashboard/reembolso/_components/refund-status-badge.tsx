import type { RefundStatus } from "@emach/db/schema/orders";
import {
	Ban,
	Check,
	CircleCheck,
	Clock,
	type LucideIcon,
	Search,
} from "lucide-react";
import { type ChipTone, StatusChip } from "@/components/status-chip";
import { REFUND_STATUS_BADGE } from "@/lib/refunds/status";

const STATUS_CHIP: Record<RefundStatus, { tone: ChipTone; icon: LucideIcon }> =
	{
		requested: { tone: "neutral", icon: Clock },
		under_review: { tone: "neutral", icon: Search },
		approved: { tone: "neutral", icon: Check },
		refunded: { tone: "ok", icon: CircleCheck },
		rejected: { tone: "off", icon: Ban },
	};

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
	const { tone, icon } = STATUS_CHIP[status];
	return (
		<StatusChip icon={icon} tone={tone}>
			{REFUND_STATUS_BADGE[status].label}
		</StatusChip>
	);
}
