import {
	isValidCpfCnpj,
	isValidPhone,
	normalizeDocument,
	onlyDigits,
} from "@emach/validators";
import { APIError } from "better-auth/api";
import { z } from "zod";

// Validação server-side de CPF/CNPJ (#92). A política client-side (Zod) é só
// UX; requests diretos aos endpoints do Better Auth (sign-up, updateUser)
// bypassam o cliente. Lança `APIError` (não `Error` plano) porque só ela
// propaga a mensagem ao cliente. Retorno tri-estado:
//   - `undefined`: campo não veio no payload → o hook não mexe no documento.
//   - `null`: campo veio vazio → limpar (grava NULL, **não** "" — string vazia
//     colidiria no unique `client_document_unique` no 2º cliente que limpasse,
//     e violaria a invariante "sem pontuação" do schema).
//   - `string`: CPF (só dígitos) ou CNPJ (maiúsculas e dígitos, #244)
//     normalizado e válido.
function normalizeDocumentForWrite(
	raw: string | undefined
): string | null | undefined {
	if (raw === undefined) {
		return;
	}

	const trimmed = raw.trim();

	if (trimmed === "") {
		return null;
	}

	const document = normalizeDocument(trimmed);

	if (!isValidCpfCnpj(document)) {
		throw new APIError("BAD_REQUEST", {
			message: "CPF ou CNPJ inválido.",
		});
	}

	return document;
}

// Mesmo tri-estado do document, para o `phone` (#100). `phone` NÃO é unique no
// schema (text("phone")), então o motivo do '' → null aqui é a invariante "só
// dígitos" da coluna, não colisão de unique. Validação client-side (Zod) é só UX.
function normalizePhoneForWrite(
	raw: string | undefined
): string | null | undefined {
	if (raw === undefined) {
		return;
	}

	const trimmed = raw.trim();

	if (trimmed === "") {
		return null;
	}

	const phone = onlyDigits(trimmed);

	if (!isValidPhone(phone)) {
		throw new APIError("BAD_REQUEST", {
			message: "Telefone inválido.",
		});
	}

	return phone;
}

// Payload do hook do Better Auth: os campos chegam sem tipo garantido. Valor
// que não é string (ausente, null, número) vira `undefined` = o hook não mexe.
const writableUserFieldsSchema = z.object({
	document: z.string().optional().catch(undefined),
	phone: z.string().optional().catch(undefined),
});

// Aplica a normalização de todos os additionalFields graváveis num único lugar,
// consumido por create.before e update.before. `undefined` = campo ausente no
// payload → não mexe; `null`/string = grava.
export function normalizeUserForWrite<T extends object>(data: T): T {
	const parsed = writableUserFieldsSchema.safeParse(data);
	const fields = parsed.success ? parsed.data : {};
	const document = normalizeDocumentForWrite(fields.document);
	const phone = normalizePhoneForWrite(fields.phone);
	let out = data;

	if (document !== undefined) {
		out = { ...out, document };
	}

	if (phone !== undefined) {
		out = { ...out, phone };
	}

	return out;
}
