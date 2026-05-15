import { fmtBRL } from "@/lib/format";
import type { OrderBreakdown, PaymentInfo } from "../../../_lib/types";
import { SectionBlock } from "./section-block";

interface OrderTotalsProps {
	breakdown: OrderBreakdown;
	itemCount: number;
	payment: PaymentInfo;
}

function PriceRow({
	emphasis,
	label,
	value,
}: {
	emphasis?: "discount";
	label: string;
	value: string;
}) {
	const tone = emphasis === "discount" ? "text-emach-red" : "text-near-black";
	return (
		<div className="flex items-center justify-between border-border border-b border-dashed py-2 text-[13px] last:border-b-0">
			<span className={tone}>{label}</span>
			<span className={tone}>{value}</span>
		</div>
	);
}

const PAYMENT_BADGE_TEXT: Partial<Record<PaymentInfo["kind"], string>> = {
	boleto: "BOL",
	pix: "PIX",
};

function PaymentBadge({ kind }: { kind: PaymentInfo["kind"] }) {
	const text = PAYMENT_BADGE_TEXT[kind] ?? "CRD";
	return (
		<div className="flex h-7 w-7 shrink-0 items-center justify-center border border-near-black font-bold font-display text-[10px] tracking-[0.06em]">
			{text}
		</div>
	);
}

export function OrderTotals({
	breakdown,
	itemCount,
	payment,
}: OrderTotalsProps) {
	return (
		<SectionBlock title="Valores">
			<PriceRow
				label={`Subtotal (${itemCount} ${itemCount === 1 ? "item" : "itens"})`}
				value={fmtBRL(breakdown.subtotalCents)}
			/>
			<PriceRow
				label={`Frete (${breakdown.shippingMethod})`}
				value={
					breakdown.shippingCents === 0
						? "Grátis"
						: fmtBRL(breakdown.shippingCents)
				}
			/>
			{breakdown.discountCents && breakdown.discountCents > 0 ? (
				<PriceRow
					emphasis="discount"
					label={`Desconto${breakdown.discountLabel ? ` (${breakdown.discountLabel})` : ""}`}
					value={`−${fmtBRL(breakdown.discountCents)}`}
				/>
			) : null}

			<div className="mt-2 flex items-center justify-between border-near-black border-t pt-3.5">
				<span className="font-display font-semibold text-[12px] text-near-black uppercase tracking-[0.16em]">
					Total
				</span>
				<span className="font-bold text-[22px] text-near-black">
					{fmtBRL(breakdown.totalCents)}
				</span>
			</div>

			<div className="mt-3.5 flex items-center gap-2.5 border border-border-strong border-dashed bg-gray-10 px-3 py-2.5">
				<PaymentBadge kind={payment.kind} />
				<div className="text-[12px] leading-tight">
					<strong className="block text-[13px] text-near-black">
						{payment.label}
					</strong>
					{payment.detail ? (
						<span className="text-gray-60">{payment.detail}</span>
					) : null}
				</div>
			</div>
		</SectionBlock>
	);
}
