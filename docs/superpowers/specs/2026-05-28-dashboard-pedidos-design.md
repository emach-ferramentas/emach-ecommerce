# Design — `/dashboard/*` de pedidos 100% funcional

> **Status em 2026-09-28:** implementado. Lista, detalhe, timeline, cancelar, avaliar, comprar novamente e devolução rodam com dados reais (`apps/web/src/app/dashboard/pedidos/`, `apps/web/src/app/dashboard/reembolso/`, `apps/web/src/lib/orders/`, `apps/web/src/lib/refunds/`; PRs #36 e #39). O que segue stub, como o spec previa, é o pagamento: `/dashboard/pedidos/[id]/pagar` mostra Pix, boleto e cartão com dados mock (`TODO(asaas)` em `pagar/_components/payment-methods.tsx`) e não há integração Asaas nem `createPaymentAction`.

> Status: aprovado no brainstorming (2026-05-28). Substitui os mocks de pedidos/devolução por dados reais, alinhado ao schema existente e pronto para o gateway **Asaas** (pagamento + NF-e).

## 1. Contexto e objetivo

A área logada do cliente (`/dashboard/*`) tem 4 telas. Hoje:

| Rota | Estado atual |
|---|---|
| `/dashboard/pedidos` | Mock (`_lib/mock-orders.ts`) |
| `/dashboard/pedidos/[id]` | Mock (`_lib/mock-order-detail.ts`) |
| `/dashboard/reembolso` | Mock (`_lib/mock-refunds.ts`) — **sem tabela no banco** |
| `/dashboard/dados-pessoais` | **Real** (já conectado a `client` + `clientAddress`) |

Todas as ações do pedido são `toast.info("…: em breve")`.

_Nota 2026-09-28: a tabela e o parágrafo acima descrevem o ponto de partida. Os mocks (`dashboard/_lib/mock-*.ts` e `types.ts`) foram removidos nos PRs #36 e #39; as quatro rotas leem dados reais._

**Objetivo:** ligar pedidos, detalhe, avaliação e devolução aos dados reais; deixar pagamento como stub pronto pro Asaas. A UI mockada (tabs, stepper, badges, totais) é rica e bem-acabada — **preservar o visual**, trocar a fonte de dados.

Referência de leitura real já existente: `apps/web/src/app/(shop)/pedidos/[number]/page.tsx` (confirmação pós-checkout) lê `order`/`orderItem` direto via `db`.

## 2. Banco de dados — o que já existe

- **`order`** (9 status): `pending_payment, paid, preparing, shipped, delivered, canceled, refunded, payment_failed, returned`. Timestamps por transição (`paidAt, shippedAt, deliveredAt, canceledAt, preparingAt, returnedAt, refundedAt`), `paymentMethod`/`paymentProviderRef`/`paymentReceiptUrl`, `shippingMethod`/`shippingTrackingCode`, NFe (`nfeNumber/nfeUrl/nfeXmlUrl/nfeStatus`), `shippingAddress` (snapshot JSON), `notes`.
- **`orderItem`**: snapshot completo (SKU, name, model, voltage, unitPrice, quantity, lineTotal, NCM/CEST, peso/dimensões).
- **`orderStatusHistory`**: timeline real (from/to status, `actorType`, `actorUserId`, `reason`, `createdAt`). CHECK `actor_coherence`.
- **`orderNote` / `orderAttachment`**: notas internas + anexos.
- **`review`**: por `(toolId, clientId, orderId)` único, fluxo de moderação `pending→approved/rejected/spam`. Regra `canCreateReview` (`packages/db/src/queries/reviews.ts`): exige order pago, dentro de 90d de `paidAt`, item no pedido, ainda não avaliado.

**Não existe** entidade de solicitação de devolução — `refunded`/`returned` são só status do `order`.

_Nota 2026-09-28: a entidade existe hoje. `refundRequest` (tabela `refund_request`) mais os enums `refundReasonEnum` e `refundStatusEnum` estão em `packages/db/src/schema/orders.ts`, chegaram por sync do dashboard (#37, #44, #45) e o storefront lê e insere nela._

## 3. Decisões do brainstorming

1. **Escopo:** pedidos reais + avaliação + devolução (schema novo). Pagamento fica `pending_payment`, com **stub do fluxo Asaas** desenhado.
2. **Tabs (5, por fase):** Todos · A pagar · Em preparação · A caminho · Concluídos. Cancelados/reembolsados/devolvidos aparecem só em "Todos" (com badge), sem tab própria.
3. **Mapa de status → badge** (rótulo + cor):
   - `pending_payment` → "Aguardando pagamento" (cinza)
   - `payment_failed` → "Pagamento falhou" (vermelho Ferrari — único caso de erro/ação)
   - `paid` → "Pagamento confirmado" (azul)
   - `preparing` → "Em preparação" (roxo)
   - `shipped` → "A caminho" (ciano)
   - `delivered` → "Entregue" (verde)
   - `canceled` → "Cancelado" (cinza-escuro)
   - `refunded` → "Reembolsado" (âmbar)
   - `returned` → "Devolvido" (âmbar)
   - Agrupamento em tabs: A pagar = `pending_payment`+`payment_failed`; Em preparação = `paid`+`preparing`; A caminho = `shipped`; Concluídos = `delivered`.
4. **Rastreio (híbrido):** stepper horizontal no topo (visão rápida) + "ver histórico completo" expande a timeline vertical real lida de `orderStatusHistory` (data + motivo por transição).
5. **Cancelar pedido:** self-service só em `pending_payment`/`payment_failed`. Seta `canceled` + insere `orderStatusHistory` (`actorType='system'`, `actorUserId=null`, `reason="Cancelado pelo cliente"`).
6. **Pagar agora:** rota stub `/dashboard/pedidos/[id]/pagar` com **Pix + Boleto + Cartão** (os 3), dados mock, pronta pro webhook Asaas. Sem confirmação real ainda.
7. **Avaliar:** por item, em **sheet** no detalhe de pedido concluído. Estrelas + título + texto → `review` status `pending`. Valida `canCreateReview`.
8. **Devolução:** **pedido inteiro** (sem itens parciais), **categoria simples** (sem trava de prazo rígida — staff decide no dashboard), elegível em `shipped` **ou** `delivered`. 1 solicitação aberta por pedido.
   _Nota 2026-09-28: "aberta" hoje é `ACTIVE_REFUND_STATUSES` (`requested`, `under_review` e `approved`), exportada por `packages/db/src/schema/orders.ts` (#96)._
9. **Acesso a dados:** import `db` direto em Server Component (segue o código existente). `CLAUDE.md` será atualizado depois pra remover a regra obsoleta.
   _Nota 2026-09-28: `lib/orders/queries.ts`, `lib/refunds/queries.ts` e as actions importam `db` de `@emach/db` como decidido. A regra antiga do `CLAUDE.md` da raiz ("`apps/web` nunca importa `@emach/db` diretamente em rota autenticada") saiu na revisão de 2026-09-28._
10. **Queries de leitura:** inline em `apps/web` (não no pacote owned-by-dashboard).

## 4. Arquitetura

- **Leitura:** Server Components com `import { db } from "@emach/db"` + drizzle, guarda `requireCurrentClient()`.
- **Escrita:** server actions `"use server"` → guarda de sessão → Zod → `ActionResult<T>` (`{ ok: true; data } | { ok: false; error }`) → `log.error({ action, ...ctx })` no catch (sem `console`).
- IDs `crypto.randomUUID()` no caller; money `numeric`; sem barrel files; `key` estável.
- **Animação:** entradas sutis (timeline revelando, progresso do stepper) com `motion` (verificar se instalado; instalar se ausente). Restrição Ferrari do `DESIGN.md` — movimento discreto, não decorativo.
  _Nota 2026-09-28: o pacote instalado é `framer-motion` (`apps/web/package.json`), e nenhum arquivo de `app/dashboard/` o importa. A timeline é um bloco expansível sem animação de entrada (`order-tracking.tsx`)._

## 5. Módulo de status — `apps/web/src/lib/orders/status.ts` (novo)

Substitui `dashboard/_lib/types.ts` (enum de 5) pelo enum real de 9 importado de `@emach/db/schema/orders`.

```ts
export const ORDER_STATUS_BADGE: Record<OrderStatus, { label: string; tone: BadgeTone }>
export const ORDER_TABS = ["all","a_pagar","em_preparacao","a_caminho","concluidos"] as const
export const TAB_STATUSES: Record<OrderTab, OrderStatus[] | "all">
export function statusToTab(s: OrderStatus): OrderTab
export function orderStepState(status, history): StepState[]   // p/ stepper híbrido
```

_Nota 2026-09-28: a API real de `apps/web/src/lib/orders/status.ts` é `ORDER_STATUS_BADGE`, `ORDER_TABS`, `ORDER_TAB_LABEL`, `statusToTab` (devolve `null` para cancelado, reembolsado e devolvido), `countByTab`, `STEPPER_PHASES`, `stepStateFor`, `orderStepDisplayState` e `isTerminalNegative`. Não existem `TAB_STATUSES` nem `orderStepState`; o `history` não entra no cálculo do stepper, só na timeline._

## 6. Schema novo — `refund_request` (owned-by-dashboard)

Definido aqui; **o PR vai no `emach-dashboard`**, sync por CI traz pra cá (ADR-0009). Consumo no ecommerce só funciona após o sync — ver sequenciamento (§11).

```ts
// packages/db/src/schema/refunds.ts  (criar no dashboard)
export const refundReasonEnum = pgEnum("refund_reason", [
  "defeito", "item_errado", "avaria_transporte", "arrependimento", "outro",
]);
export const refundStatusEnum = pgEnum("refund_status", [
  "requested", "under_review", "approved", "refunded", "rejected",
]);

export const refundRequest = pgTable("refund_request", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => order.id, { onDelete: "restrict" }),
  clientId: text("client_id").notNull().references(() => client.id, { onDelete: "restrict" }),
  reasonCategory: refundReasonEnum("reason_category").notNull(),
  reasonText: text("reason_text"),
  status: refundStatusEnum("status").notNull().default("requested"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),  // snapshot do total
  asaasRefundRef: text("asaas_refund_ref"),
  rejectionReason: text("rejection_reason"),
  actorType: actorTypeEnum("actor_type").notNull(),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("refund_request_client_idx").on(t.clientId, t.requestedAt.desc()),
  index("refund_request_order_idx").on(t.orderId),
  // 1 solicitação ABERTA por pedido
  uniqueIndex("refund_request_one_open_per_order")
    .on(t.orderId).where(sql`${t.status} IN ('requested','under_review')`),
  check("refund_actor_coherence", sql`(
    (${t.actorType} = 'user'   AND ${t.actorUserId} IS NOT NULL) OR
    (${t.actorType} = 'system' AND ${t.actorUserId} IS NULL))`),
]);
```

Solicitação criada pelo cliente usa `actorType='system'` (cliente não é staff `user`).

_Nota 2026-09-28: a tabela chegou por sync e vive em `packages/db/src/schema/orders.ts` (não em `refunds.ts`). Divergências do bloco acima: os timestamps são `withTimezone`, e o índice parcial `refund_request_one_open_per_order` cobre `ACTIVE_REFUND_STATUSES` (`requested`, `under_review`, `approved`), não só os dois primeiros._

## 7. Rotas e componentes

### `/dashboard/pedidos` (lista)
- `page.tsx` (RSC): busca pedidos do `client` (order + resumo de itens + 1ª imagem) e contadores por tab; passa pro `OrdersTabs`.
- `OrdersTabs` continua client (tabs do shadcn), mas recebe dados reais por props em vez de `getOrdersByTab` mock.
- Empty state já existe.

### `/dashboard/pedidos/[id]` (detalhe)
- `page.tsx` (RSC): `order` + `orderItem[]` + `orderStatusHistory[]` (+ `refundRequest` se houver) do client logado; `notFound()` se não pertence.
- Reaproveita componentes (`order-detail-header`, `buyer-info`, `shipping-address`, `order-totals`, `order-items`, `order-tracking`, `order-actions`) — adaptar tipos do mock → tipos reais.
- `order-tracking` vira híbrido: stepper derivado do status + bloco expansível com a timeline de `orderStatusHistory`.
- NF-e: botão "Baixar nota fiscal" quando `nfeUrl` presente (hoje em `order-documents.tsx`, que também trata `nfeXmlUrl`).
- Comprador lido ao vivo do `client`, documento mascarado.

### `/dashboard/pedidos/[id]/pagar` (nova — stub Asaas)
- RSC valida pedido pendente do client. Client component com tabs Pix/Boleto/Cartão, dados mock, resumo lateral. `// TODO: Asaas` no ponto de geração da cobrança.

### `/dashboard/reembolso` (lista)
- RSC lê `refundRequest` do client; tabs "Em andamento" (`requested`,`under_review`) / "Finalizado" (`refunded`,`rejected`). Componentes de card/badge já existem (adaptar tipos).

### Sheets
- **Avaliar** (no detalhe, pedido `delivered`): por item, estrelas+título+texto.
- **Solicitar devolução** (no detalhe, `shipped`/`delivered`): categoria + texto, confirma total.

## 8. Server actions (`apps/web/src/app/dashboard/pedidos/_actions/`)

```ts
cancelOrderAction(orderId): ActionResult
  // valida ownership + status ∈ {pending_payment, payment_failed}
  // tx: update order.status=canceled, canceledAt; insert orderStatusHistory(system)

createReviewAction({ orderId, toolId, rating, title, body }): ActionResult
  // canCreateReview(db, {clientId, orderId, toolId}); insert review status=pending

requestRefundAction({ orderId, reasonCategory, reasonText }): ActionResult
  // valida ownership + status ∈ {shipped, delivered} + sem request aberta
  // insert refundRequest(amount = order.totalAmount, actorType=system)

rebuyAction(orderId): ActionResult<{ added: number; skipped: number }>
  // re-adiciona itens disponíveis ao cart; pula sem estoque/variante removida

createPaymentAction(orderId, method): ActionResult   // STUB
  // mock; // TODO: integrar Asaas (cobrança + webhook → paid)
```

Todas: `"use server"`, guarda, Zod, `log.error`, `revalidatePath`.

_Nota 2026-09-28: divergências no código atual (`_actions/orders.ts`, `refunds.ts`, `reviews.ts`)._
- _As actions recebem objeto (`{ orderId }`), não argumentos soltos._
- _`cancelOrderAction` (#227) roda em transação, grava `status` no `WHERE` do `UPDATE` contra corrida e devolve o uso do cupom (`promotion.redemptionCount`)._
- _`rebuyAction` não adiciona ao carrinho: devolve `{ items: RebuySnapshot[]; skipped }` e o `rebuy-button.tsx` chama `add` do carrinho no cliente e vai para `/cart`._
- _`requestRefundAction` retorna `ActionResult` de `lib/actions/types.ts` (sem `data`) e bloqueia por `ACTIVE_REFUND_STATUSES`._
- _`createPaymentAction` não existe. O `/pagar` é só UI mock, sem action._

## 9. Decisões menores / defaults

- **Comprar novamente:** adiciona disponíveis ao cart, `toast` sobre indisponíveis, redireciona `/cart`.
- **Rastreio:** mostra `shippingTrackingCode` + `shippingMethod` com botão copiar (sem inventar carrier/URL).
- **"Avaliado":** derivado da existência de `review` por item (não há flag no `order`).
- **Desconto:** `order.discountAmount` hoje é sempre `"0"` (desconto embutido no `unitPrice` via promoção no checkout). Totais refletem isso; mostrar linha de desconto só se `> 0`.
  _Nota 2026-09-28: "sempre `0`" deixou de valer. Com o cupom de checkout, `place-order.ts` grava em `order.discountAmount` o desconto do cupom; o desconto de promoção automática continua embutido no `unitPrice` (ver `CLAUDE.md`). A linha só aparece quando `> 0`, como previsto (`order-totals.tsx`)._

## 10. Fora de escopo (agora)

- Integração real do Asaas (cobrança/webhook/estorno/NF-e) — só o stub e os campos prontos.
- Cancelamento self-service após pago (vai por suporte).
- Devolução parcial por item.
- Trava de prazo CDC automática (staff decide no dashboard).

## 11. Sequenciamento (dependências)

1. **Independente do dashboard (fazer já):** módulo de status, lista, detalhe, timeline, cancelar, avaliar, comprar novamente, stub de pagamento.
2. **Depende do PR no dashboard:** `/dashboard/reembolso` real + `requestRefundAction` só após `refund_request` chegar por sync. Até lá, `/dashboard/reembolso` mostra um empty state honesto ("nenhuma devolução") e o botão "Solicitar devolução" fica oculto no detalhe — sem mock.

_Nota 2026-09-28: o item 2 está resolvido. O sync trouxe `refund_request`, `/dashboard/reembolso` lê `listClientRefunds` e o botão de solicitar devolução aparece no detalhe (`request-refund-button.tsx`)._

## 12. Verificação

- `bun check-types` limpo.
- `bun dev:web` + visitar `/dashboard/pedidos`, `/dashboard/pedidos/[id]`, `/dashboard/pedidos/[id]/pagar`, `/dashboard/reembolso` com um client real que tenha pedidos (smoke SSR — template strings SQL não pegam em type-check, conforme `CLAUDE.md`).
- Verificação visual real antes de declarar concluído (regra de completion claim em UI).
- Stock/price: testar "comprar novamente" com item sem estoque.
