/**
 * Verifica drift entre as definições Drizzle (`src/schema/`) e o schema real
 * da DB PostgreSQL. Falha com exit 1 se alguma tabela tiver coluna fantasma
 * (definida no schema, ausente na DB) ou faltante (presente na DB, ausente no
 * schema), ou se a tabela inteira não existir na DB.
 *
 * Uso: DATABASE_URL=... bun src/scripts/check-schema-drift.ts
 */
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { Client } from "pg";

// biome-ignore lint/performance/noNamespaceImport: enumera todas as tabelas exportadas do schema
import * as schema from "../schema/index";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL não definida");
}

const client = new Client({ connectionString });
await client.connect();

let driftCount = 0;

for (const exported of Object.values(schema)) {
	if (!is(exported, PgTable)) {
		continue;
	}
	const { name, columns } = getTableConfig(exported);
	const schemaCols = new Set(columns.map((c) => c.name));
	const res = await client.query<{ column_name: string }>(
		"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
		[name]
	);
	const dbCols = new Set(res.rows.map((r) => r.column_name));

	if (dbCols.size === 0) {
		process.stdout.write(`✗ ${name}: tabela NÃO existe na DB\n`);
		driftCount++;
		continue;
	}

	const phantom = [...schemaCols].filter((c) => !dbCols.has(c));
	const missing = [...dbCols].filter((c) => !schemaCols.has(c));

	if (phantom.length > 0 || missing.length > 0) {
		driftCount++;
		process.stdout.write(`✗ ${name}:\n`);
		if (phantom.length > 0) {
			process.stdout.write(
				`    fantasma (schema, não DB): ${phantom.join(", ")}\n`
			);
		}
		if (missing.length > 0) {
			process.stdout.write(
				`    faltante (DB, não schema): ${missing.join(", ")}\n`
			);
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
