# Ownership de migrations: o repo espelha a DB, não autora migrations

O `emach-ecommerce` (storefront) não autora nem versiona migrations do banco. O schema PostgreSQL é propriedade do repo irmão `emach-dashboard`; aqui, `packages/db/src/schema/*` é uma cópia versionada — um espelho — das tabelas, mantida em sincronia com a DB real e verificada pelo script `db:check-drift` (`packages/db/scripts/check-schema-drift.ts`). Migrations geradas por `drizzle-kit generate` são barradas pelo `.gitignore`. As exceções são dois arquivos SQL em `packages/db/src/sql/`, ambos cópias versionadas do dashboard: `triggers.sql` (triggers PL/pgSQL que o Drizzle Kit não gera), que o `bun --cwd packages/db db:apply-triggers` daqui aplica de forma idempotente; e `rls.sql` (RLS deny-all nas tabelas expostas ao PostgREST), que nenhum script deste repo aplica. O `db:sync` do dashboard já aplica `triggers.sql` e `rls.sql` no mesmo banco. O `db:apply-triggers` daqui roda DDL no banco de produção e só entra com autorização.

## Considered Options

- **Versionar migrations próprias** neste repo (`drizzle-kit generate` + `db:migrate`) — rejeitado: dois apps autorando migrations para a mesma DB produz duas trilhas concorrentes, com ordem de aplicação ambígua e risco alto de divergência.

## Consequences

- Mudanças de schema originam no `emach-dashboard` (PR lá primeiro); este repo ressincroniza a cópia de `schema/*` depois.
- `bun --cwd packages/db db:check-drift` é o guard que detecta divergência entre os schema files e a DB real — existência de coluna, nullability e categoria de tipo.
- `drizzle.config.ts` mantém `out: "./src/migrations"`; qualquer arquivo gerado ali é ignorado pelo git e não é um fluxo suportado.
- O storefront não empurra schema. O `db:push` deste repo é um stub que sai com erro, e o `scripts/db-scripts.test.ts` barra `drizzle-kit push`, `migrate` e `generate` em qualquer `package.json`. Só o dashboard empurra, com `db:sync`.
