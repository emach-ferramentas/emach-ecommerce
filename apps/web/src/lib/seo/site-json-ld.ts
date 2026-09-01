import type { BranchBusinessHours } from "@emach/db/schema/inventory";
import { type BranchRow, formatCep } from "@/lib/branches";

export const ORGANIZATION_NAME = "EMACH Ferramentas";

export interface OpeningHoursSpecification {
	"@type": "OpeningHoursSpecification";
	closes: string;
	dayOfWeek: string[];
	opens: string;
}

interface Organization {
	"@id": string;
	"@type": "Organization";
	logo: string;
	name: string;
	sameAs?: string[];
	url: string;
}

interface WebSite {
	"@id": string;
	"@type": "WebSite";
	inLanguage: "pt-BR";
	name: string;
	potentialAction: {
		"@type": "SearchAction";
		"query-input": string;
		target: { "@type": "EntryPoint"; urlTemplate: string };
	};
	publisher: { "@id": string };
	url: string;
}

interface HardwareStore {
	"@id": string;
	"@type": "HardwareStore";
	address: {
		"@type": "PostalAddress";
		addressCountry: "BR";
		addressLocality?: string;
		addressRegion?: string;
		postalCode?: string;
		streetAddress?: string;
	};
	name: string;
	openingHoursSpecification?: OpeningHoursSpecification[];
	parentOrganization: { "@id": string };
	telephone?: string;
	url: string;
}

export interface SiteGraph {
	"@context": "https://schema.org";
	"@graph": [Organization, WebSite, ...HardwareStore[]];
}

export interface SiteGraphInput {
	baseUrl: string;
	branches: BranchRow[];
	sameAs: string[];
}

const TRAILING_SLASHES = /\/+$/;
const NON_DIGITS = /\D/g;

// `holidays` não mapeia para dayOfWeek do schema.org — fica de fora.
const DAY_GROUPS: Array<{ days: string[]; key: "weekdays" | "saturday" }> = [
	{
		key: "weekdays",
		days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
	},
	{ key: "saturday", days: ["Saturday"] },
];

function spec(
	days: string[],
	opens: string,
	closes: string
): OpeningHoursSpecification {
	return {
		"@type": "OpeningHoursSpecification",
		dayOfWeek: days,
		opens,
		closes,
	};
}

export function openingHoursFor(
	hours: BranchBusinessHours | null
): OpeningHoursSpecification[] {
	if (!hours) {
		return [];
	}
	const out: OpeningHoursSpecification[] = [];
	for (const group of DAY_GROUPS) {
		const period = hours[group.key];
		if (!(period?.isOpen && period.opensAt && period.closesAt)) {
			continue;
		}
		if (period.breakStart && period.breakEnd) {
			out.push(
				spec(group.days, period.opensAt, period.breakStart),
				spec(group.days, period.breakEnd, period.closesAt)
			);
		} else {
			out.push(spec(group.days, period.opensAt, period.closesAt));
		}
	}
	return out;
}

function digitsOnly(value: string | null): string {
	return value ? value.replace(NON_DIGITS, "") : "";
}

/** Telefone BR em E.164 (+55DDDNÚMERO). Devolve undefined se não parecer BR. */
function e164(phone: string | null): string | undefined {
	const digits = digitsOnly(phone);
	if (digits.length === 10 || digits.length === 11) {
		return `+55${digits}`;
	}
	if (
		(digits.length === 12 || digits.length === 13) &&
		digits.startsWith("55")
	) {
		return `+${digits}`;
	}
	return;
}

function buildOrganization(base: string, sameAs: string[]): Organization {
	return {
		"@type": "Organization",
		"@id": `${base}/#organization`,
		name: ORGANIZATION_NAME,
		url: `${base}/`,
		logo: `${base}/images/logos/icone.svg`,
		...(sameAs.length > 0 ? { sameAs } : {}),
	};
}

function buildWebSite(base: string): WebSite {
	return {
		"@type": "WebSite",
		"@id": `${base}/#website`,
		name: ORGANIZATION_NAME,
		url: `${base}/`,
		inLanguage: "pt-BR",
		publisher: { "@id": `${base}/#organization` },
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${base}/catalog?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};
}

function buildHardwareStore(base: string, branch: BranchRow): HardwareStore {
	// Bairro entra no streetAddress (o schema.org não tem campo próprio) e o CEP
	// sai formatado, como o Google espera num endereço BR.
	const streetAddress = [
		branch.street,
		branch.streetNumber,
		branch.neighborhood,
	]
		.filter(Boolean)
		.join(", ");
	const postalCode =
		digitsOnly(branch.cep).length === 8 ? formatCep(branch.cep) : null;
	const telephone = e164(branch.phone);
	const hours = openingHoursFor(branch.businessHours);
	return {
		"@type": "HardwareStore",
		"@id": `${base}/#branch-${branch.id}`,
		name: `EMACH ${branch.name}`,
		url: `${base}/sobre#filiais`,
		parentOrganization: { "@id": `${base}/#organization` },
		address: {
			"@type": "PostalAddress",
			addressCountry: "BR",
			...(streetAddress ? { streetAddress } : {}),
			...(branch.city ? { addressLocality: branch.city } : {}),
			...(branch.state ? { addressRegion: branch.state } : {}),
			...(postalCode ? { postalCode } : {}),
		},
		...(telephone ? { telephone } : {}),
		...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
	};
}

export function buildSiteGraph(input: SiteGraphInput): SiteGraph {
	const base = input.baseUrl.replace(TRAILING_SLASHES, "");
	return {
		"@context": "https://schema.org",
		"@graph": [
			buildOrganization(base, input.sameAs),
			buildWebSite(base),
			...input.branches.map((b) => buildHardwareStore(base, b)),
		],
	};
}
