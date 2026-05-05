export function fmtBRL(cents: number): string {
	return (cents / 100).toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}

export function numericToCents(amount: string): number {
	return Math.round(Number(amount) * 100);
}

export function fmtNumericBRL(amount: string | null | undefined): string {
	if (amount == null) {
		return "";
	}
	return Number(amount).toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}
