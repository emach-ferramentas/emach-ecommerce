import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { log } from "evlog";
import {
	type BranchAddressFields,
	formatBranchAddress,
	loadCompanyAddress,
} from "./company-address";

const FULL: BranchAddressFields = {
	street: "Rua Pascoal Moreira Cabral Leme",
	streetNumber: "64",
	complement: "Loja Pinheiro",
	neighborhood: "Nova Esperança",
	city: "Balneário Camboriú",
	state: "SC",
	cep: "88336310",
};

const LINES = [
	"Rua Pascoal Moreira Cabral Leme, 64, Loja Pinheiro, Nova Esperança",
	"Balneário Camboriú/SC, CEP 88336-310",
];

describe("formatBranchAddress", () => {
	test("endereço completo vira as duas linhas do rodapé", () => {
		expect(formatBranchAddress(FULL)).toEqual(LINES);
	});

	test("sem complemento e sem bairro não sobra vírgula", () => {
		expect(
			formatBranchAddress({ ...FULL, complement: null, neighborhood: "  " })
		).toEqual([
			"Rua Pascoal Moreira Cabral Leme, 64",
			"Balneário Camboriú/SC, CEP 88336-310",
		]);
	});

	test.each([
		"street",
		"streetNumber",
		"city",
		"state",
		"cep",
	] as const)("sem %s devolve null", (field) => {
		expect(formatBranchAddress({ ...FULL, [field]: null })).toBeNull();
		expect(formatBranchAddress({ ...FULL, [field]: "   " })).toBeNull();
	});

	test("CEP com hífen é aceito e normalizado", () => {
		expect(formatBranchAddress({ ...FULL, cep: "88336-310" })).toEqual(LINES);
	});

	test("CEP com menos de 8 dígitos devolve null", () => {
		expect(formatBranchAddress({ ...FULL, cep: "8833631" })).toBeNull();
	});
});

type Db = NodePgDatabase<Record<string, unknown>>;

function dbReturning(result: () => Promise<unknown[]>): Db {
	const chain = {
		from: () => chain,
		leftJoin: () => chain,
		where: () => chain,
		limit: result,
	};
	return { select: () => chain } as unknown as Db;
}

describe("loadCompanyAddress", () => {
	const spies: { mockRestore: () => void }[] = [];
	afterEach(() => {
		for (const spy of spies.splice(0)) {
			spy.mockRestore();
		}
	});

	test("linha completa da filial de origem vira as duas linhas", async () => {
		const db = dbReturning(() => Promise.resolve([FULL]));
		expect(await loadCompanyAddress(db)).toEqual(LINES);
	});

	test("erro do banco devolve null e vai para o log", async () => {
		const error = spyOn(log, "error").mockImplementation(() => undefined);
		spies.push(error);
		const db = dbReturning(() => Promise.reject(new Error("db down")));

		expect(await loadCompanyAddress(db)).toBeNull();
		expect(error).toHaveBeenCalledWith(
			expect.objectContaining({ action: "email_company_address_failed" })
		);
	});

	test("sem linha de settings devolve null com aviso", async () => {
		const warn = spyOn(log, "warn").mockImplementation(() => undefined);
		spies.push(warn);
		const db = dbReturning(() => Promise.resolve([]));

		expect(await loadCompanyAddress(db)).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
	});

	test("filial com endereço incompleto devolve null com aviso", async () => {
		const warn = spyOn(log, "warn").mockImplementation(() => undefined);
		spies.push(warn);
		const db = dbReturning(() => Promise.resolve([{ ...FULL, city: null }]));

		expect(await loadCompanyAddress(db)).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
	});
});
