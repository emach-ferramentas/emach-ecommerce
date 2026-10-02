import { expect, test } from "vitest";
import { emachButtonVariants } from "./emach-button";

test("variante link zera o padding do tamanho", () => {
	const classes = emachButtonVariants({
		variant: "link",
		className: "mt-2",
	}).split(" ");
	expect(classes).toContain("px-0");
	expect(classes).not.toContain("px-5");
	expect(classes).toContain("mt-2");
});
