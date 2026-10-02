import { Panel, SummaryRow } from "@/components/panel";
import { fmtNumericBRL } from "@/lib/format";

interface OrderTotalsProps {
	couponApplied?: boolean;
	discountAmount: string;
	itemCount: number;
	paymentMethod: string | null;
	shippingAmount: string;
	shippingMethod: string | null;
	subtotalAmount: string;
	totalAmount: string;
}

const PAYMENT_LABEL: Record<string, string> = {
	pix: "Pix",
	boleto: "Boleto bancário",
	credit_card: "Cartão de crédito",
};

export function OrderTotals({
	couponApplied,
	discountAmount,
	itemCount,
	paymentMethod,
	shippingAmount,
	shippingMethod,
	subtotalAmount,
	totalAmount,
}: OrderTotalsProps) {
	const hasDiscount = Number(discountAmount) > 0;
	const shippingFree = Number(shippingAmount) === 0;
	return (
		<Panel title="Valores">
			<SummaryRow
				label={`Subtotal (${itemCount} ${itemCount === 1 ? "item" : "itens"})`}
			>
				{fmtNumericBRL(subtotalAmount)}
			</SummaryRow>
			<SummaryRow
				label={`Frete${shippingMethod ? ` (${shippingMethod})` : ""}`}
				tone={shippingFree ? "discount" : undefined}
			>
				{shippingFree ? "Grátis" : fmtNumericBRL(shippingAmount)}
			</SummaryRow>
			{hasDiscount ? (
				<SummaryRow
					label={couponApplied ? "Desconto (cupom)" : "Desconto"}
					tone="discount"
				>
					−{fmtNumericBRL(discountAmount)}
				</SummaryRow>
			) : null}
			<SummaryRow label="Total" total>
				{fmtNumericBRL(totalAmount)}
			</SummaryRow>
			{paymentMethod ? (
				<p className="mt-3 text-[14px] text-ink-2">
					Pagamento:{" "}
					<span className="font-semibold text-ink">
						{PAYMENT_LABEL[paymentMethod] ?? paymentMethod}
					</span>
				</p>
			) : null}
		</Panel>
	);
}
