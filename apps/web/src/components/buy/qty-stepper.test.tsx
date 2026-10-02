// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QtyStepper, stepQty } from "./qty-stepper";

const noop = () => undefined;

const BUTTON_TAG = {
	"Diminuir quantidade": /<button aria-label="Diminuir quantidade"[^>]*>/,
	"Aumentar quantidade": /<button aria-label="Aumentar quantidade"[^>]*>/,
} as const;
const FIELDSET_TAG = /<fieldset[^>]*>/;
const CLASS_ATTR = /class="([^"]*)"/;
const DISABLED_ATTR = ' disabled=""';

function buttonTag(html: string, label: keyof typeof BUTTON_TAG): string {
	return html.match(BUTTON_TAG[label])?.[0] ?? "";
}

function classesOf(tag: string): string[] {
	return (tag.match(CLASS_ATTR)?.[1] ?? "").split(" ");
}

describe("stepQty", () => {
	it("deixa a gaveta chegar a 0 para o chamador remover a linha", () => {
		expect(stepQty(1, -1, 0, 99)).toBe(0);
	});

	it("para no piso padrão de compra", () => {
		expect(stepQty(1, -1, 1, 20)).toBe(1);
	});

	it("para no teto", () => {
		expect(stepQty(99, 1, 0, 99)).toBe(99);
		expect(stepQty(5, 1, 1, 20)).toBe(6);
	});
});

describe("QtyStepper", () => {
	it("na compra (padrão) tem 52 px, legenda Quantidade e trava o - em 1", () => {
		const html = renderToStaticMarkup(<QtyStepper onChange={noop} value={1} />);
		const fieldset = html.match(FIELDSET_TAG)?.[0] ?? "";
		expect(classesOf(fieldset)).toContain("h-[52px]");
		expect(html).toContain('<legend class="sr-only">Quantidade</legend>');
		expect(buttonTag(html, "Diminuir quantidade")).toContain(DISABLED_ATTR);
		expect(buttonTag(html, "Aumentar quantidade")).not.toContain(DISABLED_ATTR);
	});

	it("trava o + no teto padrão de 20", () => {
		const html = renderToStaticMarkup(
			<QtyStepper onChange={noop} value={20} />
		);
		expect(buttonTag(html, "Aumentar quantidade")).toContain(DISABLED_ATTR);
	});

	it("no carrinho (md) tem botões de 44 px e libera o - até o mínimo 0", () => {
		const html = renderToStaticMarkup(
			<QtyStepper
				label="Quantidade de Furadeira X"
				max={99}
				min={0}
				onChange={noop}
				size="md"
				value={1}
			/>
		);
		const fieldset = html.match(FIELDSET_TAG)?.[0] ?? "";
		expect(classesOf(fieldset)).not.toContain("h-[52px]");
		for (const label of Object.keys(
			BUTTON_TAG
		) as (keyof typeof BUTTON_TAG)[]) {
			expect(classesOf(buttonTag(html, label))).toContain("size-11");
		}
		expect(buttonTag(html, "Diminuir quantidade")).not.toContain(DISABLED_ATTR);
		expect(html).toContain(
			'<legend class="sr-only">Quantidade de Furadeira X</legend>'
		);
	});
});
