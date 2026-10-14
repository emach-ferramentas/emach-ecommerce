import type { db } from "@emach/db";

/** Transação aberta por `db.transaction`, com o tipo que o Drizzle entrega ao callback. */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Quem executa query: o `db` da aplicação ou uma transação aberta nele. */
export type DbExecutor = typeof db | DbTransaction;
