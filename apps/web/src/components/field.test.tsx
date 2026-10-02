// @vitest-environment node
import { useForm } from "@tanstack/react-form";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorMessages, Field, type StringFieldApi, TextField } from "./field";

const INPUT_TAG = /<input[^>]*>/;

function inputOf(html: string): string {
	return html.match(INPUT_TAG)?.[0] ?? "";
}

function renderField(props: { error?: string[]; hint?: string }): string {
	return renderToStaticMarkup(
		<Field id="phone" label="Telefone" {...props}>
			{(control) => <input {...control} className="emach-input" />}
		</Field>
	);
}

describe("Field", () => {
	it("liga o rótulo ao controle e não marca erro sem mensagem", () => {
		const html = renderField({});
		expect(html).toContain('<label class="emach-field__label" for="phone">');
		expect(inputOf(html)).toContain('id="phone"');
		expect(inputOf(html)).not.toContain("aria-invalid");
		expect(inputOf(html)).not.toContain("aria-describedby");
		expect(html).not.toContain('role="alert"');
	});

	it("aponta a dica por <id>-hint", () => {
		const html = renderField({ hint: "Com DDD" });
		expect(html).toContain('id="phone-hint"');
		expect(inputOf(html)).toContain('aria-describedby="phone-hint"');
	});

	it("com erro marca aria-invalid e descreve por <id>-error com todas as mensagens", () => {
		const html = renderField({
			error: ["Telefone inválido", "Informe o DDD"],
			hint: "Com DDD",
		});
		const input = inputOf(html);
		expect(input).toContain('aria-invalid="true"');
		expect(input).toContain('aria-describedby="phone-hint phone-error"');
		expect(html).toContain('id="phone-error" role="alert"');
		expect(html).toContain("Telefone inválido");
		expect(html).toContain("Informe o DDD");
	});
});

describe("errorMessages", () => {
	it("descarta vazias e repetidas", () => {
		expect(
			errorMessages([
				{ message: "Obrigatório" },
				undefined,
				{},
				{ message: "Obrigatório" },
				{ message: "CPF inválido" },
			])
		).toEqual(["Obrigatório", "CPF inválido"]);
	});
});

const addressSchema = z.object({
	newAddress: z.object({ street: z.string().min(1, "Informe a rua") }),
});

function NestedStreet() {
	const form = useForm({
		defaultValues: { newAddress: { street: "Rua 21 de Abril" } },
		validators: { onChange: addressSchema },
	});
	return (
		<form.Field name="newAddress.street">
			{(field) => (
				<TextField autoComplete="address-line1" field={field} label="Rua" />
			)}
		</form.Field>
	);
}

describe("TextField", () => {
	it("aceita o campo aninhado do TanStack Form e usa o name como id", () => {
		const html = renderToStaticMarkup(<NestedStreet />);
		const input = inputOf(html);
		expect(html).toContain('for="newAddress.street"');
		expect(input).toContain('id="newAddress.street"');
		expect(input).toContain('value="Rua 21 de Abril"');
		expect(input).toContain('autoComplete="address-line1"');
		expect(input).toContain('class="emach-input"');
	});

	it("mostra os erros do campo", () => {
		const field: StringFieldApi = {
			handleBlur: () => undefined,
			handleChange: () => undefined,
			name: "document",
			state: {
				meta: { errors: [{ message: "CPF ou CNPJ inválido" }] },
				value: "123",
			},
		};
		const html = renderToStaticMarkup(
			<TextField field={field} id="document" label="CPF ou CNPJ" />
		);
		expect(inputOf(html)).toContain('aria-invalid="true"');
		expect(html).toContain("CPF ou CNPJ inválido");
	});
});
