import { db } from "@emach/db";
import type {
	BranchBusinessHours,
	BranchBusinessHoursPeriod,
} from "@emach/db/schema/inventory";
import { branch as branchTable } from "@emach/db/schema/inventory";
import { asc, eq } from "drizzle-orm";

export interface BranchRow {
	businessHours: BranchBusinessHours | null;
	cep: string | null;
	city: string | null;
	id: string;
	name: string;
	neighborhood: string | null;
	phone: string | null;
	state: string | null;
	street: string | null;
	streetNumber: string | null;
}

export async function getActiveBranches(): Promise<BranchRow[]> {
	return await db
		.select({
			id: branchTable.id,
			name: branchTable.name,
			phone: branchTable.phone,
			businessHours: branchTable.businessHours,
			cep: branchTable.cep,
			street: branchTable.street,
			streetNumber: branchTable.streetNumber,
			neighborhood: branchTable.neighborhood,
			city: branchTable.city,
			state: branchTable.state,
		})
		.from(branchTable)
		.where(eq(branchTable.status, "active"))
		.orderBy(asc(branchTable.createdAt), asc(branchTable.id));
}

export function formatCep(cep: string | null) {
	if (!cep) {
		return null;
	}
	const digits = cep.replace(/\D/g, "");
	if (digits.length !== 8) {
		return cep;
	}
	return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatPhone(phone: string | null) {
	if (!phone) {
		return null;
	}
	const digits = phone.replace(/\D/g, "");
	if (digits.length === 11) {
		return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
	}
	if (digits.length === 10) {
		return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
	}
	return phone;
}

// Alinhado ao formatBusinessPeriod do dashboard (lib/format/branch.ts de lá),
// estendido com o intervalo de almoço (breakStart/breakEnd) da issue #198.
export function formatBusinessPeriod(
	period: BranchBusinessHoursPeriod | null | undefined
) {
	if (!(period?.isOpen && period.opensAt && period.closesAt)) {
		return "Fechado";
	}
	// Intervalo parcial (só um dos campos): o Zod do dashboard garante
	// ambos-ou-nenhum, mas o jsonb não tem constraint — degrada pra turno único.
	if (period.breakStart && period.breakEnd) {
		return `${period.opensAt}–${period.breakStart} · ${period.breakEnd}–${period.closesAt}`;
	}
	return `${period.opensAt}–${period.closesAt}`;
}

export interface BusinessHoursRow {
	label: string;
	value: string;
}

export function getBusinessHoursRows(
	hours: BranchBusinessHours | null
): BusinessHoursRow[] | null {
	if (!hours) {
		return null;
	}
	return [
		{ label: "Seg–sex", value: formatBusinessPeriod(hours.weekdays) },
		{ label: "Sábado", value: formatBusinessPeriod(hours.saturday) },
		{ label: "Feriados", value: formatBusinessPeriod(hours.holidays) },
	];
}

export function formatBranchAddress(row: {
	cep: string | null;
	city: string | null;
	neighborhood: string | null;
	state: string | null;
	street: string | null;
	streetNumber: string | null;
}) {
	const streetLine = [row.street, row.streetNumber].filter(Boolean).join(", ");
	const cityLine = [row.city, row.state].filter(Boolean).join("/");
	const cep = formatCep(row.cep);
	return [streetLine, row.neighborhood, cityLine, cep ? `CEP ${cep}` : null]
		.filter(Boolean)
		.join(" - ");
}

export function branchMapsUrl(row: {
	street: string | null;
	streetNumber: string | null;
	neighborhood: string | null;
	city: string | null;
	state: string | null;
}): string {
	const locality = [row.city, row.state].filter(Boolean).join("/");
	const query = [row.street, row.streetNumber, row.neighborhood, locality]
		.filter(Boolean)
		.join(", ");
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
