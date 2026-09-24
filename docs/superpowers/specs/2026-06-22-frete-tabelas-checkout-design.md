# Frete por tabelas no checkout — substituir SuperFrete

**Relacionado:** dashboard#242 (motor de frete) · storefront#160 (coordenação) · roadmap "frete fail-open"
**Data:** 2026-06-22
**Status:** obsoleto. Substituído pela Frenet (`2026-07-02-frenet-cotacao-design.md`, código em `apps/web/src/lib/frenet/`); as tabelas `carrier*` já não existem no banco.

## Contexto e motivação

O dashboard entregou (PR #242, mergeado) um motor de cotação de frete por **tabelas próprias negociadas** (transportadora × zona de CEP × faixa de peso) que consolida múltiplos itens em caixas reais antes de cotar — resolvendo o "4 furadeiras ≠ 4× o frete". O motor + reads chegaram ao storefront via sync (#163):

- `@emach/db/queries/shipping-quote.ts` — `quoteShipping` (puro), `packItems`, tipos (`QuoteItem`, `QuoteResult`, `QuoteCarrier`, `UnquotableReason`).
- `@emach/db/queries/shipping.ts` — `getActiveCarriersWithTables(db)`, `getActiveBoxes(db)`.

Hoje o checkout cota via **SuperFrete** (API externa). Esta mudança **substitui o SuperFrete pelo motor de tabelas** no checkout e na calculadora de frete da página de produto.

## Decisões (aprovadas)

1. **Substituição total.** O motor de tabelas vira a única fonte. Sem cobertura → "Frete a combinar". SuperFrete removido.
2. **`out_of_catalog` → sempre "a combinar".** Item que não cabe em nenhuma caixa cadastrada vira "Frete a combinar", **ignorando** `tool.overweightShippingAmount` (simplifica o adapter; aceita-se a perda do frete fixo por item).
3. **Política de seguro da loja obsoleta.** `store_settings.shipping_insurance_policy` (`none`/`cart_value`/cap) era específica do SuperFrete. No motor de tabelas, GRIS/ad valorem são sobretaxas do **carrier**. Mantém-se a coluna (dashboard-owned), mas o fluxo de tabelas não a consome — passa o subtotal do carrinho como `declaredValue`.

## Arquitetura — adapter drop-in

Novo `apps/web/src/lib/shipping/quote.ts` que expõe a **mesma assinatura de retorno** do `lib/superfrete/quote.ts` atual (`Promise<{ negotiate: boolean; options: ShippingOption[] }>`), tornando a troca um drop-in nos consumidores.

```ts
// lib/shipping/quote.ts (server-only)
export async function quoteShipping(input: {
  destinationCep: string;
  items: { toolId: string; quantity: number }[];
  declaredValueCents?: number;
}): Promise<{ negotiate: boolean; options: ShippingOption[] }>
```

Fluxo:
1. `getActiveCarriersWithTables(db)` + `getActiveBoxes(db)` (paralelo).
2. Query nos tools (`inArray(tool.id, ids)`): `weightKg`, `lengthCm`, `widthCm`, `heightCm`, `packagingWeightKg`, `stackable`, `shipsInOwnBox` → monta `QuoteItem[]` (expandindo por `quantity` é feito pelo motor via `qty`).
3. Chama `quoteShipping` (motor puro de `@emach/db`) com `{ items, destinationCep, declaredValue: subtotalCarrinho, carriers, boxes }`.
4. Mapeia `QuoteResult`:
   - `result.options` (`{carrierId, carrierName, amount, deliveryDays}`) → `ShippingOption` (`{carrierId, name: carrierName, company: carrierName, priceCents: round(amount*100), deliveryDays: deliveryDays ?? 0}`), ordenado por preço.
   - `result.options.length === 0` (todos `unquotable`/`out_of_catalog`) → `{ negotiate: true, options: [] }`.

**Nota:** colisão de nome — ambos os módulos exportam `quoteShipping`. O adapter (`lib/shipping/quote.ts`) consome o motor (`@emach/db/queries/shipping-quote`) com import qualificado/aliased para evitar confusão.

## Tipo `ShippingOption`

Move de `lib/superfrete/types.ts` para `lib/shipping/types.ts`:

```ts
export interface ShippingOption {
  carrierId: string;   // era serviceId: number
  company: string;
  deliveryDays: number;
  name: string;
  priceCents: number;
}
```

Validação no place-order é **por preço** (tolerância), não por id — trocar `serviceId`→`carrierId` é seguro.

## Consumidores (trocam import + `serviceId`→`carrierId`)

| Arquivo | Mudança |
|---|---|
| `_actions/quote-shipping.ts` | import `@/lib/shipping/quote`; validação de input inalterada |
| `_lib/place-order.ts` | import `@/lib/shipping/quote`; **revalidação inalterada** (re-cota + tolerância de preço + `shippingUnverified`) |
| `_components/shipping-options.tsx` | `serviceId`→`carrierId` (key/seleção) |
| `_components/checkout-content.tsx` | tipo `ShippingOption` do novo path |
| `components/freight-calculator.tsx` | tipo + `carrierId`; herda a action (1 item) |

## Segurança — frete fail-open resolvido

O `assertShippingQuoted` (place-order) re-cota no servidor e exige que o `shippingCents` do cliente bata com uma opção re-cotada (tolerância). Com o motor **local e determinístico**, a re-cotação não depende mais de API externa instável: `shippingUnverified` só dispara se a query DB falhar (raro), não por SuperFrete down. Isso fecha o item "frete fail-open" do roadmap — sem coluna nova (a flag `shippingUnverified` já existe).

## Edge cases → "Frete a combinar" (`negotiate: true`)

- Nenhum carrier ativo cadastrado.
- Nenhuma zona cobre o CEP de destino (todos carriers `no_zone`).
- Nenhuma faixa de peso aplicável (`no_rate`).
- Item não cabe em nenhuma caixa (`out_of_catalog`).
- Carrinho vazio → barrado na validação de input (já existe).

## Cleanup (mexe em config — confirmado no design)

- Remover `apps/web/src/lib/superfrete/` (client.ts, quote.ts, types.ts + testes).
- Remover env vars `SUPERFRETE_TOKEN`/`SUPERFRETE_BASE_URL`/`SUPERFRETE_USER_AGENT` do schema Zod (`packages/env`) **e** da Vercel (senão `bun check:env` falha no CI — env obrigatória removida do schema precisa sair da Vercel também).
- Remover `lib/origin-branch.ts`/`getOriginBranchCep` se sem outros consumidores (o motor cota por zona de **destino**, não usa origem). `env.DEFAULT_BRANCH_ID` — verificar se algum outro fluxo usa antes de remover.

## Testes

- **Motor:** 25 testes já vieram no sync (puro) — não duplicar.
- **Adapter** (`lib/shipping/quote.ts`): extrair a parte pura (mapeamento `QuoteResult`→`ShippingOption` + regra de `negotiate`) para `lib/shipping/map.ts` e testar sem DB (vitest node). A parte com DB (montagem de `QuoteItem` a partir dos tools) é coberta pelo smoke.
- **`place-order.shipping.test.ts`:** adaptar (já mocka `quoteShipping`; trocar o path do mock + shape).
- **Smoke visual** (CLAUDE.md): `bun dev:web`, checkout com CEP coberto pela zona seed → opções aparecem; CEP fora → "Frete a combinar". Há seed (1 carrier, 2 zonas, 6 faixas, 4 caixas).

## Fora de escopo / rollout

- Cadastrar transportadoras/tarifas/caixas **reais** de produção (dashboard `/dashboard/shipping`) — sem isso, produção cota só pela zona seed ou cai em "a combinar".
- UI de admin de frete — já entregue no dashboard (#242).
- Nenhuma mudança de schema (tudo já sincronizado).
