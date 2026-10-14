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

function withUnit(value: string, unit: string): string {
	return unit ? `${value} ${unit}` : value;
}

function fmtNum(n: number): string {
	return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

export function fmtSpecNumber(value: string | null, unit: string): string {
	if (value == null) {
		return "—";
	}

	const n = Number(value);

	if (!Number.isFinite(n)) {
		return "—";
	}

	return withUnit(fmtNum(n), unit);
}

export function fmtSpecRange(
	min: string | null,
	max: string | null,
	unit: string
): string {
	if (min == null) {
		return "—";
	}

	const minN = Number(min);

	if (max == null) {
		return withUnit(fmtNum(minN), unit);
	}

	const maxN = Number(max);

	if (minN === 0) {
		return withUnit(`até ${fmtNum(maxN)}`, unit);
	}

	return withUnit(`${fmtNum(minN)} – ${fmtNum(maxN)}`, unit);
}
