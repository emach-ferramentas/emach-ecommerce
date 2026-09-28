# Promoção em destaque no home — design

> **Status em 2026-09-28:** implementado. A coluna `featured` existe na cópia de schema (`packages/db/src/schema/promotions.ts:36`, índice `:61`, check `:83`), `getFeaturedPromotion` vive em `packages/db/src/queries/promotions.ts:162`, e a home renderiza `PromoHighlight` (`apps/web/src/components/promo-highlight.tsx`) com `PromoCountdown` (`promo-countdown.tsx`) em `apps/web/src/app/(shop)/page.tsx`. O layout dos produtos passou a variar por contagem (spec `2026-06-24-promo-section-adaptive-layout-design.md`) e a seção "Marca" foi trocada pelo mapa "Onde estamos". A Parte A (dashboard) não foi verificada: este repo não lê o `emach-dashboard`.

> Data: 2026-06-08 · Escopo: cross-repo (`emach-dashboard` + `emach-ecommerce`)
> Brainstorming + impeccable (companion visual). Identidade Ferrari preservada (DESIGN.md).

## Problema

A home tem uma seção de promoções (`apps/web/src/app/(shop)/page.tsx:150-165`, label
"02 · Ofertas"), mas ela **renderiza condicionalmente** e está invisível: nenhuma promoção
`type='promotion'` está válida no banco.

Estado do banco (2026-06-08):

| Promoção | type | active | janela | situação |
|---|---|---|---|---|
| Liquidação de Ferramentas Elétricas | promotion | true | 13/05 → 03/06 | **expirou** |
| Promoção Black Friday | promotion | false | 19/06 → 22/06 | futuro + inativa |

As outras 5 promoções são `promocode` (cupom) e não alimentam o home. A query
`getActivePromotions` exige `active=true` **e** `now()` dentro de `[starts_at, ends_at)`.
Nenhuma passa → `promoTools=[]` → a seção some.

Além disso, mesmo quando havia dado, a seção era um `ProductCarousel` **visualmente idêntico**
ao de "Novidades" (mesmo `bg-gray-10`), sem urgência nem peso comercial. E o home agrega
**todas** as promoções ativas num pool único de produtos (`flattenPromoTools`) — não existe
"a promoção em destaque".

### Infra já pronta (não mexer)

O `ProductCard` (`apps/web/src/components/product-card.tsx`) **já renderiza** badge `-XX%`
vermelho (linha 49-53) e preço com desconto + preço original riscado (linha 81-95). A query
`getActivePromotions` já calcula `discountedAmount` por variante. O redesign é de **moldura de
seção** e de **escolha de qual promoção destacar**, não de card.

## Decisões (travadas no brainstorming)

1. **Direção visual:** seção preta cinematográfica + countdown regressivo.
2. **Fonte do destaque:** novo campo `featured` no dashboard (controle editorial do staff),
   **não** inferência. `promotion` é owned-by-dashboard (ADR-0009) → o campo nasce lá.
3. **Exclusividade:** só **1** promoção `featured` por vez (partial unique index + action).
4. **Execução:** implementar os dois lados nesta leva. Banco Supabase é compartilhado;
   adicionar coluna é aditivo/seguro. A cópia de schema no storefront é replicada à mão e
   **conciliada pelo PR de sync oficial** depois.
5. **Kickers:** remover a numeração `01/02/03` (AI tell + estava fora de ordem); usar kicker
   nomeado ("OFERTAS"/"NOVIDADES"/"CATEGORIAS").
6. **Fallback:** sem featured ativa → a seção **não renderiza** (sem moldura vazia).

## A · `emach-dashboard` (fonte de verdade)

### A1. Schema — `packages/db/src/schema/promotions.ts`

Adicionar à tabela `promotion`:

```ts
featured: boolean("featured").notNull().default(false),
```

Constraints novas (no array de `(table) => [...]`):

```ts
// ≤ 1 promoção destacada por vez
uniqueIndex("promotion_single_featured_idx")
  .on(table.featured)
  .where(sql`${table.featured} = true`),
// destaque só vale para promoção automática (cupom não vai pro home)
check(
  "featured_only_promotion",
  sql`${table.featured} = false OR ${table.type} = 'promotion'`
),
```

> Nota: o partial unique index sobre uma coluna booleana só admite **uma** linha
> `featured = true`. Combinado com a action (A4) que desmarca a anterior na mesma transação,
> a troca de destaque é atômica e nunca colide.

Aplicar: `bun db:push` (banco compartilhado) + `bun db:apply-triggers` se o push pedir.

### A2. Tipo de form — `_components/promotion-schema.ts`

`PromotionFormValues` ganha `featured: z.boolean()` (default `false`). Garantir que
`create`/`edit` populem o valor.

### A3. UI — `_components/promotion-form-fields.tsx`

Card com `Switch` (mesmo molde do "Ativa", linha 522-537), **renderizado só quando
`type === 'promotion'`** (esconder para cupom). Posicionar logo após o card "Ativa".

- Label: "Destaque no home"
- Ajuda: "Aparece em destaque no topo da home, com contador regressivo até o fim da vigência.
  Só uma promoção pode ser destaque — marcar esta desmarca a anterior."

### A4. Action — `actions.ts` (create + update)

Ao persistir com `featured === true`, dentro da **mesma transação**:

```sql
UPDATE promotion SET featured = false WHERE featured = true AND id <> $current;
```

antes de gravar a atual. Rede de segurança que mantém o índice de A1 nunca violado e dá a
semântica "marcar esta desmarca a anterior".

### A5. Listagem (opcional) — `_components/promotion-card.tsx`

Badge "Destaque" no card da promoção que estiver `featured`, para o staff enxergar qual é a
ativa de uma olhada.

## B · `emach-ecommerce` (storefront)

### B1. Cópia de schema — `packages/db/src/schema/promotions.ts`

Replicar A1 à mão (coluna + índice + check). **Comentar no topo da mudança** que é cópia
antecipada de uma alteração owned-by-dashboard e que o PR de sync (`sync-db-schema.yml`)
concilia. Não rodar `db:push` aqui (o dashboard já aplicou no banco compartilhado).

### B2. Query — `packages/db/src/queries/promotions.ts`

Nova `getFeaturedPromotion(db): Promise<PromotionWithTools | null>`:

- `SELECT ... FROM promotion WHERE featured = true AND type = 'promotion' AND active = true
  AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
  LIMIT 1`.
- Reusar o bloco de carregamento de tools de `getActivePromotions` (escopo `applies_to_all`
  vs `promotion_tool`, cálculo de `discounted_amount`, `STOREFRONT_STATUS_SQL`,
  `visible_on_site`).
- Sem linha, ou com `tools: []` → retornar `null` (a seção depende de ter produtos).

> Owned-by-dashboard: a query vive em `packages/db/src/queries` (cópia versionada). Replicar a
> assinatura/estilo de `getActivePromotions` e marcar como cópia antecipada igual a B1.

_Nota 2026-09-28: o `catalog.ts` foi dividido (PR #157). A função mora hoje em `promotions.ts`, reusa o helper privado `fetchPromoTools` e ordena por `ends_at ASC NULLS LAST` antes do `LIMIT 1`. O sync do dashboard já a incorporou._

### B3. Componente `<PromoHighlight>` (server) — `apps/web/src/components/promo-highlight.tsx`

Seção preta (`bg-black text-white`), full-bleed com `PageContainer`:

- Header em 2 colunas: à esquerda kicker `SectionLabel` "OFERTAS" + `<h2>` `promotion.title`
  (Barlow Condensed, 44px, weight 500, branco); à direita `<PromoCountdown>`.
- Corpo: `ProductCarousel`/grid com os produtos da promoção (ProductCard inalterado). _Nota 2026-09-28: o corpo hoje escolhe o arranjo por `selectPromoLayout` (2, 3 ou 4 produtos; menos de 2 não renderiza), ver spec `2026-06-24-promo-section-adaptive-layout-design.md`._
- CTA "Ver todas as ofertas" → `/catalog?promo=1` (`Link` com `emachButtonVariants({ variant: "outline-light" })`; o parâmetro `promo=1` é lido em `catalog/_lib/parse-search-params.ts`).
- Sem `ends_at` → renderiza sem o bloco de countdown.

### B4. Componente `<PromoCountdown>` (client) — `apps/web/src/components/promo-countdown.tsx`

- Props: `endsAt: string` (ISO; o server passa `endsAt.toISOString()`). A conta mora em `apps/web/src/lib/countdown.ts` (`formatCountdown`).
- Conta `dd : hh : mm : ss`. Tick de 1s via `setInterval` em `useEffect`.
- **SSR-safe:** primeiro paint estático (ex.: rótulo "Termina em" + placeholder ou os valores
  calculados só após mount) para evitar hydration mismatch entre relógio do server e do client.
- Expira (`endsAt <= now`) → componente some (ou rótulo "Encerrada"); `<PromoHighlight>` já não
  renderiza promoções fora da janela, então isto cobre só o caso de expirar com a aba aberta.
- Dígitos em Ferrari Red (`text-emach-red`); rótulos "dias/hrs/min/seg" em Barlow Condensed
  uppercase, `text-white/55`.
- `@media (prefers-reduced-motion: reduce)`: sem pulse/blink nos separadores.

### B5. Home — `apps/web/src/app/(shop)/page.tsx`

- Trocar `getActivePromotions(db, 8)` + `flattenPromoTools` por `getFeaturedPromotion(db)`.
  Remover o helper `flattenPromoTools` (e o import de `getActivePromotions` se ficar órfão).
  _Nota 2026-09-28: feito. `getActivePromotions` segue exportada, mas só o teste `packages/db/src/queries/__tests__/catalog-promotions.test.ts` a chama; nenhum código de `apps/web` a usa._
- Remover os números dos kickers: "OFERTAS", "NOVIDADES", "CATEGORIAS".
- Renderizar `<PromoHighlight promotion={featured} />` só se `featured != null`.
- **Reordenar (chiaroscuro)** — separável, ver abaixo:
  `Hero(preto) → Categorias(claro) → PromoHighlight(preto) → Novidades(claro) → Marca(preto)`.

## C · Dado de demo (dev, via SQL)

```sql
UPDATE promotion
SET featured = true, active = true, ends_at = now() + interval '7 days'
WHERE title = 'Liquidação de Ferramentas Elétricas';
```

Executado no banco compartilhado (Supabase MCP). Garante a seção visível em dev com countdown
de ~7 dias e 4 produtos a 15%.

## Reordenação do home (item separável)

Ordem atual: Hero → Promo → Novidades → Marca → Categorias (números fora de ordem).
Proposta (ritmo preto↔claro do DESIGN.md):

| Ordem | Seção | Fundo |
|---|---|---|
| 1 | Hero | preto |
| 2 | Categorias | claro |
| 3 | **Promoções (destaque)** | preto |
| 4 | Novidades | claro |
| 5 | Marca "Feito para durar" | preto |

Pode ser entregue junto ou adiada sem bloquear a seção de promoções.

_Nota 2026-09-28: a reordenação entrou (Hero, Categorias, Promoção, Novidades). A seção 5 "Marca" foi substituída por `BranchMapSection` ("Onde estamos"), ver spec `2026-06-09-secao-onde-estamos-design.md`._

## Riscos e mitigação

- **Divergência ADR-0009:** a cópia de schema/query no storefront antecede o PR de sync.
  Mitigação: comentários explícitos marcando a cópia; o PR oficial concilia.
- **Hydration do countdown:** mitigado pelo mount client-side (B4).
- **Vermelho repetido:** countdown + CTA do hero estão em folds distintos; regra "1 vermelho
  por viewport" preservada.
- **Banco compartilhado:** o `db:push` do dashboard afeta os dois apps; coluna aditiva com
  default é não-destrutiva.

## Verificação

- `bun check-types` nos dois repos.
- Dashboard: criar/editar promoção, marcar "Destaque no home", confirmar que desmarca a
  anterior; confirmar toggle escondido para cupom.
- Storefront: `bun dev:web`, visitar `/`, confirmar seção preta + countdown + badges -% +
  preço riscado; testar fallback (sem featured → seção some).
- Smoke do countdown: valores corretos, sem warning de hydration no console.

## Follow-ups (fora do escopo)

- Conciliar a cópia de schema com o PR de sync quando rodar.
- (Opcional) badge "Destaque" na listagem do dashboard (A5) se não entrar nesta leva.
