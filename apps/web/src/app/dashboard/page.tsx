import { Clock, Package, RotateCcw, UserRound } from "lucide-react";
import { HOME_CRUMB } from "@/components/breadcrumb";
import { PageHead } from "@/components/page-head";
import { StatusChip } from "@/components/status-chip";
import { listClientOrders } from "@/lib/orders/queries";
import { requireCurrentClient } from "@/lib/session";
import { QuickActionCard } from "./_components/quick-action-card";
import { OrderCard } from "./pedidos/_components/order-card";

const BLOCK_TITLE_CLASS = "mb-3 font-extrabold text-[17px] text-ink";

export default async function DashboardPage() {
	const session = await requireCurrentClient();
	const orders = await listClientOrders(session.user.id);
	const toPay = orders.filter(
		(o) => o.status === "pending_payment" || o.status === "payment_failed"
	);
	const highlight = toPay[0] ?? orders[0] ?? null;

	return (
		<>
			<PageHead title="Minha conta" trail={[HOME_CRUMB]}>
				Acompanhe seus pedidos, devoluções e dados de cadastro num só lugar.
			</PageHead>
			<div className="space-y-10">
				{highlight ? (
					<section>
						<h2 className={BLOCK_TITLE_CLASS}>
							{toPay.length > 0
								? "Precisa da sua atenção"
								: "Seu último pedido"}
						</h2>
						<OrderCard order={highlight} />
					</section>
				) : null}

				<section>
					<h2 className={BLOCK_TITLE_CLASS}>Sua conta</h2>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<QuickActionCard
							description="Acompanhe e pague seus pedidos."
							flag={
								toPay.length > 0 ? (
									<StatusChip icon={Clock} tone="neutral">
										{toPay.length} a pagar
									</StatusChip>
								) : null
							}
							href="/dashboard/pedidos"
							Icon={Package}
							title="Pedidos"
						/>
						<QuickActionCard
							description="Solicite e acompanhe reembolsos."
							href="/dashboard/reembolso"
							Icon={RotateCcw}
							title="Devoluções"
						/>
						<QuickActionCard
							description="Endereços e dados de cadastro."
							href="/dashboard/dados-pessoais"
							Icon={UserRound}
							title="Meus dados"
						/>
					</div>
				</section>
			</div>
		</>
	);
}
