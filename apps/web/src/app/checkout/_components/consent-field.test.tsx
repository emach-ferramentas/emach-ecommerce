// @vitest-environment node
import { FieldApi, FormApi, revalidateLogic } from "@tanstack/react-form";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ConsentField } from "./consent-field";

const MESSAGE = "Aceite os termos para continuar";

const schema = z.object({
	acceptTos: z.literal(true, { error: () => ({ message: MESSAGE }) }),
});

function mountConsent() {
	const form = new FormApi({
		defaultValues: { acceptTos: false as boolean },
		validationLogic: revalidateLogic(),
		validators: { onDynamic: schema },
	});
	const field = new FieldApi({ form, name: "acceptTos" });
	form.mount();
	field.mount();
	return { form, field };
}

function renderConsent(field: ReturnType<typeof mountConsent>["field"]) {
	return renderToStaticMarkup(
		<ConsentField
			checked={field.state.value === true}
			errors={field.state.meta.errors}
			id="acceptTos"
			label="Li e aceito os Termos de Uso"
			onChange={() => undefined}
			required
			touched={field.state.meta.isTouched}
		/>
	);
}

describe("ConsentField no formulário", () => {
	it("não mostra erro antes de o cliente mexer ou enviar", () => {
		const { field } = mountConsent();
		expect(renderConsent(field)).not.toContain(MESSAGE);
	});

	it("mostra o erro depois de um envio com a caixa desmarcada", async () => {
		const { form, field } = mountConsent();
		await form.handleSubmit();
		expect(renderConsent(field)).toContain(MESSAGE);
	});

	it("tira o erro quando o cliente marca a caixa depois do envio", async () => {
		const { form, field } = mountConsent();
		await form.handleSubmit();
		field.handleChange(true);
		expect(renderConsent(field)).not.toContain(MESSAGE);
		field.handleChange(false);
		expect(renderConsent(field)).toContain(MESSAGE);
	});
});
