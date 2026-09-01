import type { BranchBusinessHours } from "@emach/db/schema/inventory";
import { describe, expect, it } from "vitest";
import type { BranchRow } from "@/lib/branches";
import { buildSiteGraph, openingHoursFor } from "./site-json-ld";

const BASE = "https://www.emachferramentas.com.br";

const hours: BranchBusinessHours = {
	weekdays: {
		isOpen: true,
		opensAt: "08:00",
		closesAt: "18:00",
		breakStart: "12:00",
		breakEnd: "13:00",
	},
	saturday: {
		isOpen: true,
		opensAt: "08:00",
		closesAt: "12:00",
		breakStart: null,
		breakEnd: null,
	},
	holidays: {
		isOpen: false,
		opensAt: null,
		closesAt: null,
		breakStart: null,
		breakEnd: null,
	},
};

const branch: BranchRow = {
	id: "b1",
	name: "Matriz",
	phone: "(16) 3333-4444",
	businessHours: hours,
	cep: "14270-000",
	street: "Rua das Ferramentas",
	streetNumber: "100",
	neighborhood: "Centro",
	city: "Santa Rosa de Viterbo",
	state: "SP",
};

describe("openingHoursFor", () => {
	it("quebra o intervalo de almoço em dois períodos", () => {
		const out = openingHoursFor(hours);
		expect(out).toEqual([
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
				opens: "08:00",
				closes: "12:00",
			},
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
				opens: "13:00",
				closes: "18:00",
			},
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: ["Saturday"],
				opens: "08:00",
				closes: "12:00",
			},
		]);
	});
	it("sem horário cadastrado devolve lista vazia", () => {
		expect(openingHoursFor(null)).toEqual([]);
	});
	it("ignora período aberto sem hora de abertura", () => {
		const out = openingHoursFor({
			...hours,
			weekdays: { ...hours.weekdays, opensAt: null },
		});
		expect(out).toEqual([
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: ["Saturday"],
				opens: "08:00",
				closes: "12:00",
			},
		]);
	});
});

describe("buildSiteGraph", () => {
	it("monta Organization, WebSite e uma HardwareStore por filial", () => {
		const graph = buildSiteGraph({
			baseUrl: BASE,
			branches: [branch],
			sameAs: ["https://instagram.com/emach"],
		});
		expect(graph["@context"]).toBe("https://schema.org");
		const [org, site, store] = graph["@graph"];
		expect(org).toMatchObject({
			"@type": "Organization",
			"@id": `${BASE}/#organization`,
			name: "EMACH Ferramentas",
			url: `${BASE}/`,
			logo: `${BASE}/images/logos/icone.svg`,
			sameAs: ["https://instagram.com/emach"],
		});
		expect(site).toMatchObject({
			"@type": "WebSite",
			"@id": `${BASE}/#website`,
			inLanguage: "pt-BR",
			potentialAction: {
				"@type": "SearchAction",
				target: {
					"@type": "EntryPoint",
					urlTemplate: `${BASE}/catalog?q={search_term_string}`,
				},
				"query-input": "required name=search_term_string",
			},
		});
		expect(store).toMatchObject({
			"@type": "HardwareStore",
			"@id": `${BASE}/#branch-b1`,
			name: "EMACH Matriz",
			telephone: "+551633334444",
			parentOrganization: { "@id": `${BASE}/#organization` },
			address: {
				"@type": "PostalAddress",
				streetAddress: "Rua das Ferramentas, 100, Centro",
				addressLocality: "Santa Rosa de Viterbo",
				addressRegion: "SP",
				postalCode: "14270-000",
				addressCountry: "BR",
			},
		});
		expect(store).toHaveProperty("openingHoursSpecification");
	});

	it("omite sameAs vazio, telefone ausente e horário ausente", () => {
		const graph = buildSiteGraph({
			baseUrl: BASE,
			branches: [{ ...branch, phone: null, businessHours: null }],
			sameAs: [],
		});
		const [org, , store] = graph["@graph"];
		expect(org).not.toHaveProperty("sameAs");
		expect(store).not.toHaveProperty("telephone");
		expect(store).not.toHaveProperty("openingHoursSpecification");
	});

	it("emite uma HardwareStore por filial, com @id distinto", () => {
		const graph = buildSiteGraph({
			baseUrl: BASE,
			branches: [branch, { ...branch, id: "b2", name: "Filial Norte" }],
			sameAs: [],
		});
		const stores = graph["@graph"].slice(2);
		expect(stores.map((s) => s["@id"])).toEqual([
			`${BASE}/#branch-b1`,
			`${BASE}/#branch-b2`,
		]);
		expect(stores.map((s) => s.name)).toEqual([
			"EMACH Matriz",
			"EMACH Filial Norte",
		]);
	});

	it("aceita baseUrl com barra final sem duplicar barra", () => {
		const graph = buildSiteGraph({
			baseUrl: `${BASE}/`,
			branches: [],
			sameAs: [],
		});
		expect(graph["@graph"][0]).toMatchObject({ url: `${BASE}/` });
	});
});
