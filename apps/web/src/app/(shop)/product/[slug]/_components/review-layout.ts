export type ReviewLayoutMode = "single" | "duo" | "grid";

// Modo da placa de avaliações por total de reviews aprovadas. O caso 0 nunca
// chega aqui — é o empty state da section (faixa escura, intocada).
export function reviewLayoutMode(total: number): ReviewLayoutMode {
	if (total <= 1) {
		return "single";
	}
	if (total <= 3) {
		return "duo";
	}
	return "grid";
}

// Primeira célula da última linha visual de um grid 2-col — zera a border
// inferior dessa linha. Com sobra ímpar, a própria célula esticada é a linha.
export function lastRowStart(count: number): number {
	return count % 2 === 0 ? count - 2 : count - 1;
}

// Sobra ímpar no fim do grid 2-col estica full-width (col-span-2) — mesma
// regra de sobras da placa técnica (plate-layout.ts); mata a célula fantasma.
export function stretchLast(count: number): boolean {
	return count % 2 === 1;
}
