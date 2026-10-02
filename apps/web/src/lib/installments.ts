import { fmtBRL } from "@/lib/format";

/** Parcela mínima de R$ 10 no cartão, até 12x sem juros. */
export const MIN_INSTALLMENT_CENTS = 1000;
export const MAX_INSTALLMENTS = 12;

export interface InstallmentPlan {
	count: number;
	valueCents: number;
}

/** Plano de parcelas de um valor; `null` quando só cabe à vista (menos de 2x). */
export function installmentPlan(totalCents: number): InstallmentPlan | null {
	const count = Math.min(
		MAX_INSTALLMENTS,
		Math.floor(totalCents / MIN_INSTALLMENT_CENTS)
	);
	if (count < 2) {
		return null;
	}
	return { count, valueCents: Math.round(totalCents / count) };
}

/** "12x de R$ 44,68", "em até 5x de R$ 11,86" ou `null` (só à vista). */
export function installmentLabel(totalCents: number): string | null {
	const plan = installmentPlan(totalCents);
	if (!plan) {
		return null;
	}
	const prefix =
		plan.count === MAX_INSTALLMENTS
			? `${plan.count}x`
			: `em até ${plan.count}x`;
	return `${prefix} de ${fmtBRL(plan.valueCents)}`;
}

/** Linha curta do card: "12x de R$ 44,68 sem juros" ou "À vista". */
export function installmentText(totalCents: number): string {
	const label = installmentLabel(totalCents);
	return label ? `${label} sem juros` : "À vista";
}
