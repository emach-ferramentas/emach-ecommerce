import type { OrderStatus } from "@emach/db/schema/orders";
import {
	Ban,
	CircleAlert,
	CircleCheck,
	Clock,
	CreditCard,
	type LucideIcon,
	Package,
	RotateCcw,
	Truck,
	Undo2,
} from "lucide-react";
import { type ChipTone, StatusChip } from "@/components/status-chip";
import { ORDER_STATUS_BADGE } from "@/lib/orders/status";

const STATUS_CHIP: Record<
	OrderStatus,
	{ tone: ChipTone; icon: LucideIcon; struck?: boolean }
> = {
	pending_payment: { tone: "neutral", icon: Clock },
	payment_failed: { tone: "alert", icon: CircleAlert },
	paid: { tone: "ok", icon: CreditCard },
	preparing: { tone: "neutral", icon: Package },
	shipped: { tone: "neutral", icon: Truck },
	delivered: { tone: "ok", icon: CircleCheck },
	canceled: { tone: "off", icon: Ban, struck: true },
	refunded: { tone: "off", icon: RotateCcw },
	returned: { tone: "off", icon: Undo2 },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
	const { tone, icon, struck } = STATUS_CHIP[status];
	return (
		<StatusChip icon={icon} struck={struck} tone={tone}>
			{ORDER_STATUS_BADGE[status].label}
		</StatusChip>
	);
}
