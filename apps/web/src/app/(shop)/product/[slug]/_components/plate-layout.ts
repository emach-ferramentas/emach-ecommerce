/** Célula de spec na zona da âncora (desktop com mídia). */
export interface PlateAnchorCell {
	colSpan: 1 | 2;
	rowSpan: 1 | 2;
	specIndex: number;
}

export interface PlateLayout {
	/** Zona das linhas 1–2, com a mídia 2×2 à direita. Null sem mídia ou cols=2. */
	anchor: { cells: PlateAnchorCell[] } | null;
	/** Linhas completas (tamanho === cols) de índices de spec. */
	fullRows: number[][];
	/** Sobra final (1..cols-1 índices) — renderiza como linha de colunas iguais. */
	leftoverRow: number[];
}

const ANCHOR_SLOTS = 4;

/** Spans de crescimento pros slots ao lado da mídia (2 colunas × 2 linhas). */
function anchorCells(k: number): PlateAnchorCell[] {
	switch (k) {
		case 0:
			return [];
		case 1:
			return [{ specIndex: 0, colSpan: 2, rowSpan: 2 }];
		case 2:
			return [
				{ specIndex: 0, colSpan: 2, rowSpan: 1 },
				{ specIndex: 1, colSpan: 2, rowSpan: 1 },
			];
		case 3:
			return [
				{ specIndex: 0, colSpan: 2, rowSpan: 1 },
				{ specIndex: 1, colSpan: 1, rowSpan: 1 },
				{ specIndex: 2, colSpan: 1, rowSpan: 1 },
			];
		default:
			return [0, 1, 2, 3].map((specIndex) => ({
				specIndex,
				colSpan: 1,
				rowSpan: 1,
			}));
	}
}

/**
 * Layout da placa técnica (spec §3.4). `cols` = colunas base do grid
 * (4 desktop, 2 mobile). No mobile a mídia vira bloco full-width fora do
 * grid, então `hasMedia` só produz âncora quando cols === 4.
 */
export function buildPlateLayout(
	specCount: number,
	hasMedia: boolean,
	cols: 2 | 4
): PlateLayout {
	const indices = Array.from({ length: specCount }, (_, i) => i);
	const withAnchor = hasMedia && cols === 4;

	let anchor: PlateLayout["anchor"] = null;
	let rest = indices;

	if (withAnchor) {
		const k = Math.min(specCount, ANCHOR_SLOTS);
		anchor = { cells: anchorCells(k) };
		rest = indices.slice(k);
	}

	const fullRowCount = Math.floor(rest.length / cols);
	const fullRows: number[][] = [];
	for (let i = 0; i < fullRowCount; i++) {
		fullRows.push(rest.slice(i * cols, (i + 1) * cols));
	}
	const leftoverRow = rest.slice(fullRowCount * cols);

	return { anchor, fullRows, leftoverRow };
}
