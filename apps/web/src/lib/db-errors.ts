import { z } from "zod";

const UNIQUE_VIOLATION = "23505";

// O Drizzle embrulha o erro do driver: o código do Postgres vem em `err.cause.code`.
const dbErrorSchema = z.object({
	cause: z
		.object({ code: z.string(), constraint: z.string().optional() })
		.optional(),
});

/**
 * Recebe o valor de um `catch` e diz se é violação de unique do Postgres. Com
 * `constraint`, só conta a violação dessa constraint.
 */
export function isUniqueViolation(
	cause: unknown,
	constraint?: string
): boolean {
	const parsed = dbErrorSchema.safeParse(cause);

	if (!parsed.success || parsed.data.cause?.code !== UNIQUE_VIOLATION) {
		return false;
	}

	return (
		constraint === undefined || parsed.data.cause.constraint === constraint
	);
}
