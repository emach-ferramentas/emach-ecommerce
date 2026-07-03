import { db } from "@emach/db";
import type { BranchBusinessHours } from "@emach/db/schema/inventory";
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

export function formatBusinessHours(hours: BranchBusinessHours | null) {
	if (!hours) {
		return null;
	}
	const formatPeriod = (
		label: string,
		period: BranchBusinessHours[keyof BranchBusinessHours]
	) => {
		if (!period?.isOpen) {
			return `${label}: fechado`;
		}
		if (!(period.opensAt && period.closesAt)) {
			return `${label}: aberto`;
		}
		return `${label}: ${period.opensAt}-${period.closesAt}`;
	};
	return [
		formatPeriod("Seg-sex", hours.weekdays),
		formatPeriod("Sáb", hours.saturday),
		formatPeriod("Feriados", hours.holidays),
	].join(" | ");
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
