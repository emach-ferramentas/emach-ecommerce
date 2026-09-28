# Agents — packages/db

> **Fonte canônica:** `packages/db/CLAUDE.md` (convenções de schema deste workspace) + `CLAUDE.md` na raiz do monorepo (regras gerais). Esse arquivo é o ponto de entrada para agentes que não auto-descobrem `CLAUDE.md`.

## Quick reference

Drizzle 0.45 + node-postgres + Supabase Postgres. Schemas em `src/schema/*.ts`, agrupados por domínio. Barrel `src/schema/index.ts` é **intencional** (`// biome-ignore lint/performance/noBarrelFile`).

## Documentos a consultar

| Para...                                                       | Ler                                       |
| ------------------------------------------------------------- | ----------------------------------------- |
| Convenções deste workspace (sync, ownership, FKs, money, auditoria, scripts, RLS, triggers)| `packages/db/CLAUDE.md`                   |
| Stack, auth, anti-patterns, gotchas globais                   | `CLAUDE.md` (raiz do monorepo)            |
| Contrato DB compartilhada com dashboard (fonte de verdade)    | Repo irmão `emach-dashboard` (PR cruzado) |

## Antes de editar

- `src/schema/*.ts`, `src/queries/*.ts` e `src/sql/*.sql` são cópia do `emach-dashboard`, sincronizada por PR automático (ADR-0009). Não editar aqui; a mudança começa lá.
- Fora do sync, editados à mão: `src/index.ts` (registro `schema` do `db`) e `src/utils.ts`. Depois de todo PR de sync, rodar `bun check-types` e `bun --cwd packages/db db:apply-triggers`.
- O banco é único e compartilhado entre dev e produção. `db:seed-*`, `db:anonymize-client`, `db:push` e drop & recreate escrevem nele: só com autorização explícita da sessão.

## Invariantes locais

1. IDs: `text("id").primaryKey()` populado por `crypto.randomUUID()` no caller. Tabelas de junção (`tool_category`, `promotion_tool`, `stock_level`, `user_branch` etc.) usam PK composta, sem `id`.
2. Money produto: `numeric(10, 2)`. Money totais de pedido: `numeric(12, 2)`. Nunca `real`/`double`.
3. FKs sempre com `onDelete` explícito (`cascade` / `restrict` / `set null`).
4. Enums via `pgEnum`, derivar tipo: `(typeof enumName.enumValues)[number]`.
5. Auditoria: `actorType` (`actorTypeEnum` em `schema/shared-enums.ts`, `['user','system']`) + `actorUserId` (FK `user`; em `stockMovement` a coluna chama `actorId`) + CHECK de coerência (`user` exige ator, `system` exige NULL). O nome do CHECK varia por tabela. `stockMovement.actorType` tem default `'system'`. (Não há `apiKeyId`/`api_key` — os apps compartilham a DB direto.)
6. Triggers PL/pgSQL ficam em `src/sql/triggers.sql` (Drizzle-kit não gera). Aplicar com `bun db:apply-triggers` após qualquer push.
7. `stock_level` e `stock_movement` referenciam `tool_variant.id`, não `tool.id`. `order_item` guarda `tool_id` (produto-pai) e `variant_id` (SKU vendável), ambos NOT NULL e restrict. `stock_movement.variant_id` é nullable (`set null`). Mudanças nessas FKs exigem coordenação com app ecomerce.

## Comandos

Só `db:push` e `db:studio` rodam da raiz. Os demais existem apenas em `packages/db/package.json`: da raiz use `bun --cwd packages/db <script>`; de dentro de `packages/db`, `bun <script>`.

```bash
bun db:push                 # dev: sync schema → DB
# db:generate / db:migrate — LEGACY, NÃO USAR (workflow push-only; migrations/ removida)
bun db:studio               # UI inspetora
bun --cwd packages/db db:apply-triggers       # idempotente, após push
bun --cwd packages/db db:seed-categories      # bootstrap 5 raízes
bun --cwd packages/db db:seed-attributes      # bootstrap de 5 attribute_definitions de ferramentas-eletricas
bun --cwd packages/db db:check-drift          # tabelas/colunas, nullability e categoria de tipo Drizzle × DB (não vê FK, índice, CHECK, enum nem trigger); exit 1 com drift
bun --cwd packages/db db:anonymize-client <id>  # LGPD: anonimiza client, apaga endereços, sessões e contas; não altera pedidos, reviews nem logs de auditoria
bun run --filter=@emach/db test   # testes unitários, sem banco
bun check-types
```

## `db` × `createDb()`

- `db` (singleton) — uso geral em server actions.
- `createDb()` (factory) — usada em `@emach/auth/*` para evitar ciclo de import com `@emach/env`. **Não** consolidar em padrão único.
