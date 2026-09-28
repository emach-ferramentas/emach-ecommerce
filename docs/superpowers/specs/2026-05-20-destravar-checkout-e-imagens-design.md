# Destravar checkout e imagens — design

> **Status em 2026-09-28:** implementado na parte de código; a limpeza de `tool_image` não foi verificada. O merge de `origin/main` entrou em `293d409` e `branch.is_default` não existe mais em `packages/db/src/schema/inventory.ts`. O `DELETE FROM tool_image` é operação de banco sem rastro no repositório (não verificado). `lib/default-branch.ts` foi removido depois, em `a096c28`, pelo `2026-05-20-estoque-multi-filial-design.md`.

**Data:** 2026-05-20
**Branch:** `feat/melhorias-pages-2`
**Issues relacionados:** [#28](https://github.com/othavioquiliao/emach-ecommerce/issues/28) (parcial), PR [#29](https://github.com/othavioquiliao/emach-ecommerce/pull/29) (já em `main`)

## Contexto

Dois incidentes P0 simultâneos no storefront:

1. **Checkout quebrado em runtime.** O dashboard dropou `branch.is_default` no banco compartilhado. Este repo ainda referencia a coluna em `lib/default-branch.ts:11` (via Drizzle) e `packages/db/src/schema/inventory.ts:23`. A correção (PR #29) já foi mergeada em `main` mas a branch de trabalho `feat/melhorias-pages-2` está atrás — não tem o hotfix. Sintoma: `column "is_default" of relation "branch" does not exist` na criação de pedido.

2. **Imagens 404 em home/PLP/PDP.** Investigação no banco e no bucket Supabase revelou:
   - `tool_image` tem 17 registros criados em 2026-05-20 20:34:49 UTC, todos com URLs `seed-<slug>-N.jpg`.
   - Esses arquivos **nunca existiram** no bucket `tool-images`.
   - O bucket tem 61 arquivos UUID `.webp`/`.png` (uploads históricos do dashboard) — todos órfãos, sem mapeamento determinístico para produtos.
   - Não há arquivos `seed-*.jpg` em nenhum lugar do repo.

   Causa raiz: alguém rodou um seed em `tool_image` que escreveu URLs mas **não fez upload dos arquivos correspondentes**.

O bug funcional do estoque multi-filial descrito no issue #28 (storefront roteia tudo para uma filial em vez de somar todas) **fica adiado** — será spec separado posteriormente. _Nota 2026-09-28: o spec separado é `2026-05-20-estoque-multi-filial-design.md` (issue #30, ADR-0003), já implementado._ O hotfix da PR #29 já preserva o comportamento atual (filial única via env / fallback "mais antiga"), o que basta para destravar produção.

## Arquitetura — duas etapas independentes

### Etapa 1 — Sincronizar com `main`

Trazer `origin/main` para `feat/melhorias-pages-2`. Estratégia: `git merge origin/main` (preserva histórico de ambos os ramos). Após o merge, o repo passa a refletir o estado real do banco compartilhado (sem `branch.isDefault` no schema, com fallback determinístico em `default-branch.ts`).

Conflitos esperados: baixos. A branch só tem 2 commits a mais que o merge-base (`ac2122a feat: add category images and enhance product display`, `4f1062b feat: ajustar sessão de categorias`); os arquivos que mudam em `main` são `packages/db/src/schema/inventory.ts` e `apps/web/src/lib/default-branch.ts` — sem sobreposição com os commits da branch.

### Etapa 2 — Limpar `tool_image`

```sql
DELETE FROM tool_image;
```

Os 17 registros são todos URLs quebradas. Não há valor em manter. Após o delete:

- O storefront passa a renderizar produtos **sem imagem** (queries usam subselect `LIMIT 1`, então `primary_image_url = NULL`). Verificar que componentes (`ProductCard`, `ProductGallery`, `CategoryGrid`) já tratam `null` graciosamente (fallback visual ou ausência). Se não tratam, este spec não cobre — abrir issue de UI.
- Os 61 arquivos órfãos no bucket ficam onde estão (não vamos deletar). Custo de armazenamento é desprezível e podem servir como "estoque" caso reaproveite via re-upload.
- Próxima ação (fora deste spec): o user re-sobe imagens via dashboard, produto a produto. O dashboard escreve `tool_image` com URLs UUID corretas.

## Componentes

| Arquivo | Mudança |
|---|---|
| `packages/db/src/schema/inventory.ts` | Receberá da merge: remoção de `isDefault: boolean(...)` e do `uniqueIndex("branch_is_default_unique")` |
| `apps/web/src/lib/default-branch.ts` | _(removido em `a096c28`, ADR-0003)_ Receberia do merge: passa a ler `process.env.ECOMMERCE_DEFAULT_BRANCH_ID` com fallback `ORDER BY created_at ASC LIMIT 1` |
| Banco (via MCP Supabase) | `DELETE FROM tool_image` |

Nenhum código novo é escrito neste spec — é puramente merge + comando SQL.

## Fluxo de dados após o fix

```
Storefront (renderização):
  page.tsx / catalog.ts → tool_image (vazio) → primary_image_url = NULL
  → ProductCard / Gallery exibem fallback (sem imagem)

Storefront (checkout):
  create-order.ts → getDefaultBranchId()
    → process.env.ECOMMERCE_DEFAULT_BRANCH_ID (se setado)
    → senão: branch.created_at ASC LIMIT 1
    → place-order debita estoque dessa filial (como antes)
    (_Nota 2026-09-28: fluxo substituído. `getDefaultBranchId` foi removido e `placeOrder` não debita mais estoque nem escolhe filial; ver ADR-0003._)

Dashboard (re-upload de imagens, manual):
  admin abre produto → upload → bucket UUID + INSERT em tool_image
  → next revalidate (3600s PDP, 600s home) propaga em até 1h
```

## Erros e edge cases

- **Conflito de merge inesperado:** se aparecer (improvável), resolver preservando o estado de `main` para `inventory.ts` e `default-branch.ts` — são a fonte de verdade do hotfix.
- **`ECOMMERCE_DEFAULT_BRANCH_ID` não setada:** fallback "mais antiga" funciona, mas pode escolher filial diferente da que era `is_default = true`. Após o merge, conferir qual filial está sendo usada e setar a env explícita em produção se necessário (não bloqueia este spec).
- **Componentes que não tratam `primary_image_url = null`:** se quebrarem visualmente após o `DELETE`, abrir issue de UI separado. O spec assume tratamento gracioso (a ser verificado em smoke).
- **Cache stale:** home tem `revalidate = 600`, PDP `revalidate = 3600`. _Nota 2026-09-28: a home segue com `cacheLife({ revalidate: 600 })` em `apps/web/src/app/(shop)/page.tsx`; o PDP hoje usa `use cache` (valor não verificado)._ Pode demorar até 1h pra propagar. Sem invalidação manual (não vale a pena para imagens que estavam quebradas).

## Testes / verificação

- `bun check-types` no monorepo após merge.
- `bun --cwd packages/db db:check-drift` para confirmar que schema Drizzle bate com o DB.
- `bun dev:web` e smoke nas rotas `/`, `/catalog`, `/product/[qualquer-slug]` — confirmar que renderiza sem erro e produtos aparecem (sem imagem ok).
- Smoke de checkout: adicionar item ao carrinho e finalizar — esperar criação de pedido sem erro de coluna.

## Non-goals

- Implementar regra de estoque multi-filial (issue #28 fica aberto para spec dedicado).
- Mudar contrato de `order.branchId` ou `stock_movement` (manter como está).
- Re-upload das imagens (ação manual do user via dashboard, fora deste spec).
- Limpar os 61 arquivos órfãos do bucket (custo desprezível, podem ser reaproveitados).
- Investigar quem rodou o seed quebrado de `tool_image` (forensics não bloqueia o fix).

## Definition of done

- [ ] Merge `origin/main` aplicado em `feat/melhorias-pages-2`.
- [ ] `bun check-types` passa em todos os workspaces.
- [ ] `DELETE FROM tool_image` executado via MCP Supabase.
- [ ] Smoke nas rotas `/`, `/catalog`, `/product/[slug]` — sem erro, sem imagens quebradas (placeholder ou ausência).
- [ ] Smoke de checkout — pedido criado sem erro de coluna.
- [ ] (Opcional, follow-up) User re-sobe imagens via dashboard.
