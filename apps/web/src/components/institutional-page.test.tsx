// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { privacySections } from "@/app/(shop)/privacidade/_content";
import { InstitutionalPage } from "@/components/institutional-page";

const H1_TAG = /<h1[\s>]/g;
const H2_TAG = /<h2[\s>]/g;

function render(
	extra?: Partial<Parameters<typeof InstitutionalPage>[0]>
): string {
	return renderToStaticMarkup(
		<InstitutionalPage
			label="X"
			lede="Y"
			sections={privacySections}
			title="T"
			updatedAt="2026-09-01"
			{...extra}
		/>
	);
}

function countOf(html: string, re: RegExp): number {
	return html.match(re)?.length ?? 0;
}

describe("InstitutionalPage", () => {
	const html = render();

	it("tem exatamente um h1", () => {
		expect(countOf(html, H1_TAG)).toBe(1);
	});

	it("envolve o conteúdo num main#main-content", () => {
		expect(html).toContain("<main");
		expect(html).toContain('id="main-content"');
	});

	it("liga o sumário a cada seção", () => {
		for (const s of privacySections) {
			expect(html).toContain(`href="#${s.id}"`);
			expect(html).toContain(`id="${s.id}"`);
		}
	});

	it("mostra a data no formato BR dentro de um <time>", () => {
		expect(html).toContain("01/09/2026");
		expect(html).toContain('<time dateTime="2026-09-01"');
	});

	it("tem um h2 por seção mais o do sumário", () => {
		expect(countOf(html, H2_TAG)).toBe(privacySections.length + 1);
	});

	it("dá nome acessível ao sumário via aria-labelledby", () => {
		expect(html).toContain('aria-labelledby="sumario"');
		expect(html).toContain('id="sumario"');
	});

	it("inclui extraTocItems no sumário", () => {
		const withExtra = render({
			extraTocItems: [{ id: "filiais", title: "Onde nos encontrar" }],
		});
		expect(withExtra).toContain('href="#filiais"');
		expect(withExtra).toContain("Onde nos encontrar");
	});

	it("devolve a string crua quando updatedAt não é ISO", () => {
		const invalid = render({ updatedAt: "invalid" });
		expect(invalid).toContain("invalid");
		expect(invalid).not.toContain("undefined");
	});
});
