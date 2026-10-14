import { z } from "zod";

// `order.shippingAddress` é jsonb sem tipo: o checkout grava o snapshot e o
// dashboard também escreve em `order`. Campo ausente ou com tipo inesperado vira
// `undefined` sozinho, sem derrubar os outros; número (snapshot legado) vira
// texto. O schema só falha quando o valor não é objeto: cada caller decide se
// isso vira endereço vazio (`.catch({})`) ou seção omitida (`safeParse`).
const snapshotText = z
	.union([z.string(), z.number().transform(String)])
	.optional()
	.catch(undefined);

export const addressSnapshotSchema = z.object({
	city: snapshotText,
	complement: z
		.union([z.string(), z.number().transform(String)])
		.nullish()
		.catch(undefined),
	country: snapshotText,
	neighborhood: snapshotText,
	number: snapshotText,
	recipient: snapshotText,
	state: snapshotText,
	street: snapshotText,
	zipCode: snapshotText,
});

export type AddressSnapshot = z.infer<typeof addressSnapshotSchema>;
