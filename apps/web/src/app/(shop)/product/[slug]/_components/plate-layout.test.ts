import { describe, expect, it } from "vitest";

import { buildPlateLayout } from "./plate-layout";

describe("buildPlateLayout", () => {
	it("N=0: placa vazia (a seção decide não renderizar)", () => {
		expect(buildPlateLayout(0, false, 4)).toEqual({
			anchor: null,
			fullRows: [],
			leftoverRow: [],
		});
	});

	it("N=0 com mídia: âncora vazia ({ cells: [] }) — nunca consumida, a seção desvia em n === 0", () => {
		expect(buildPlateLayout(0, true, 4)).toEqual({
			anchor: { cells: [] },
			fullRows: [],
			leftoverRow: [],
		});
	});

	it("N=2 sem mídia: sobra vira linha de metades", () => {
		expect(buildPlateLayout(2, false, 4)).toEqual({
			anchor: null,
			fullRows: [],
			leftoverRow: [0, 1],
		});
	});

	it("N=4 sem mídia: uma linha cheia, sem sobra", () => {
		expect(buildPlateLayout(4, false, 4)).toEqual({
			anchor: null,
			fullRows: [[0, 1, 2, 3]],
			leftoverRow: [],
		});
	});

	it("N=7 sem mídia: linha cheia + sobra de 3 (terços)", () => {
		expect(buildPlateLayout(7, false, 4)).toEqual({
			anchor: null,
			fullRows: [[0, 1, 2, 3]],
			leftoverRow: [4, 5, 6],
		});
	});

	it("N=11 sem mídia: 4 + 4 + sobra de 3", () => {
		expect(buildPlateLayout(11, false, 4)).toEqual({
			anchor: null,
			fullRows: [
				[0, 1, 2, 3],
				[4, 5, 6, 7],
			],
			leftoverRow: [8, 9, 10],
		});
	});

	it("N=1 com mídia: célula única cresce pra 2×2 ao lado da mídia", () => {
		expect(buildPlateLayout(1, true, 4)).toEqual({
			anchor: { cells: [{ specIndex: 0, colSpan: 2, rowSpan: 2 }] },
			fullRows: [],
			leftoverRow: [],
		});
	});

	it("N=2 com mídia: duas células largas empilhadas", () => {
		expect(buildPlateLayout(2, true, 4)).toEqual({
			anchor: {
				cells: [
					{ specIndex: 0, colSpan: 2, rowSpan: 1 },
					{ specIndex: 1, colSpan: 2, rowSpan: 1 },
				],
			},
			fullRows: [],
			leftoverRow: [],
		});
	});

	it("N=3 com mídia: larga em cima, duas simples embaixo", () => {
		expect(buildPlateLayout(3, true, 4)).toEqual({
			anchor: {
				cells: [
					{ specIndex: 0, colSpan: 2, rowSpan: 1 },
					{ specIndex: 1, colSpan: 1, rowSpan: 1 },
					{ specIndex: 2, colSpan: 1, rowSpan: 1 },
				],
			},
			fullRows: [],
			leftoverRow: [],
		});
	});

	it("N=5 com mídia: 4 na âncora + sobra 1 full-width", () => {
		expect(buildPlateLayout(5, true, 4)).toEqual({
			anchor: {
				cells: [
					{ specIndex: 0, colSpan: 1, rowSpan: 1 },
					{ specIndex: 1, colSpan: 1, rowSpan: 1 },
					{ specIndex: 2, colSpan: 1, rowSpan: 1 },
					{ specIndex: 3, colSpan: 1, rowSpan: 1 },
				],
			},
			fullRows: [],
			leftoverRow: [4],
		});
	});

	it("N=8 com mídia: 4 na âncora + linha cheia", () => {
		expect(buildPlateLayout(8, true, 4)).toEqual({
			anchor: {
				cells: [
					{ specIndex: 0, colSpan: 1, rowSpan: 1 },
					{ specIndex: 1, colSpan: 1, rowSpan: 1 },
					{ specIndex: 2, colSpan: 1, rowSpan: 1 },
					{ specIndex: 3, colSpan: 1, rowSpan: 1 },
				],
			},
			fullRows: [[4, 5, 6, 7]],
			leftoverRow: [],
		});
	});

	it("mobile (cols=2) ignora mídia e quebra em pares", () => {
		expect(buildPlateLayout(5, true, 2)).toEqual({
			anchor: null,
			fullRows: [
				[0, 1],
				[2, 3],
			],
			leftoverRow: [4],
		});
	});

	it("invariante: todo índice aparece exatamente uma vez (N=0..12 × mídia × cols)", () => {
		for (const cols of [2, 4] as const) {
			for (const hasMedia of [false, true]) {
				for (let n = 0; n <= 12; n++) {
					const layout = buildPlateLayout(n, hasMedia, cols);
					const seen = [
						...(layout.anchor?.cells.map((c) => c.specIndex) ?? []),
						...layout.fullRows.flat(),
						...layout.leftoverRow,
					].sort((a, b) => a - b);
					expect(seen).toEqual(Array.from({ length: n }, (_, i) => i));
					for (const row of layout.fullRows) {
						expect(row).toHaveLength(cols);
					}
					expect(layout.leftoverRow.length).toBeLessThan(cols);
				}
			}
		}
	});
});
