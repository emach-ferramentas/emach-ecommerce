/**
 * Verifica drift entre as definições Drizzle (`src/schema/`) e o schema real
 * da DB PostgreSQL: tabela ausente, coluna fantasma (schema, não DB), coluna
 * faltante (DB, não schema), e divergência de nullability ou categoria de tipo
 * coluna a coluna. Sai com exit 1 em qualquer drift.
 *
 * Uso: bun --cwd packages/db db:check-drift
 */
import { env } from "@emach/env/server";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { Client } from "pg";

// biome-ignore lint/performance/noNamespaceImport: enumera todas as tabelas exportadas do schema
import * as schema from "../src/schema/index";

/** Categoria coarse do tipo da DB (a partir de `udt_name`). */
function dbCategory(udt: string): string {
	if (["text", "varchar", "bpchar", "char", "citext"].includes(udt)) {
		return "string";
	}

	if (udt === "bool") {
		return "boolean";
	}

	if (["int2", "int4", "int8", "numeric", "float4", "float8"].includes(udt)) {
		return "number";
	}

	if (["timestamp", "timestamptz", "date", "time"].includes(udt)) {
		return "datetime";
	}

	if (["json", "jsonb"].includes(udt)) {
		return "json";
	}

	return udt;
}

/** Categoria coarse do tipo Drizzle (a partir de `getSQLType()`). */
function drizzleCategory(sqlType: string): string {
	const t = sqlType.toLowerCase();

	if (t.startsWith("text") || t.startsWith("varchar") || t.startsWith("char")) {
		return "string";
	}

	if (t === "boolean") {
		return "boolean";
	}

	if (
		t.startsWith("integer") ||
		t.startsWith("smallint") ||
		t.startsWith("bigint") ||
		t.startsWith("numeric") ||
		t.startsWith("real") ||
		t.startsWith("double")
	) {
		return "number";
	}

	if (
		t.startsWith("timestamp") ||
		t.startsWith("date") ||
		t.startsWith("time")
	) {
		return "datetime";
	}

	if (t.startsWith("json")) {
		return "json";
	}

	return t;
}

interface DbColumn {
	column_name: string;
	is_nullable: string;
	udt_name: string;
}

const client = new Client({ connectionString: env.DATABASE_URL });

await client.connect();

let driftCount = 0;

for (const exported of Object.values(schema)) {
	if (!is(exported, PgTable)) {
		continue;
	}

	const { name, columns } = getTableConfig(exported);

	const res = await client.query<DbColumn>(
		"SELECT column_name, is_nullable, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
		[name]
	);

	if (res.rows.length === 0) {
		process.stdout.write(`✗ ${name}: tabela NÃO existe na DB\n`);
		driftCount++;
		continue;
	}

	const dbByName = new Map(res.rows.map((r) => [r.column_name, r]));
	const schemaNames = new Set(columns.map((c) => c.name));
	const issues: string[] = [];

	for (const col of columns) {
		const dbCol = dbByName.get(col.name);

		if (!dbCol) {
			issues.push(`coluna fantasma (schema, não DB): ${col.name}`);
			continue;
		}

		const dbNotNull = dbCol.is_nullable === "NO";

		if (dbNotNull !== col.notNull) {
			issues.push(
				`${col.name}: nullability — schema ${
					col.notNull ? "NOT NULL" : "nullable"
				}, DB ${dbNotNull ? "NOT NULL" : "nullable"}`
			);
		}

		const schemaCat = drizzleCategory(col.getSQLType());
		const dbCat = dbCategory(dbCol.udt_name);

		if (schemaCat !== dbCat) {
			issues.push(
				`${col.name}: tipo — schema ${schemaCat} (${col.getSQLType()}), DB ${dbCat} (${dbCol.udt_name})`
			);
		}
	}

	for (const r of res.rows) {
		if (!schemaNames.has(r.column_name)) {
			issues.push(`coluna faltante (DB, não schema): ${r.column_name}`);
		}
	}

	if (issues.length > 0) {
		driftCount++;
		process.stdout.write(`✗ ${name}:\n`);

		for (const issue of issues) {
			process.stdout.write(`    ${issue}\n`);
		}
	} else {
		process.stdout.write(`✓ ${name}\n`);
	}
}

await client.end();

if (driftCount > 0) {
	process.stdout.write(`\n${driftCount} tabela(s) com drift.\n`);
	process.exit(1);
}

process.stdout.write("\nSchema Drizzle bate com a DB.\n");
