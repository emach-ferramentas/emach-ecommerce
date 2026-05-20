# Estoque multi-filial no checkout — design

**Data:** 2026-05-20
**Issue:** [#30](https://github.com/othavioquiliao/emach-ecommerce/issues/30)
**Branch:** `feat/melhorias-pages-2` (decisão do user)
**Versão:** v2 (v1 assumia "dashboard escreve em preparing" — descoberto que viola o contrato real)

## Contexto

O hotfix PR #29 destravou o checkout removendo a dependência da coluna `branch.is_default`. O bug funcional do issue #28 continua aberto: o storefront escolhe uma única filial ao debitar estoque, ignorando que o estoque agregado de outras filiais pode cobrir o pedido.

**Investigação do contrato compartilhado revelou que o spec v1 estava errado** quanto a quem escreve `stock_movement`. O contrato canônico (`emach-dashboard/docs/integration/admin-ecommerce.md`, mergeado em 2026-05-18) e o ADR-0007 do dashboard são explícitos:

> `stock_movement`: Shared. E-commerce escreve débitos de venda (`saida_venda`, actor `system`) na transição para `paid`.

> `order.branch_id`: Filial de fulfillment. O admin define em `preparing`; o e-commerce pode deixar nulo na criação.

Ou seja:
- **O dashboard NUNCA deveria escrever débito de venda.** Quem escreve é o storefront.
- **O storefront só deveria debitar quando o pedido transitar para `paid`**, não em `pending_payment`.
- **`order.branch_id` pode ser `NULL` na criação** — admin define em `preparing`. Já é nullable no schema.

O storefront atual viola o contrato: debita em `pending_payment` (a única transição que ele faz). Isso aconteceu porque ainda não existe integração de pagamento — não há código que faça `pending_payment → paid`. O débito foi adiantado pra não ficar sem nenhum débito.

ADR-0001 deste repo documentou essa decisão local; agora que o dashboard fixou o contrato (ADR-0007), ADR-0001 precisa ser substituído.

## Decisão

Escopo deste spec:
1. **Tirar o débito do checkout** (storefront para de violar o contrato).
2. **Não implementar `confirmPayment()`** — sem integração de pagamento, escopo prematuro. Fica como TODO documentado no novo ADR.

Quando integração de pagamento for adicionada (issue separado futuro), uma função `confirmPayment(orderId)` será criada pra:
- Resolver filial de débito (regra a definir lá).
- UPDATE stock_level com guarda anti-oversell.
- INSERT stock_movement (actor `system`, reason `saida_venda`).
- UPDATE order SET status='paid', paidAt=now().

Até lá, **vendas não geram movimento de estoque**. Aceitável porque o site está em fase pré-pagamento.

## Arquitetura

```
ANTES (ADR-0001, viola contrato)        DEPOIS (ADR-0003, alinhado)
─────────────────────────────────       ─────────────────────────────
storefront/checkout                     storefront/checkout
  ├─ resolve branchId (env/fallback)     ├─ valida SUM(quantity) >= total
  ├─ INSERT order(branch_id=X)           ├─ INSERT order(branch_id=NULL)
  ├─ UPDATE stock_level WHERE branch=X   └─ (não muta estoque)
  └─ INSERT stock_movement(branch=X)

                                        storefront/confirmPayment (FUTURO, fora deste spec)
                                          ├─ resolve filial
                                          ├─ UPDATE stock_level (guarda anti-oversell)
                                          ├─ INSERT stock_movement (actor='system')
                                          └─ UPDATE order SET status='paid'
```

Schema **não muda** — `order.branch_id` e `stock_movement.branch_id` já são nullable.

## Componentes alterados

| Arquivo | Mudança |
|---|---|
| `apps/web/src/lib/default-branch.ts` | **DELETE** — Não é mais usado em checkout. Quando `confirmPayment()` for implementado, decide a regra de filial lá. (Única referência a `ECOMMERCE_DEFAULT_BRANCH_ID` no código; não estava em `packages/env/src/server.ts` nem `.env.example`.) |
| `apps/web/src/app/checkout/_actions/create-order.ts` | Remove import e uso de `getDefaultBranchId`. Não passa `branchId` para `placeOrder`. Remove `branchId` do `log.error`. |
| `apps/web/src/app/checkout/_lib/place-order.ts` | `placeOrder` perde `branchId` do params. `checkStock` vira `checkAggregateStock` (SELECT GROUP BY por variante). Bloco que muta `stock_level` e insere `stock_movement` é **removido**. `INSERT order` grava `branchId: null`. |
| `apps/web/src/app/checkout/_lib/place-order.test.ts` | Reescrito: 6 cenários multi-filial + teste de documento duplicado. Sem assertions sobre débito ou movement (não acontecem mais). |
| `docs/adr/0003-estoque-multi-filial.md` | **CRIAR** — substitui ADR-0001. Conteúdo: storefront só valida no checkout; débito real fica para a futura integração de pagamento na transição `paid`. |
| `docs/adr/0001-debito-de-estoque-na-criacao-do-pedido.md` | Adiciona no topo: `> **Superseded by [ADR-0003](./0003-estoque-multi-filial.md) em 2026-05-20.**` |

**Não alterado** (auditoria visual confirma que já agrega):
- `packages/db/src/queries/catalog.ts` linhas 344-349 (`getTools`), 552-558 (`getToolBySlug`), 779-784 (`getActivePromotions`) — `SUM(sl.quantity)` sem filtro de branch.

## Algoritmo de validação agregada

```ts
async function checkAggregateStock(
  tx: typeof db,
  lines: PreparedLine[]
): Promise<void> {
  const variantIds = lines.map((l) => l.variant.id);
  const rows = await tx
    .select({
      variantId: stockLevel.variantId,
      total: sql<number>`COALESCE(SUM(${stockLevel.quantity}), 0)::int`,
    })
    .from(stockLevel)
    .where(inArray(stockLevel.variantId, variantIds))
    .groupBy(stockLevel.variantId);

  const totalByVariant = new Map(rows.map((r) => [r.variantId, r.total]));
  for (const line of lines) {
    const total = totalByVariant.get(line.variant.id) ?? 0;
    if (total < line.cartItem.quantity) {
      throw new OrderError(`Sem estoque para ${line.tool.name}`);
    }
  }
}
```

Sem escrita, sem lock. Otimista. Substitui `checkStock(tx, lines, branchId)` linha por linha.

## Fluxo pós-mudança

```
Cliente submete checkout
  → createOrderAction (sem getDefaultBranchId)
      → requireCurrentClient → clientId
      → db.transaction(tx →
          placeOrder(tx, { clientId, input, ipAddress, userAgent })
            ├─ prepareLines: valida preços
            ├─ checkAggregateStock: SUM por variante × todas as filiais
            ├─ update client
            ├─ buildAddressSnapshot
            ├─ insert consent_log
            ├─ nextval order_number_seq
            ├─ insert order (branch_id=NULL, status='pending_payment')
            └─ for line in lines: insert order_item
                                   (sem UPDATE stock_level, sem INSERT stock_movement)
        )
      → return { ok: true, orderId, orderNumber }
```

`stock_level` permanece intacto. Estoque mostrado no site continua refletindo o real até admin processar manualmente.

## Testes (`place-order.test.ts`)

Helpers a adicionar:

- `seedMultiBranch(tx, stockPerBranch[])` → cria 1 client + 1 tool + 1 variant + N filiais com `stock_level` por filial.
- `seedSecondVariant(tx, stockPerBranch[], existingBranchIds)` → adiciona segundo tool/variant nas mesmas filiais.
- `buildInput(items[])` → aceita múltiplos itens.

Cenários:

1. **Filial única com estoque** — pedido 2, filial tem 10. Esperar: `order.branchId IS NULL`, `stock_movement.count == 0`, `stock_level` inalterado.
2. **Duas filiais, agregado suficiente** — 3 + 2, pedido de 4. Esperar: sucesso, ambos `stock_level` inalterados.
3. **Duas filiais, agregado insuficiente** — 3 + 2, pedido de 6. Esperar: `OrderError`.
4. **Variante sem `stock_level`** — pedido 1, zero registros. Esperar: `OrderError`.
5. **Multi-item, uma variante OK e outra não** — A tem 10, B tem 1, pedido A=2 B=5. Esperar: `OrderError`, nada gravado.
6. **Validação otimista — oversell documentado** — agregado 1, dois `placeOrder` consecutivos pedindo 1. Esperar: ambos retornam OK, `stock_level` continua 1. Documenta o trade-off do ADR-0003.

Mantém: teste de documento duplicado (continua válido — independe de estoque).

## ADR-0003 (esboço)

```md
# Estoque multi-filial: storefront valida agregado, débito adiado para integração de pagamento

Storefront valida disponibilidade agregada (`SUM(stock_level.quantity)` por variante em todas as filiais) no checkout, mas não muta `stock_level` nem grava `stock_movement`. `order.branch_id` é NULL na criação. Débito de estoque acontecerá quando a integração de pagamento for implementada, na transição `pending_payment → paid`, conforme o contrato canônico (`emach-dashboard/docs/integration/admin-ecommerce.md` e ADR-0007 do dashboard).

## Considered Options

- **Manter ADR-0001 (débito em pending_payment, filial única):** rejeitado — viola contrato compartilhado e bagunça `stock_movement` quando a venda real veio de outra filial.
- **Implementar `confirmPayment()` agora sem integração de pagamento:** rejeitado — função sem caller é código morto até a integração real chegar. YAGNI.
- **Mover responsabilidade para o dashboard (escrever em `preparing`):** rejeitado — contradiz o ADR-0007 do dashboard, que coloca a responsabilidade no storefront.

## Consequences

- Vendas em produção não geram `stock_movement` até integração de pagamento ser implementada. Admin precisa manualmente debitar/ajustar estoque até lá. Aceitável: site está em fase pré-pagamento.
- Janela de oversell entre pedidos concorrentes: aceita. Sem lock pessimista. Volume não justifica.
- `order.branch_id` fica NULL em pedidos novos. Pedidos antigos com valor preenchido mantêm — sem migration retroativa.
- Quando integração de pagamento for adicionada (issue separado), criar `confirmPayment(orderId)` em `apps/web/src/lib/payment/` (ou similar) que: resolve filial, UPDATE stock_level com guarda, INSERT stock_movement (actor `system`, reason `saida_venda`), UPDATE order SET status='paid', paidAt=now().
```

## Erros e edge cases

- **Variante sem `stock_level`:** trata como 0, rejeita.
- **Promoção/preço:** sem mudança em `prepareLines`.
- **Documento duplicado:** lógica `isDocumentUniqueViolation` inalterada.
- **Histórico:** pedidos antigos com `branch_id` preenchido mantém. Dashboard precisa lidar com ambos.
- **`log.error`:** campo `branchId` no payload fica obsoleto — remover.

## Non-goals

- Implementar `confirmPayment()` ou qualquer lógica de transição para `paid`.
- Integração de gateway de pagamento (Asaas, PIX, etc.).
- Reserva pessimista.
- Distribuição automática multi-filial por item.
- Regra por região/UF.
- Migration retroativa de `order.branch_id`.
- Mudar queries de catálogo (já agregam).
- PR coordenado no dashboard — não é necessário; contrato atual já está correto.

## Definition of done

- [ ] `apps/web/src/lib/default-branch.ts` deletado.
- [ ] `placeOrder` sem `branchId`, sem `stockMovement`, sem `UPDATE stockLevel`. `order.branch_id = null`.
- [ ] `checkStock` substituído por `checkAggregateStock`.
- [ ] `create-order.ts` sem chamada a `getDefaultBranchId`, sem `branchId` no log.
- [ ] `place-order.test.ts` cobre os 6 cenários + documento duplicado.
- [ ] `docs/adr/0003-estoque-multi-filial.md` criado.
- [ ] `docs/adr/0001-debito-de-estoque-na-criacao-do-pedido.md` marcado como superseded.
- [ ] `bun check-types` 6/6, `bun --cwd apps/web test` passa.
- [ ] Smoke: criar pedido via UI → confirmar `order.branch_id IS NULL` e `stock_movement.count == 0` para o pedido criado.
