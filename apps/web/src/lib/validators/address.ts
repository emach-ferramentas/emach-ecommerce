import { onlyDigits } from "@emach/validators";
import { z } from "zod";

export const addressFieldsSchema = z.object({
	zipCode: z.string().refine((v) => onlyDigits(v).length === 8, "CEP inválido"),
	street: z.string().trim().min(2, "Rua é obrigatória"),
	number: z.string().trim().min(1, "Número é obrigatório"),
	complement: z.string(),
	neighborhood: z.string().trim().min(2, "Bairro é obrigatório"),
	city: z.string().trim().min(2, "Cidade é obrigatória"),
	state: z.string().trim().length(2, "Estado deve ter 2 letras (ex: SP)"),
});

export const addressInputSchema = addressFieldsSchema.extend({
	label: z.string().trim().max(40, "Apelido muito longo").optional(),
	isDefault: z.boolean().optional(),
});

export type AddressFields = z.infer<typeof addressFieldsSchema>;

export type AddressInput = z.infer<typeof addressInputSchema>;
