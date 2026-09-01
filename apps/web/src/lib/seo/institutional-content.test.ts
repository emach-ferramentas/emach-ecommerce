import { describe, expect, it } from "vitest";
import { DELIVERY_LEDE, deliverySections } from "@/app/(shop)/entrega/_content";
import {
	PRIVACY_LEDE,
	privacySections,
} from "@/app/(shop)/privacidade/_content";
import type { InstitutionalSection } from "@/components/institutional-page";

// Decisão do dono do produto (spec, Track 3): nenhum texto institucional
// fala de troca, devolução ou garantia, nem promete prazo fixo de entrega.
// Radicais: pega troca/trocar/trocas, devolver/devolução/devolvido,
// garantia/garantido/garantimos. "garante" (A LGPD garante) não casa
// `garanti`, de propósito.
const FORBIDDEN = /\b(troc|devolv|devolu|garanti)\w*/i;
// Qualquer "N dias" na página de entrega é prazo fixo.
const FIXED_DEADLINE = /\b\d+\s*dias?\b/i;

function allText(sections: InstitutionalSection[], lede: string): string[] {
	const out = [lede];
	for (const s of sections) {
		out.push(s.title, ...s.paragraphs, ...(s.bullets ?? []));
	}
	return out;
}

describe("sentinelas das regex-guardrail", () => {
	it("FORBIDDEN pega as flexões, não 'garante'", () => {
		expect("Você pode trocar o produto").toMatch(FORBIDDEN);
		expect("Produto garantido").toMatch(FORBIDDEN);
		expect("Basta devolver o item").toMatch(FORBIDDEN);
		expect("A LGPD garante").not.toMatch(FORBIDDEN);
	});
	it("FIXED_DEADLINE pega qualquer 'N dias'", () => {
		expect("Entregamos em 5 dias úteis").toMatch(FIXED_DEADLINE);
	});
});

describe.each([
	["privacidade", privacySections, PRIVACY_LEDE, false],
	["entrega", deliverySections, DELIVERY_LEDE, true],
] as const)("%s", (_name, sections, lede, checkDeadline) => {
	it("não menciona troca, devolução ou garantia", () => {
		for (const text of allText(sections, lede)) {
			expect(text).not.toMatch(FORBIDDEN);
		}
	});
	// Só /entrega: /privacidade fala legitimamente em "15 dias" da LGPD.
	it.skipIf(!checkDeadline)("não promete prazo fixo de entrega", () => {
		for (const text of allText(sections, lede)) {
			expect(text).not.toMatch(FIXED_DEADLINE);
		}
	});
	it("ids de seção são únicos e parágrafos/bullets não são vazios nem repetidos", () => {
		const ids = sections.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const s of sections) {
			const items = [...s.paragraphs, ...(s.bullets ?? [])];
			expect(items.every((t) => t.trim().length > 0)).toBe(true);
			expect(new Set(items).size).toBe(items.length);
		}
	});
});
