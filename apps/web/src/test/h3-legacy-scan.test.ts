import { describe, expect, it } from "vitest";
import {
	filesUnder,
	LEGACY_PATTERNS,
	scanForLegacyTokens,
	scanSource,
} from "./h3-legacy-scan";

const FIXTURES: readonly [string, string, string][] = [
	["near-black", 'className="bg-near-black"', 'className="bg-grafite"'],
	[
		"gray-(10|20|50|55|60)",
		'className="text-gray-60"',
		'className="text-ink-muted"',
	],
	["cinema-", 'className="bg-cinema-3"', 'className="bg-grafite-deep"'],
	["image-bg", 'className="bg-image-bg"', 'className="bg-well"'],
	["white/<n>", 'className="border-white/12"', 'className="text-white"'],
	[
		"<cor>-on-dark",
		'className="text-amber-on-dark"',
		'className="text-on-dark-muted"',
	],
	[
		"tracking-[0.",
		'className="tracking-[0.14em]"',
		'className="tracking-tight"',
	],
	["rounded-none", 'className="rounded-none"', 'className="rounded-[3px]"'],
	["bg-emach-red/", 'className="bg-emach-red/15"', 'className="bg-emach-red"'],
	[
		"border-emach-red",
		'className="border-emach-red"',
		'className="border-error-text"',
	],
	[
		"border-<lado>-emach-red",
		'className="border-l-emach-red"',
		'className="border-b-2 border-ink"',
	],
	[
		"SectionLabel",
		"<SectionLabel>Resumo</SectionLabel>",
		"<PageHead title='Resumo' />",
	],
	[
		"AccountHero",
		"<AccountHero title='Pedidos' />",
		"<PageHead title='Pedidos' />",
	],
	["AccountSection", "<AccountSection title='Itens'>", "<Panel title='Itens'>"],
	["AccountBadge", "<AccountBadge family='green'>", "<StatusChip tone='ok'>"],
	[
		"QuantityPicker",
		"<QuantityPicker value={1} />",
		"<QtyStepper value={1} />",
	],
	["emach-ghost-btn", 'className="emach-ghost-btn"', 'className="emach-input"'],
	["text-success", 'className="text-success"', 'className="text-ok"'],
	[
		"text-destructive",
		'className="text-destructive"',
		'className="text-error-text"',
	],
	[
		"emach-bg-placeholder",
		'className="emach-bg-placeholder"',
		'className="bg-well"',
	],
];

describe("scanSource", () => {
	it("tem uma fixture para cada padrão", () => {
		expect(FIXTURES.map(([token]) => token)).toEqual(
			LEGACY_PATTERNS.map(({ token }) => token)
		);
	});

	for (const [token, hit, miss] of FIXTURES) {
		it(`acha ${token} e deixa passar o equivalente H3`, () => {
			expect(scanSource(hit, "x.tsx")).toEqual([
				{ file: "x.tsx", line: 1, token },
			]);
			expect(scanSource(miss, "x.tsx")).toEqual([]);
		});
	}

	it("informa a linha de cada achado", () => {
		const source = ["<div>", '  <p className="text-gray-60">', "</div>"].join(
			"\n"
		);
		expect(scanSource(source, "y.tsx")).toEqual([
			{ file: "y.tsx", line: 2, token: "gray-(10|20|50|55|60)" },
		]);
	});
});

describe("filesUnder", () => {
	it("lista .ts e .tsx da pasta, sem testes", () => {
		const files = filesUnder("components/hero");
		expect(files).toContain("components/hero/hero-element-renders.tsx");
		expect(files).toContain("components/hero/hero-cta-variants.ts");
		expect(files).not.toContain("components/hero/hero-cta.test.tsx");
	});
});

describe("primitivos do U0", () => {
	it("não usam token visual antigo", () => {
		expect(
			scanForLegacyTokens([
				"components/emach-button.tsx",
				"components/breadcrumb.tsx",
				"components/page-head.tsx",
				"components/panel.tsx",
				"components/notice.tsx",
				"components/status-chip.tsx",
				"components/status-screen.tsx",
				"components/store-frame.tsx",
				"components/field.tsx",
				"components/buy/qty-stepper.tsx",
				"app/dashboard/_components/account-trail.ts",
				"app/dashboard/_components/status-stepper.tsx",
				"app/dashboard/pedidos/_components/order-status-badge.tsx",
				"app/dashboard/reembolso/_components/refund-status-badge.tsx",
			])
		).toEqual([]);
	});
});
