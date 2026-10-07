import { branch } from "@emach/db/schema/inventory";
import { storeSettings } from "@emach/db/schema/store-settings";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { log } from "evlog";

export interface BranchAddressFields {
	cep: string | null;
	city: string | null;
	complement: string | null;
	neighborhood: string | null;
	state: string | null;
	street: string | null;
	streetNumber: string | null;
}

const CEP_DIGITS = /^\d{8}$/;
const NON_DIGIT = /\D/g;

function present(value: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

/** Duas linhas do rodapé, ou `null` quando falta campo obrigatório. */
export function formatBranchAddress(
	fields: BranchAddressFields
): string[] | null {
	const street = present(fields.street);
	const streetNumber = present(fields.streetNumber);
	const city = present(fields.city);
	const state = present(fields.state);
	const cep = present(fields.cep)?.replace(NON_DIGIT, "") ?? "";
	if (!(street && streetNumber && city && state && CEP_DIGITS.test(cep))) {
		return null;
	}
	const firstLine = [
		street,
		streetNumber,
		present(fields.complement),
		present(fields.neighborhood),
	]
		.filter(Boolean)
		.join(", ");
	return [
		firstLine,
		`${city}/${state}, CEP ${cep.slice(0, 5)}-${cep.slice(5)}`,
	];
}

/**
 * Endereço da filial de origem do frete para o rodapé dos e-mails. Nunca lança:
 * sem endereço o e-mail sai com o rodapé sem ele.
 */
export async function loadCompanyAddress(
	db: NodePgDatabase<Record<string, unknown>>
): Promise<string[] | null> {
	try {
		const rows = await db
			.select({
				street: branch.street,
				streetNumber: branch.streetNumber,
				complement: branch.complement,
				neighborhood: branch.neighborhood,
				city: branch.city,
				state: branch.state,
				cep: branch.cep,
			})
			.from(storeSettings)
			.leftJoin(branch, eq(storeSettings.shippingOriginBranchId, branch.id))
			.where(eq(storeSettings.id, "singleton"))
			.limit(1);
		const row = rows[0];
		if (!row) {
			log.warn({ action: "email_company_address_missing_settings" });
			return null;
		}
		const lines = formatBranchAddress(row);
		if (!lines) {
			log.warn({ action: "email_company_address_incomplete" });
		}
		return lines;
	} catch (error) {
		log.error({ action: "email_company_address_failed", error });
		return null;
	}
}
