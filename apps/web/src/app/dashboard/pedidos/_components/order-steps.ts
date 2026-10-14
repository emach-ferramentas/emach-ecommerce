import type { OrderStatus } from "@emach/db/schema/orders";
import { CreditCard, Home, Package, Truck } from "lucide-react";
import type { StepperStep } from "@/app/dashboard/_components/status-stepper";
import {
	orderStepDisplayState,
	STEPPER_PHASES,
	type StepperPhase,
} from "@/lib/orders/status";

const PHASE_META: Record<
	StepperPhase,
	{ Icon: StepperStep["Icon"]; label: string }
> = {
	paid: { Icon: CreditCard, label: "Pagamento" },
	preparing: { Icon: Package, label: "Preparação" },
	shipped: { Icon: Truck, label: "A caminho" },
	delivered: { Icon: Home, label: "Entregue" },
};

export function buildOrderSteps(status: OrderStatus): StepperStep[] {
	return STEPPER_PHASES.map((phase) => {
		// `orderStepDisplayState` delega a `stepStateFor`, que devolve "current"
		// para delivered/delivered. Na conta, pedido entregue mostra a fase final
		// em verde ("ok"), não vermelho.
		const state =
			status === "delivered" && phase === "delivered"
				? "ok"
				: orderStepDisplayState(status, phase);

		return {
			key: phase,
			label: PHASE_META[phase].label,
			Icon: PHASE_META[phase].Icon,
			state,
		};
	});
}
