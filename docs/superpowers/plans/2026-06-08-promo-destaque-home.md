# Promoção em destaque no home — Implementation Plan

> **Status em 2026-09-28:** implementado (Parte B verificada no código). `getFeaturedPromotion` está em `packages/db/src/queries/promotions.ts:162`, `formatCountdown` em `apps/web/src/lib/countdown.ts`, e `PromoHighlight` e `PromoCountdown` em `apps/web/src/components/`, montados em `apps/web/src/app/(shop)/page.tsx`. Os caminhos e imports dos passos abaixo estão desatualizados em dois pontos (ver notas nas Tasks 6, 9 e 10). A Parte A roda no `emach-dashboard` e não foi verificada.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao staff controle editorial de uma promoção em destaque no home, exibida numa seção preta cinematográfica com contador regressivo até o fim da vigência.

**Architecture:** Cross-repo. O `emach-dashboard` (dono do schema, ADR-0009) ganha a coluna `promotion.featured` (≤1 por vez) e um toggle no form. O banco Supabase é compartilhado; o `emach-ecommerce` replica a cópia de schema à mão (conciliada pelo PR de sync depois), adiciona a query `getFeaturedPromotion` e renderiza uma seção nova `<PromoHighlight>` + `<PromoCountdown>`.

**Tech Stack:** Drizzle 0.45, Next 16 (RSC + client), React 19, Better Auth, Tailwind v4, Vitest, Supabase Postgres.

> **Ordem de execução:** Parte A (dashboard) inteira antes da Parte B (storefront) — a coluna precisa existir no banco compartilhado antes do storefront consumir. Cada implementer deve **ler cada arquivo antes de editar** (não herda state do parent) e rodar `bun check-types` antes de cada commit.

> **Diretórios:** Parte A roda em `/home/othavio/Projects/emach/emach-dashboard`. Parte B roda em `/home/othavio/Projects/emach/emach-ecommerce`. Os comandos abaixo assumem o cwd do repo da parte.

---

## PARTE A — `emach-dashboard`

### Task 1: Schema `promotion.featured` + constraints + push

**Files:**
- Modify: `packages/db/src/schema/promotions.ts`

- [ ] **Step 1: Adicionar `uniqueIndex` ao import do drizzle**

Em `packages/db/src/schema/promotions.ts`, o import atual de `drizzle-orm/pg-core` é:

```ts
import {
	boolean,
	check,
	index,
	integer,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
```

Adicionar `uniqueIndex`:

```ts
import {
	boolean,
	check,
	index,
	integer,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Adicionar a coluna `featured`**

Logo após a coluna `active` (`active: boolean("active").default(false).notNull(),`), adicionar:

```ts
		featured: boolean("featured").notNull().default(false),
```

- [ ] **Step 3: Adicionar o partial unique index e o check**

No array `(table) => [ ... ]`, após o index `promotion_active_ends_idx`, adicionar:

```ts
		// Só uma promoção pode ser destaque no home por vez.
		uniqueIndex("promotion_single_featured_idx")
			.on(table.featured)
			.where(sql`${table.featured} = true`),
```

E, junto aos outros `check(...)`, adicionar:

```ts
		check(
			"featured_only_promotion",
			sql`${table.featured} = false OR ${table.type} = 'promotion'`
		),
```

- [ ] **Step 4: Aplicar no banco compartilhado**

Run: `bun db:push`
Expected: drizzle-kit aplica `ALTER TABLE promotion ADD COLUMN featured ...`, cria o índice e o check, sem prompt destrutivo (coluna aditiva com default). Se pedir `bun db:apply-triggers`, rodar em seguida.

- [ ] **Step 5: Verificar tipos**

Run: `bun check-types`
Expected: PASS (sem erros novos).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/promotions.ts
git commit -m "feat(db): coluna promotion.featured (destaque no home, ≤1 por vez)"
```

---

### Task 2: Zod + toggle no form

**Files:**
- Modify: `apps/web/src/app/dashboard/promotions/_components/promotion-schema.ts`
- Modify: `apps/web/src/app/dashboard/promotions/_components/promotion-form-fields.tsx`

- [ ] **Step 1: Adicionar `featured` ao `promotionBaseFields`**

Em `promotion-schema.ts`, dentro de `promotionBaseFields` (após `active: z.boolean(),`):

```ts
	featured: z.boolean(),
```

> Fica em `promotionBaseFields` (spread nas duas variantes) para não ser rejeitado pelo `.strict()` da variante `promotion`. Para `promocode` o valor existe mas é sempre `false` (toggle escondido + check no DB).

- [ ] **Step 2: Renderizar o toggle no form (só para promoção automática)**

Em `promotion-form-fields.tsx`, logo após o card do `Switch` "Ativa" (o bloco `<div className="flex flex-col gap-2 rounded-lg border border-border p-4"> ... Inativa não aparece no site ...</div>`), adicionar — **dentro de um guard `!isCoupon`**:

```tsx
				{!isCoupon && (
					<div className="flex flex-col gap-2 rounded-lg border border-border p-4">
						<div className="flex items-center gap-3">
							<Switch
								checked={values.featured}
								disabled={disabled}
								id="promo-featured"
								onCheckedChange={(v) => onPatch({ featured: v })}
							/>
							<Label className="cursor-pointer" htmlFor="promo-featured">
								Destaque no home
							</Label>
						</div>
						<p className="text-muted-foreground text-xs">
							Aparece em destaque no topo da home, com contador regressivo até o
							fim da vigência. Só uma promoção pode ser destaque — marcar esta
							desmarca a anterior.
						</p>
					</div>
				)}
```

- [ ] **Step 3: Verificar tipos**

Run: `bun check-types`
Expected: PASS. Se acusar `featured` ausente em algum `values` inicial, ver Task 3 Step 4 (defaults do form).

- [ ] **Step 4: Smoke visual**

Visitar `/dashboard/promotions/new`, escolher tipo "Automática" → o card "Destaque no home" aparece. Escolher "Cupom" → some.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/promotions/_components/promotion-schema.ts apps/web/src/app/dashboard/promotions/_components/promotion-form-fields.tsx
git commit -m "feat(promo): toggle 'Destaque no home' no form (só promoção automática)"
```

---

### Task 3: Persistir `featured` nas actions + desmarcar a anterior

**Files:**
- Modify: `apps/web/src/app/dashboard/promotions/actions.ts`
- Modify (se necessário): defaults do form em `promotion-form.tsx`

- [ ] **Step 1: Conferir imports de operadores drizzle**

No topo de `actions.ts`, garantir que `and`, `eq`, `ne` estão importados de `drizzle-orm` (o arquivo já usa `eq`). Se faltar `and`/`ne`, adicionar ao import existente:

```ts
import { and, eq, ne /* …demais já presentes */ } from "drizzle-orm";
```

- [ ] **Step 2: `createPromotion` — desmarcar anterior + gravar featured**

Dentro do `db.transaction` de `createPromotion`, **antes** do `tx.insert(promotion).values({...})`, adicionar:

```ts
				const isFeatured = data.type === "promotion" && data.featured === true;
				if (isFeatured) {
					await tx
						.update(promotion)
						.set({ featured: false })
						.where(eq(promotion.featured, true));
				}
```

E no objeto `.values({...})`, adicionar o campo (após `active: data.active,`):

```ts
					featured: isFeatured,
```

- [ ] **Step 3: `updatePromotion` — desmarcar anterior + gravar featured**

Dentro do `db.transaction` de `updatePromotion`, **antes** do `tx.update(promotion).set({...})`, adicionar:

```ts
				const isFeatured = data.type === "promotion" && data.featured === true;
				if (isFeatured) {
					await tx
						.update(promotion)
						.set({ featured: false })
						.where(and(eq(promotion.featured, true), ne(promotion.id, id)));
				}
```

E no objeto `.set({...})`, adicionar (após `active: data.active,`):

```ts
					featured: isFeatured,
```

> A desmarcação na mesma transação garante o partial unique index nunca violado e dá a semântica "marcar esta desmarca a anterior". No create, como a nova linha ainda não existe, o `WHERE featured = true` simples basta.

- [ ] **Step 4: Garantir default no estado do form**

Abrir `promotion-form.tsx` (o componente que monta `PromotionFormValues` inicial). Onde os valores default são definidos (objeto com `active`, `appliesToAll`, etc.), adicionar `featured: false`. Em modo `edit`, popular `featured` a partir do registro carregado (ex.: `featured: promotion.featured`). Ler o arquivo antes de editar para casar com o shape existente.

- [ ] **Step 5: Verificar tipos**

Run: `bun check-types`
Expected: PASS.

- [ ] **Step 6: Smoke — exclusividade**

1. Criar/editar a promoção "Liquidação de Ferramentas Elétricas" → marcar "Destaque no home" → salvar.
2. Editar a "Promoção Black Friday" → marcar "Destaque no home" → salvar.
3. SQL de conferência (Supabase): `SELECT title, featured FROM promotion WHERE featured = true;` → deve retornar **só** a Black Friday.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/promotions/actions.ts apps/web/src/app/dashboard/promotions/_components/promotion-form.tsx
git commit -m "feat(promo): persistir featured e desmarcar destaque anterior na mesma transação"
```

---

### Task 4: Badge "Destaque" na listagem (opcional, baixo custo)

**Files:**
- Modify: `apps/web/src/app/dashboard/promotions/_components/promotion-card.tsx`

- [ ] **Step 1: Ler o card e localizar onde ficam os badges de status**

Ler `promotion-card.tsx`. Identificar o ponto onde já se renderiza status (ativa/inativa) ou o título.

- [ ] **Step 2: Renderizar badge quando `featured`**

Onde o registro da promoção estiver disponível (ex.: `promotion.featured`), adicionar próximo ao título:

```tsx
{promotion.featured && <Badge variant="secondary">Destaque</Badge>}
```

Ajustar o nome da prop/objeto ao shape real do componente (ler antes de editar). Garantir que o tipo da promoção passada ao card inclua `featured` (a query da listagem já seleciona a linha inteira na maioria dos casos; se projetar colunas, incluir `featured`).

- [ ] **Step 3: Verificar tipos + smoke**

Run: `bun check-types` → PASS. Visitar `/dashboard/promotions` → a promoção destacada mostra o badge.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/promotions/_components/promotion-card.tsx
git commit -m "feat(promo): badge 'Destaque' na listagem de promoções"
```

---

## PARTE B — `emach-ecommerce`

### Task 5: Cópia de schema (featured) no storefront

**Files:**
- Modify: `packages/db/src/schema/promotions.ts`

- [ ] **Step 1: Replicar a mudança da Task 1**

Aplicar exatamente os Steps 1-3 da Task 1 (import `uniqueIndex`, coluna `featured`, partial unique index `promotion_single_featured_idx`, check `featured_only_promotion`) neste repo. O conteúdo é idêntico — `promotions.ts` é cópia versionada do dashboard.

- [ ] **Step 2: Comentar a antecipação de sync**

No topo do arquivo (após os imports), adicionar um comentário:

```ts
// NOTA (ADR-0009): a coluna `featured` é cópia antecipada de uma mudança
// owned-by-dashboard. O PR de sync (sync-db-schema.yml) concilia este arquivo
// quando rodar. Não rodar db:push aqui — o dashboard já aplicou no banco compartilhado.
```

- [ ] **Step 3: Verificar tipos**

Run: `bun check-types`
Expected: PASS. **Não** rodar `db:push`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/promotions.ts
git commit -m "feat(db): cópia antecipada de promotion.featured (ADR-0009, sync concilia)"
```

---

### Task 6: Query `getFeaturedPromotion`

**Files:**
- Modify: `packages/db/src/queries/catalog.ts`

_Nota 2026-09-28: o `catalog.ts` foi dividido (PR #157); a função vive hoje em `packages/db/src/queries/promotions.ts`, e os imports `@emach/db/queries/catalog` das Tasks 6, 9 e 10 viraram `@emach/db/queries/promotions`._

- [ ] **Step 1: Ler `getActivePromotions` para reusar o bloco de tools**

Ler `packages/db/src/queries/catalog.ts` em torno de `getActivePromotions` (≈ linhas 756-848) e os helpers: `coerceDates`, `PROMOTION_DATE_KEYS`, `arrayLiteral`, `rowToToolListItem`, `STOREFRONT_STATUS_SQL`, `TOOLS_PER_PROMO`, tipos `Promotion`, `PromotionWithTools`, `ToolListRow`.

- [ ] **Step 2: Adicionar a função após `getActivePromotions`**

Inserir logo após o fim de `getActivePromotions` (antes da seção `// 6. getRecentTools`):

```ts
// ---------------------------------------------------------------------------
// 5b. getFeaturedPromotion — a promoção destacada no home (≤1), ativa e vigente
// ---------------------------------------------------------------------------

export async function getFeaturedPromotion(
	db: AnyDb
): Promise<PromotionWithTools | null> {
	const promosRes = await db.execute<Promotion>(sql`
		SELECT id, title, description, type, code,
		       discount_type AS "discountType",
		       discount_value AS "discountValue",
		       applies_to_all AS "appliesToAll",
		       max_redemptions AS "maxRedemptions",
		       redemption_count AS "redemptionCount",
		       min_order_amount AS "minOrderAmount",
		       active, featured,
		       starts_at AS "startsAt",
		       ends_at AS "endsAt",
		       created_at AS "createdAt",
		       updated_at AS "updatedAt"
		FROM promotion
		WHERE featured = true
		  AND type = 'promotion'
		  AND active = true
		  AND (starts_at IS NULL OR starts_at <= now())
		  AND (ends_at IS NULL OR ends_at > now())
		ORDER BY ends_at ASC NULLS LAST
		LIMIT 1
	`);

	const promo = promosRes.rows[0];
	if (!promo) {
		return null;
	}
	coerceDates(promo, PROMOTION_DATE_KEYS);

	let toolScope = sql`true`;
	if (!promo.appliesToAll) {
		const toolIdsRes = await db.execute<{ tool_id: string }>(sql`
			SELECT tool_id FROM promotion_tool WHERE promotion_id = ${promo.id}
		`);
		const toolIds = toolIdsRes.rows.map((r) => r.tool_id);
		if (toolIds.length === 0) {
			return null;
		}
		toolScope = sql`t.id = ANY(${arrayLiteral(toolIds, "text[]")})`;
	}

	const toolsRes = await db.execute<ToolListRow>(sql`
		SELECT
			t.id, t.slug, t.name, t.status,
			dv.id AS variant_id,
			dv.sku AS variant_sku,
			dv.voltage AS variant_voltage,
			dv.price_amount::text AS variant_price,
			CASE
				WHEN ${promo.discountType}::text = 'fixed'
					THEN GREATEST(dv.price_amount - ${promo.discountValue}::numeric, 0)::text
				ELSE ROUND(dv.price_amount * (1 - ${promo.discountValue}::numeric / 100), 2)::text
			END AS discounted_amount,
			${promo.id}::text AS active_promotion_id,
			(SELECT COUNT(*) > 1 FROM tool_variant tv2 WHERE tv2.tool_id = t.id) AS has_other_variants,
			(SELECT url FROM tool_image WHERE tool_id = t.id ORDER BY sort_order ASC LIMIT 1) AS primary_image_url,
			COALESCE((
				SELECT SUM(sl.quantity) > 0
				FROM stock_level sl
				JOIN tool_variant tv ON tv.id = sl.variant_id
				WHERE tv.tool_id = t.id
			), false) AS in_stock,
			(SELECT AVG(r.rating)::numeric(3,2)::text FROM review r WHERE r.tool_id = t.id AND r.status = ${APPROVED}) AS avg_rating,
			(SELECT COUNT(*)::int FROM review r WHERE r.tool_id = t.id AND r.status = ${APPROVED}) AS review_count,
			pc.id AS cat_id,
			pc.slug AS cat_slug,
			pc.name AS cat_name
		FROM tool t
		INNER JOIN tool_variant dv ON dv.tool_id = t.id AND dv.is_default = true
		LEFT JOIN tool_category tc ON tc.tool_id = t.id AND tc.is_primary = true
		LEFT JOIN category pc ON pc.id = tc.category_id
		WHERE ${toolScope}
		  AND t.visible_on_site = true
		  AND ${STOREFRONT_STATUS_SQL}
		ORDER BY t.created_at DESC
		LIMIT ${TOOLS_PER_PROMO}
	`);

	const tools = toolsRes.rows.map(rowToToolListItem);
	if (tools.length === 0) {
		return null;
	}

	return { ...promo, tools };
}
```

> O `SELECT` da promoção acrescenta `featured` à projeção de `getActivePromotions`. Se o tipo `Promotion` (inferido do schema) já inclui `featured` após a Task 5, o cast `db.execute<Promotion>` resolve sozinho.

- [ ] **Step 3: Verificar tipos**

Run: `bun check-types`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries/catalog.ts
git commit -m "feat(db): query getFeaturedPromotion (destaque ativo + vigente + produtos)"
```

---

### Task 7: `formatCountdown` (função pura) + teste

**Files:**
- Create: `apps/web/src/lib/countdown.ts`
- Test: `apps/web/src/lib/countdown.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/lib/countdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCountdown } from "./countdown";

describe("formatCountdown", () => {
	it("zera quando o alvo já passou", () => {
		expect(formatCountdown(-1000)).toEqual({
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
			done: true,
		});
	});

	it("decompõe milissegundos em d/h/m/s", () => {
		const ms =
			2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5 * 1000; // 2d 3h 4m 5s
		expect(formatCountdown(ms)).toEqual({
			days: 2,
			hours: 3,
			minutes: 4,
			seconds: 5,
			done: false,
		});
	});

	it("trata o zero exato como concluído", () => {
		expect(formatCountdown(0)).toEqual({
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
			done: true,
		});
	});
});
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `cd apps/web && bunx vitest run src/lib/countdown.test.ts`
Expected: FAIL ("Failed to resolve import './countdown'" ou "formatCountdown is not a function").

- [ ] **Step 3: Implementar a função pura**

Criar `apps/web/src/lib/countdown.ts`:

```ts
export interface CountdownParts {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	done: boolean;
}

/** Decompõe um intervalo em ms (alvo - agora) em d/h/m/s. <=0 vira "done". */
export function formatCountdown(remainingMs: number): CountdownParts {
	if (remainingMs <= 0) {
		return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
	}
	const totalSeconds = Math.floor(remainingMs / 1000);
	return {
		days: Math.floor(totalSeconds / 86_400),
		hours: Math.floor((totalSeconds % 86_400) / 3600),
		minutes: Math.floor((totalSeconds % 3600) / 60),
		seconds: totalSeconds % 60,
		done: false,
	};
}
```

- [ ] **Step 4: Rodar o teste e confirmar PASS**

Run: `cd apps/web && bunx vitest run src/lib/countdown.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/countdown.ts apps/web/src/lib/countdown.test.ts
git commit -m "feat(promo): formatCountdown puro + testes"
```

---

### Task 8: `<PromoCountdown>` (client, SSR-safe)

**Files:**
- Create: `apps/web/src/components/promo-countdown.tsx`

- [ ] **Step 1: Implementar o componente**

Criar `apps/web/src/components/promo-countdown.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { type CountdownParts, formatCountdown } from "@/lib/countdown";

interface PromoCountdownProps {
	endsAt: string; // ISO — o server passa endsAt.toISOString()
}

const UNITS: Array<{ key: keyof Omit<CountdownParts, "done">; label: string }> =
	[
		{ key: "days", label: "dias" },
		{ key: "hours", label: "hrs" },
		{ key: "minutes", label: "min" },
		{ key: "seconds", label: "seg" },
	];

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

export function PromoCountdown({ endsAt }: PromoCountdownProps) {
	// Mount gate: o primeiro paint (server + hidratação) não calcula tempo,
	// evitando mismatch entre relógio do server e do client.
	const [parts, setParts] = useState<CountdownParts | null>(null);

	useEffect(() => {
		const target = new Date(endsAt).getTime();
		const tick = () => setParts(formatCountdown(target - Date.now()));
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [endsAt]);

	if (parts === null || parts.done) {
		// Pré-mount ou já encerrado: não mostra dígitos (a seção segue visível
		// até a próxima revalidação do server, que deixará de renderizá-la).
		return null;
	}

	return (
		<div className="flex flex-col gap-2">
			<span className="font-display text-[11px] text-white/55 uppercase tracking-[0.14em]">
				Termina em
			</span>
			<div
				aria-label="Tempo restante da oferta"
				className="flex items-start gap-3 tabular-nums"
			>
				{UNITS.map((u, i) => (
					<div className="flex items-start gap-3" key={u.key}>
						<div className="flex flex-col items-center">
							<span className="font-display font-medium text-[32px] text-emach-red leading-none">
								{pad(parts[u.key])}
							</span>
							<span className="mt-1 font-display text-[10px] text-white/45 uppercase tracking-[0.14em]">
								{u.label}
							</span>
						</div>
						{i < UNITS.length - 1 && (
							<span
								aria-hidden="true"
								className="font-display text-[28px] text-white/25 leading-none"
							>
								:
							</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
```

> Sem animação de pulse/blink → nada a condicionar em `prefers-reduced-motion`. Se um implementer adicionar pulse depois, envolver em `motion-safe:`.

- [ ] **Step 2: Verificar tipos**

Run: `cd apps/web && bun check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/promo-countdown.tsx
git commit -m "feat(promo): PromoCountdown client SSR-safe (dígitos vermelhos)"
```

---

### Task 9: `<PromoHighlight>` (server) — seção preta

**Files:**
- Create: `apps/web/src/components/promo-highlight.tsx`

_Nota 2026-09-28: o corpo com `ProductCarousel` foi trocado por layout adaptativo (pair, trio, grid) no plano `2026-06-24-promo-section-adaptive-layout.md`._

- [ ] **Step 1: Conferir as props dos componentes reusados**

Ler `apps/web/src/components/product-carousel.tsx`, `section-label.tsx`, `emach-button.tsx` e `page-container.tsx` para confirmar nomes de props (`ProductCarousel` recebe `label`/`title`/`link`/`tools`; `SectionLabel` aceita `tone`; `EmachButton` aceita `variant`/`size`).

- [ ] **Step 2: Implementar o componente**

Criar `apps/web/src/components/promo-highlight.tsx`:

```tsx
import type { PromotionWithTools } from "@emach/db/queries/catalog";
import Link from "next/link";
import { EmachButton } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { ProductCarousel } from "@/components/product-carousel";
import { PromoCountdown } from "@/components/promo-countdown";
import { SectionLabel } from "@/components/section-label";

interface PromoHighlightProps {
	promotion: PromotionWithTools;
}

export function PromoHighlight({ promotion }: PromoHighlightProps) {
	return (
		<section className="bg-black text-white">
			<PageContainer className="px-14 py-18">
				<div className="flex flex-col gap-8 border-white/10 border-b pb-8 md:flex-row md:items-end md:justify-between">
					<div className="flex flex-col gap-3">
						<SectionLabel tone="accent">Ofertas</SectionLabel>
						<h2 className="font-display font-medium text-[44px] text-white leading-[1.02] tracking-[-0.01em]">
							{promotion.title}
						</h2>
					</div>
					{promotion.endsAt && (
						<PromoCountdown endsAt={promotion.endsAt.toISOString()} />
					)}
				</div>

				<div className="pt-10">
					<ProductCarousel
						link={{
							href: "/catalog?promo=1",
							label: "Ver todas as ofertas",
							variant: "arrow",
						}}
						title=""
						tools={promotion.tools}
					/>
				</div>
			</PageContainer>
		</section>
	);
}
```

> **Atenção ao `ProductCarousel`:** ele renderiza seu próprio `<SectionHeader>` com o `title`. Aqui o título já está acima (a promoção), então passamos `title=""`. Se o `SectionHeader` renderizar um `<h2>` vazio feio, no Step 3 ajustar: ou (a) extrair o grid/carousel sem header para esta seção, ou (b) passar o título da promoção ao `ProductCarousel` e remover o `<h2>` próprio acima. Decidir vendo o render (smoke da Task 11). A opção (b) é a mais simples se o countdown puder ficar numa linha separada.

- [ ] **Step 3: Verificar tipos**

Run: `cd apps/web && bun check-types`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/promo-highlight.tsx
git commit -m "feat(promo): PromoHighlight (seção preta + título + countdown + produtos)"
```

---

### Task 10: Home — query swap, kickers sem número, reordenação

**Files:**
- Modify: `apps/web/src/app/(shop)/page.tsx`

- [ ] **Step 1: Trocar a query e remover `flattenPromoTools`**

Em `page.tsx`:
- No import de `@emach/db/queries/catalog`, trocar `getActivePromotions` por `getFeaturedPromotion` (manter `getRecentTools`; remover `ToolListItem` se ficar sem uso após remover `flattenPromoTools`).
- Remover a função `flattenPromoTools` inteira (linhas ≈105-124).
- No `Promise.all`, trocar `getActivePromotions(db, 8)` por `getFeaturedPromotion(db)`; renomear a variável de `activePromotions` para `featuredPromotion`.
- Remover a linha `const promoTools = flattenPromoTools(activePromotions, 8);`.
- Adicionar o import do componente: `import { PromoHighlight } from "@/components/promo-highlight";`.

- [ ] **Step 2: Substituir o bloco da seção de promoções e remover números dos kickers**

Trocar o bloco atual `{promoTools.length > 0 && ( <section className="bg-gray-10"> ... "02 · Ofertas" ... </section> )}` por:

```tsx
				{featuredPromotion && <PromoHighlight promotion={featuredPromotion} />}
```

Nos demais `ProductCarousel`/`SectionHeader`, trocar os labels:
- `"03 · Recém chegadas"` → `"Novidades"` (na seção de Novidades; manter o `title="Novidades"`, ajustar só o `label`). Como o título e o label ficariam iguais, usar `label="Novidades"` e `title="Recém-chegadas"` **ou** remover o `label` e manter só o título. Decisão: `label="Novidades"`, `title="Recém-chegadas"`.
- `"01 · Categorias"` → `label="Categorias"` no `SectionHeader` da seção de categorias.

- [ ] **Step 3: Reordenar as seções (ritmo chiaroscuro)**

Reorganizar o JSX do `<main>` para a ordem:

1. `<HeroCarousel />` (preto)
2. Seção **Categorias** (`bg-gray-10`) — mover para cá, logo após o hero
3. `{featuredPromotion && <PromoHighlight .../>}` (preto)
4. Seção **Novidades** (`bg-gray-10`)
5. Seção **Marca** "Feito para durar" (`bg-black`)

_Nota 2026-09-28: a seção Marca foi removida e substituída por `BranchMapSection` (plano `2026-06-09-secao-onde-estamos.md`)._

Garantir que cada seção continua com seu guard (`recentTools.length > 0`, `rootCategories.length > 0`).

- [ ] **Step 4: Verificar tipos**

Run: `cd apps/web && bun check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(shop)/page.tsx"
git commit -m "feat(home): seção de destaque + kickers nomeados + ordem chiaroscuro"
```

---

### Task 11: Dado de demo + smoke run-time

**Files:** nenhum (SQL no banco compartilhado + verificação visual)

- [ ] **Step 1: Semear a promoção destacada (via Supabase MCP `execute_sql`)**

```sql
UPDATE promotion
SET featured = true, active = true, ends_at = now() + interval '7 days'
WHERE title = 'Liquidação de Ferramentas Elétricas';
```

Conferir exclusividade: `SELECT title, featured, active, ends_at FROM promotion WHERE featured = true;` → exatamente 1 linha.

- [ ] **Step 2: Smoke visual no storefront**

Servidor já rodando em `:3008` (ou `bun dev:web`). Visitar `http://localhost:3008/`:
- A seção **preta** "Ofertas / Liquidação de Ferramentas Elétricas" aparece logo após Categorias.
- Countdown contando `dd:hh:mm:ss` em vermelho.
- Cards com badge `-15%` e preço riscado.
- Ordem: Hero → Categorias → Promoção → Novidades → Marca.
- Sem warning de hydration no console (`read_console_messages onlyErrors`).

- [ ] **Step 3: Smoke do fallback**

```sql
UPDATE promotion SET featured = false WHERE title = 'Liquidação de Ferramentas Elétricas';
```

Recarregar `/` → a seção de promoção **some** sem buraco no layout. Reverter (Step 1) ao final.

- [ ] **Step 4: check-types final nos dois repos**

Run (ecommerce): `bun check-types` → PASS.
Run (dashboard): `cd /home/othavio/Projects/emach/emach-dashboard && bun check-types` → PASS.

- [ ] **Step 5: Verificação manual final**

Confirmar que `bun check-types` passou nos dois repos e o smoke visual bateu com o esperado antes de declarar concluído.

---

## Self-review (preenchido)

- **Cobertura do spec:** A1→T1, A2/A3→T2, A4→T3, A5→T4, B1→T5, B2→T6, B3→T9, B4→T7+T8, B5→T10, C→T11, fallback→T11/T9, reordenação→T10. ✓
- **Placeholders:** nenhum TODO/TBD; código completo em cada step. Pontos de "ler antes de editar" (defaults do form T3.4, card T4, props T9.1, ajuste do header do carousel T9.2) são decisões dependentes do shape real, com instrução explícita — não placeholders de lógica.
- **Consistência de tipos:** `featured` boolean nos dois schemas; `getFeaturedPromotion → PromotionWithTools | null`; `PromoCountdown` recebe `endsAt: string` e o server passa `.toISOString()`; `formatCountdown(remainingMs) → CountdownParts`. ✓

## Follow-ups (fora do escopo)
- Conciliar a cópia de schema/query com o PR de sync quando rodar.
- Avaliar mover `getActivePromotions` para uso só no `/catalog?promo=1` (ainda referenciada lá).
  _Nota 2026-09-28: nenhum código de `apps/web` chama `getActivePromotions`; só o teste em `packages/db/src/queries/__tests__/catalog-promotions.test.ts`. O `/catalog?promo=1` usa o filtro `onlyPromo` (`catalog/_lib/parse-search-params.ts:97`)._
