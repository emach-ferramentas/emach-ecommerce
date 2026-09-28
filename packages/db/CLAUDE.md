# packages/db — Convenções

Drizzle 0.45 + node-postgres + Supabase Postgres. Schema TS aqui é **cópia versionada** do `emach-dashboard` — sync via CI PR automático (ADR-0009, no `emach-dashboard`). Regras gerais na raiz.

## Schema sync (ADR-0009)

- **Mudanças de schema começam no dashboard.** Workflow `sync-db-schema.yml` no dashboard abre PR aqui quando `packages/db/src/{schema,queries}` ou os SQL de `src/sql/` (`triggers.sql`, `rls.sql`) mudam na `main` do dashboard. O `rls.sql` já chegou por PR de sync (#107, #176); o glob exato do workflow está no dashboard.
- **Não editar `schema/*.ts` em isolamento.** Toda mudança vem por PR de sync.
- **`db:generate` / `db:migrate` são legacy** — scripts ainda no `package.json` mas não usar. Pasta `migrations/` foi removida.
- **Pós-merge do PR sync (ou pós-`db:push` em dev local):** rodar `bun --cwd packages/db db:apply-triggers`.
- **`src/index.ts` (barrel singleton) está FORA do escopo do sync** (o glob cobre `schema/`, `queries/` e os SQL de `sql/`). Quando o dashboard **adiciona/remove uma relation ou tabela** (ex.: #118 removeu `supplierRelations` de `tools.ts`), o `index.ts` continua importando/registrando o símbolo antigo e **quebra o build** (`error TS2305: no exported member`) — o sync não pega isso. **Sempre rodar `bun check-types` pós-merge de PR sync** e ajustar o import/objeto `schema` em `src/index.ts` à mão.

**Drop & recreate em dev** (renames ambíguos sem TTY): `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres, public;` via pg client → de dentro de `packages/db`: `bunx drizzle-kit push && bun db:apply-triggers && bun db:seed-categories && bun db:seed-attributes` e aplicar `src/sql/rls.sql`. Só em dev.

## Triggers PL/pgSQL

`src/sql/triggers.sql` (owned-by-dashboard, cópia aqui) tem 5 triggers que Drizzle Kit **não consegue gerar**: anti-ciclo de categoria + `path`/`depth` materializados, cascade de path, `client.last_seen`, derivação de `client.type`, nota automática no pedido quando a NF-e é cancelada (`trg_order_nfe_cancelled`). Aplicar:

```bash
bun --cwd packages/db db:apply-triggers   # idempotente (CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS)
```

O mesmo arquivo cria a sequence `order_number_seq`, que `placeOrder` consome para o número do pedido (`AAAA-000NNN`). Banco novo ou recriado sem `db:apply-triggers` não cria pedido.

Idempotência em `stockMovement` **não** é trigger, são dois partial unique indexes por `order_item_id`: `stock_movement_sale_idempotency` (`reason='saida_venda'`) e `stock_movement_return_idempotency` (`reason='devolucao_retorno'`, crédito de devolução).

**RLS deny-all (#90):** `src/sql/rls.sql` (owned-by-dashboard, cópia aqui; canônico avaliado no dashboard #142) habilita RLS **sem policies** nas 14 tabelas `public` expostas via PostgREST (`tool*`, `category`, `branch`, `stock_level`, `promotion*`, `review`, `attribute_definition`, `cart_event`). O app **não usa PostgREST** — todo acesso é server-side via Drizzle/`DATABASE_URL`, role `postgres` (BYPASSRLS), então deny-all fecha a porta REST (anon/authenticated veem 0 linhas) sem afetar o app. RLS é flag de tabela (não recriada por `db:push`) — **não** precisa reaplicar pós-push. Se algum dia o client ler catálogo via `supabase-js`, terá que **adicionar policy de SELECT pra anon** — hoje não há nenhuma (deny-all real). `rls.sql` não tem script: aplicar à mão (`psql "$DATABASE_URL" -f packages/db/src/sql/rls.sql`, idempotente) depois de um banco novo ou de um drop & recreate, porque `DROP SCHEMA public CASCADE` remove o flag junto com as tabelas. Como o dashboard aplica `rls.sql` em produção: não verificado.

## Convenções de schema

- ID: `text("id").primaryKey()` populado por `crypto.randomUUID()` no caller. Tabelas de junção (`tool_category`, `promotion_tool`, `stock_level`, `user_branch` etc.) usam PK composta, sem `id`.
- FK: explicitar `onDelete: "cascade" | "restrict" | "set null"`. Default = `restrict` por integridade.
- Money: `numeric(10, 2)` em `tool_variant.price_amount` e `store_settings.shipping_insurance_cap_amount`; `numeric(12, 2)` em totais e itens de pedido, `promotion.discount_value`, `promotion.min_order_amount` e `refund_request.amount`. Peso em `numeric(10, 3)` (kg), dimensões em `numeric(10, 2)` (cm). **Nunca `real`/`double`**.
- Auditoria: `actorType` (`actorTypeEnum` em `schema/shared-enums.ts`, `['user','system']`) + `actorUserId` (FK `user`; em `stockMovement` a coluna chama `actorId`) + CHECK de coerência (`user` exige ator, `system` exige NULL). O nome do CHECK varia por tabela (`actor_coherence` em `stock_movement` e `order_status_history`; `order_event_`, `refund_`, `supplier_audit_`, `client_audit_` + `actor_coherence` nas demais). `stockMovement.actorType` tem default `'system'`.
- "No máximo 1 marcado": `uniqueIndex(...).on(parentId).where(sql\`${isDefault} = true\`)` — ex `tool_variant.isDefault` (1 default por tool).

## Ownership de tabelas

- **Owned-by-dashboard** (autoritativo, mudanças via PR no dashboard): `tool`, `toolVariant`, `toolCategory`, `toolImage`, `toolAttributeAssignment`, `category`, `supplier`, `supplierAuditLog`, `branch`, `stockLevel`, `userBranch`, `userActivityLog`, `promotion`, `promotionTool`, `attribute*`, `storeSettings`, schema `auth`.
- **Owned-by-ecommerce**: tabelas `client*` (7) — `client`, `clientSession`, `clientAccount`, `clientVerification`, `clientAddress` + LGPD `clientAuditLog`, `clientExportLog`.
- **Escrita compartilhada** (ciclo de vida do pedido): `order`, `orderItem`, `orderStatusHistory`, `orderNote`, `orderAttachment`, `orderEvent`, `refundRequest`, `stockMovement`, `review`, `consentLog`, `toolAttributeValue`.

Não classificadas aqui (dono a confirmar no dashboard antes de editar): `banner`, `shippingBox`, `orderPicking`, `orderPickingItem`, `orderPickingScan`, `stockAlertSent`, `userCapabilityOverride`. Regra até lá: tratar como owned-by-dashboard (não editar `schema/*.ts` em isolamento).

`cartEvent`: escrita pela loja (INSERT em `apps/web/src/lib/actions/track-cart-event.ts`); o dashboard lê e expurga (comentário em `schema/cart-events.ts`). Fica fora das três listas acima.

`refundRequest`: o **storefront cria** (cliente solicita devolução); o **dashboard conduz** (revisa/aprova/estorna). `orderEvent`/`orderNote`/`orderAttachment` são majoritariamente escritos pelo dashboard no ciclo de vida.

Em `stockMovement` deste repo: **`actorType='system'`** (nunca `'user'` — `user` é staff).

## Exports

`src/schema/index.ts` é barrel intencional (`// biome-ignore lint/performance/noBarrelFile`). Import preferido em consumidores: `import { category } from "@emach/db/schema/categories"` — barrel é fallback.

## `db` × `createDb()`

- `db` (singleton em `src/index.ts`) — uso geral em server actions.
- `createDb()` (factory) — `@emach/auth/*` pra evitar ciclo de import com `@emach/env`. **Não consolidar.**
- `apps/web` importa `db` de `@emach/db` direto, inclusive nas rotas e actions autenticadas (`/checkout`, `/pedidos/[number]`, `/dashboard/*`), sempre depois de `requireCurrentClient()`. A regra de isolamento é outra: `apps/web` nunca importa `@emach/db/schema/auth` nem `@emach/auth/dashboard`. `@emach/auth` usa `createDb()` para evitar o ciclo com `@emach/env`.
- `schema` em `src/index.ts` é registro manual e parcial. Para tabela fora dele (`refundRequest`, `orderEvent`, `banner`, `storeSettings` etc.) usar `db.select().from(tabela)`; `db.query.<tabela>` só existe para as registradas. Ao usar relational API numa tabela nova, registrar tabela e relations em `src/index.ts`.

## Atenção pós-refactor de variants

`stock_level` e `stock_movement` referenciam **`tool_variant.id`** (não mais `tool.id`). `order_item` guarda os dois: `tool_id` (produto-pai, restrict) e `variant_id` (SKU vendável, restrict), ambos NOT NULL. `stock_movement.variant_id` é nullable (`set null` ao apagar a variante).

## Queries owned-by-dashboard

`packages/db/src/queries/*.ts` é ferramenta de leitura/regra de negócio consumida aqui (`reviews.ts`, `tools.ts`, `promotions.ts`; `ToolListItem` mora em `catalog-helpers.ts`).

**Regra:** dashboard é fonte de verdade. Sync via CI. **Não editar em isolamento aqui** — mudanças de regra começam no dashboard.

Padrão de assinatura: `db: NodePgDatabase<Record<string, unknown>>` parametrizado (não singleton; alias `AnyDb` em `catalog-helpers.ts`), `export type`, sem `select *` em projeções públicas (listar as colunas expostas).

**Armadilha: `db.execute()` raw devolve timestamp como string.** `db.execute(sql`...`)` não passa pelo mapper de colunas do Drizzle: `timestamp` volta como `string`. As queries raw de catálogo (`tools`, `categories`, `promotions`, `reviews`) convertem com `coerceDates(obj, KEYS)` de `src/utils.ts`, com as listas `*_DATE_KEYS` de `catalog-helpers.ts`. Query raw nova que declara `Date` no tipo precisa do mesmo passo. `src/utils.ts` fica fora do glob do sync, como `src/index.ts`: se o dashboard passar a importar algo novo de `../utils`, ajustar `utils.ts` à mão e rodar `bun check-types`. Consumidas pelo storefront: `categories`, `tools`, `promotions`, `reviews`, `shipping`, `shipping-quote` e `store-settings`. `dashboard.ts`, `dashboard-period.ts`, `order-status-groups.ts` e `branch-cep.ts` chegam pelo sync e nenhum código de produção deste repo os importa; só os testes do próprio `@emach/db` (`branch-cep.test.ts`, `dashboard-helpers.test.ts`, `dashboard-period.test.ts`).

## Storage de imagens

Buckets públicos usados pelo storefront (leitura): `tool-images` (`tool_image.url`, `<Image src={toolImage.url} />` direto), `banner-images` (banners) e `tool-videos` (`tool.videoUrl`/`videoPosterUrl`). Upload feito pelo dashboard. Os três estão na whitelist `images.remotePatterns` de `apps/web/next.config.ts` (host do projeto hardcoded); bucket novo exige entrada nova lá.

## Scripts úteis

Estes scripts existem só em `packages/db/package.json`; a raiz tem `db:push` e `db:studio` (via turbo) e os stubs LEGACY `db:generate`/`db:migrate` (saem com exit 1). Da raiz, rodar `bun --cwd packages/db <script>`.

```bash
bun db:apply-triggers         # idempotente, pós-sync
bun db:seed-categories        # bootstrap 5 categorias raiz idempotente
bun db:seed-attributes        # 5 attribute_definitions, só da raiz ferramentas-eletricas; rodar depois de db:seed-categories
bun db:anonymize-client <id>  # LGPD: anonimiza client (nome, e-mail, telefone, documento, imagem), apaga endereços, sessões e contas e registra consentLog de revogação; não altera pedidos, reviews nem logs de auditoria
bun db:check-drift            # tabelas/colunas, nullability e categoria de tipo Drizzle × DB (não vê FK, índice, CHECK, enum nem trigger); exit 1 com drift
bun db:studio                 # Drizzle Studio (inspeção visual)
```

## Testes

Testes unitários (Vitest, sem banco) vivem em `src/queries/__tests__/` e chegam pelo sync do dashboard, junto das queries. Rodam no CI via `bun run --filter=@emach/db test`, que é o mesmo comando local na raiz. Boot Supabase local: `bun test:supabase:start/stop` (precisa Docker).
