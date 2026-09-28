# PDP Produto — Redesign Chiaroscuro · Implementation Plan

> **Status em 2026-09-28:** substituído. O plano foi executado no #101 (`b4bee5c`) e a ficha e os comentários escuros foram refeitos em #105 e #180, que adotaram a placa técnica clara de `docs/superpowers/specs/2026-07-03-pdp-redesign-design.md`. Sobrevivem `apps/web/src/lib/format.ts` (`fmtSpecNumber`, `fmtSpecRange`) e `scripts/seed-pdp-demo-specs.sql`; `product-tabs.tsx` e o tema escuro da ficha não existem mais. Os checkboxes abaixo ficaram sem marcar e não refletem o que foi feito.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a página de produto (`/product/[slug]`) com ritmo claro/escuro do home: remove breadcrumb, ficha técnica e comentários escuros (tom cinema), bloco de compra refinado, formatação numérica PT-BR.

**Architecture:** Edição dos componentes existentes em `app/(shop)/product/[slug]/_components/` + recomposição em `page.tsx`. Uma única unidade de lógica pura nova e testável (`fmtSpecValue`). Demais mudanças são apresentação React — verificação por `check-types` + smoke visual na app viva (`:3008`). Seed dev de specs aplicado via MCP Supabase para validar a ficha com muitos dados.

**Tech Stack:** Next 16 (App Router, RSC), React 19, Tailwind v4 (tokens `cinema-*`, `emach-red`, `gray-*`), Drizzle/Postgres (Supabase), vitest.

**Fonte visual:** mockups aprovados em `.superpowers/brainstorm/140654-1781184047/content/` (`ficha-d-v3.html`, `comentarios-dark-v2.html`, `bloco-compra.html`, `variantes.html`). Espelhar a seção escura em `components/promo-highlight.tsx` (`bg-black text-white` / `.emach-bg-cinema`).

**Convenções do projeto (ler antes de editar):**
- Sem `console.*` (usar `log` do evlog); sem `: any`/`as any`; sem `key={index}`; `next/image` (não `<img>`); sem `useMemo`/`useCallback` (React Compiler ativo); IDs estáveis.
- `bun check-types` roda da raiz. `bun --filter web test` para vitest do app.
- Rodar `Read` antes de cada `Edit` (não há state herdado entre execuções).

---

### Task 1: Helper `fmtSpecValue` (formatação numérica PT-BR) — TDD

_Nota 2026-09-28: o helper saiu com os nomes `fmtSpecNumber` e `fmtSpecRange` em `apps/web/src/lib/format.ts`, sem `fmtSpecValue`._

Corrige o bug `650.0000 W`. Única unidade de lógica pura → TDD.

**Files:**
- Modify: `apps/web/src/lib/format.ts`
- Test: `apps/web/src/lib/format.test.ts` (Create)

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fmtSpecNumber, fmtSpecRange } from "./format";

describe("fmtSpecNumber", () => {
	it("remove zeros à direita de numeric do Postgres", () => {
		expect(fmtSpecNumber("650.0000", "W")).toBe("650 W");
	});
	it("mantém casas decimais significativas com vírgula PT-BR", () => {
		expect(fmtSpecNumber("1.8000", "kg")).toBe("1,8 kg");
	});
	it("agrupa milhares", () => {
		expect(fmtSpecNumber("44800.0000", "")).toBe("44.800");
	});
	it("retorna travessão quando null", () => {
		expect(fmtSpecNumber(null, "W")).toBe("—");
	});
});

describe("fmtSpecRange", () => {
	it("monta faixa min–max", () => {
		expect(fmtSpecRange("100.0000", "2800.0000", "RPM")).toBe("100 – 2.800 RPM");
	});
	it("usa 'até' quando min é zero", () => {
		expect(fmtSpecRange("0.0000", "2800.0000", "RPM")).toBe("até 2.800 RPM");
	});
	it("sem max mostra só o min", () => {
		expect(fmtSpecRange("650.0000", null, "W")).toBe("650 W");
	});
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `bun --filter web test src/lib/format.test.ts`
Expected: FAIL — `fmtSpecNumber is not a function` (ainda não exportado).

- [ ] **Step 3: Implementar os helpers**

Append em `apps/web/src/lib/format.ts`:

```ts
function withUnit(value: string, unit: string): string {
	return unit ? `${value} ${unit}` : value;
}

function fmtNum(n: number): string {
	return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

export function fmtSpecNumber(
	value: string | null,
	unit: string
): string {
	if (value == null) {
		return "—";
	}
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return "—";
	}
	return withUnit(fmtNum(n), unit);
}

export function fmtSpecRange(
	min: string | null,
	max: string | null,
	unit: string
): string {
	if (min == null) {
		return "—";
	}
	const minN = Number(min);
	if (max == null) {
		return withUnit(fmtNum(minN), unit);
	}
	const maxN = Number(max);
	if (minN === 0) {
		return withUnit(`até ${fmtNum(maxN)}`, unit);
	}
	return withUnit(`${fmtNum(minN)} – ${fmtNum(maxN)}`, unit);
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `bun --filter web test src/lib/format.test.ts`
Expected: PASS (7 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/format.ts apps/web/src/lib/format.test.ts
git commit -m "feat: helper fmtSpecValue para specs numéricas PT-BR"
```

---

### Task 2: Seed dev de specs realistas (validar ficha com muitos dados)

Enriquece a "Furadeira de Impacto 650W" para ~9 specs, para validar a ficha nos dois extremos. Idempotente. **Aplicado via MCP Supabase** (`mcp__supabase__execute_sql`) — o `DATABASE_URL` local resolve IPv6 e dá `ENETUNREACH`, então não usar `psql` local.

**Files:**
- Create: `scripts/seed-pdp-demo-specs.sql` (versionado, para reproduzir)

- [ ] **Step 1: Escrever o SQL idempotente**

Create `scripts/seed-pdp-demo-specs.sql`:

```sql
-- DEV-ONLY. Enriquece a Furadeira de Impacto 650W com specs extras para validar
-- a ficha técnica (caso "muitas specs"). Idempotente. As definitions vivem em
-- 'ferramentas-eletricas' (categoria que a furadeira herda). Em produção, atributos
-- nascem no dashboard (ADR-0009) — este seed é só para a app de dev.
WITH cat AS (
  SELECT id FROM category WHERE slug = 'ferramentas-eletricas'
), tl AS (
  SELECT id FROM tool WHERE slug = 'furadeira-de-impacto-650w'
), defs(slug, label, input_type, unit, sort_order) AS (
  VALUES
    ('torque-max',      'Torque máximo',      'number', 'Nm',  3),
    ('impactos-min',    'Impactos por minuto','number', 'ipm', 4),
    ('peso',            'Peso',               'number', 'kg',  5),
    ('nivel-ruido',     'Nível de ruído',     'number', 'dB',  6),
    ('comprimento-cabo','Comprimento do cabo','number', 'm',   7)
)
INSERT INTO attribute_definition (id, slug, label, input_type, unit, category_id, sort_order)
SELECT 'attr-' || d.slug, d.slug, d.label, d.input_type::attribute_input_type, d.unit, cat.id, d.sort_order
FROM defs d, cat
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tool_attribute_assignment (tool_id, attribute_id, sort_order)
SELECT tl.id, 'attr-' || d.slug, d.sort_order
FROM (VALUES ('torque-max',3),('impactos-min',4),('peso',5),('nivel-ruido',6),('comprimento-cabo',7)) AS d(slug, sort_order), tl
ON CONFLICT (tool_id, attribute_id) DO NOTHING;

INSERT INTO tool_attribute_value (tool_id, attribute_id, value_numeric)
SELECT tl.id, 'attr-' || v.slug, v.val
FROM (VALUES ('torque-max',30),('impactos-min',44800),('peso',1.8),('nivel-ruido',92),('comprimento-cabo',2)) AS v(slug, val), tl
ON CONFLICT (tool_id, attribute_id) DO UPDATE SET value_numeric = EXCLUDED.value_numeric;
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Executar o conteúdo do arquivo com `mcp__supabase__execute_sql`.
Expected: sem erro.

- [ ] **Step 3: Verificar que a furadeira agora tem 9 specs**

Via `mcp__supabase__execute_sql`:

```sql
SELECT COUNT(*) FROM tool_attribute_assignment taa
JOIN tool t ON t.id = taa.tool_id
WHERE t.slug = 'furadeira-de-impacto-650w';
```

Expected: `9` (4 originais + 5 novas).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-pdp-demo-specs.sql
git commit -m "chore: seed dev de specs extras para a furadeira"
```

---

### Task 3: Ficha técnica escura `ProductSpecs` (substitui `ProductTabs`)

Reescreve em seção escura 2-colunas, sem abas, sem "Entrega e Garantia", usando `fmtSpecValue`. Server Component (sem estado). Fonte visual: `ficha-d-v3.html`.

**Files:**
- Create: `apps/web/src/app/(shop)/product/[slug]/_components/product-specs.tsx`
- Delete: `apps/web/src/app/(shop)/product/[slug]/_components/product-tabs.tsx`
- Modify: `apps/web/src/app/(shop)/product/[slug]/page.tsx` (troca de import — detalhado na Task 6)

- [ ] **Step 1: Criar `product-specs.tsx`**

Lógica de escala: instrumentos = primeiras `min(3, N)` specs por `sortOrder`; grid = restante. Formatação via `fmtSpecNumber`/`fmtSpecRange` (number/numeric_range), `valueBool` → "Sim/Não", senão `valueText`.

```tsx
import type { ToolDetail } from "@emach/db/queries/catalog";
import { SectionLabel } from "@/components/section-label";
import { fmtSpecNumber, fmtSpecRange } from "@/lib/format";

interface ProductSpecsProps {
	attributes: ToolDetail["attributes"];
	tool: ToolDetail["tool"];
}

const HERO_COUNT = 3;

function fmtAttr(item: ToolDetail["attributes"][number]): string {
	const { definition, value } = item;
	const unit = definition.unit ?? "";
	switch (definition.inputType) {
		case "boolean":
			return value.valueBool == null ? "—" : value.valueBool ? "Sim" : "Não";
		case "numeric_range":
			return fmtSpecRange(value.valueNumeric, value.valueNumericMax, unit);
		case "number":
			return fmtSpecNumber(value.valueNumeric, unit);
		default:
			return value.valueText ?? "—";
	}
}

export function ProductSpecs({ attributes, tool }: ProductSpecsProps) {
	const sorted = [...attributes].sort((a, b) => a.sortOrder - b.sortOrder);
	const hero = sorted.slice(0, HERO_COUNT);
	const rest = sorted.slice(HERO_COUNT);

	return (
		<section className="emach-bg-cinema text-white [color-scheme:dark]">
			<div className="px-20 pt-12 pb-2">
				<SectionLabel tone="accent">Ficha da ferramenta</SectionLabel>
			</div>
			<div className="grid grid-cols-1 border-white/15 border-y md:grid-cols-[36%_1fr]">
				{/* Coluna esquerda: descrição + selos + ajuda */}
				<div className="flex flex-col border-white/15 md:border-r">
					<div className="border-white/12 border-b px-20 py-5 md:px-10">
						<span className="font-display font-semibold text-[11px] text-white/60 uppercase tracking-[0.12em]">
							A ferramenta
						</span>
						<p className="mt-2.5 text-[15px] text-white/80 leading-relaxed">
							{tool.description ?? "Descrição não disponível."}
						</p>
					</div>
					<div className="flex items-start gap-3.5 border-white/12 border-b px-20 py-4 md:px-10">
						<span className="flex size-7 flex-none items-center justify-center border border-emach-red text-emach-red text-[13px]">
							✓
						</span>
						<div>
							<div className="font-semibold text-[15px]">Garantia de 2 anos</div>
							<div className="mt-0.5 text-[13px] text-white/60">
								Direto com a marca, assistência em 50+ cidades
							</div>
						</div>
					</div>
					<div className="flex items-start gap-3.5 border-white/12 border-b px-20 py-4 md:px-10">
						<span className="flex size-7 flex-none items-center justify-center border border-emach-red text-emach-red text-[13px]">
							⊕
						</span>
						<div>
							<div className="font-semibold text-[15px]">Frete para todo o Brasil</div>
							<div className="mt-0.5 text-[13px] text-white/60">
								Calculado pelo seu CEP · 3 a 8 dias úteis
							</div>
						</div>
					</div>
					<div className="px-20 py-5 text-[13px] text-white/60 md:px-10">
						<strong className="mb-0.5 block font-semibold text-[15px] text-white">
							Precisa de ajuda?
						</strong>
						Fale com nossos técnicos pelo chat.
					</div>
				</div>

				{/* Coluna direita: contador + instrumentos + grid */}
				<div className="flex flex-col">
					<div className="flex items-center justify-between px-10 py-4">
						<span className="font-display font-semibold text-[11px] text-white/60 uppercase tracking-[0.12em]">
							{rest.length > 0 ? "Destaques" : "Especificações"}
						</span>
						<span className="border border-white/25 px-2.5 py-0.5 font-display text-[11px] text-white/60 uppercase tracking-[0.12em]">
							{attributes.length}{" "}
							{attributes.length === 1 ? "spec" : "specs"}
						</span>
					</div>
					{attributes.length === 0 ? (
						<p className="px-10 pb-10 text-[15px] text-white/60">
							Nenhuma especificação cadastrada.
						</p>
					) : (
						<>
							<div className="flex border-white/15 border-y">
								{hero.map((attr) => (
									<div
										className="flex-1 border-white/12 border-r px-6 py-4 last:border-r-0"
										key={attr.definition.id}
									>
										<span className="font-display font-semibold text-[10px] text-white/60 uppercase tracking-[0.12em]">
											{attr.definition.label}
										</span>
										<div className="mt-1.5 font-display font-medium text-[34px] leading-none">
											{fmtAttr(attr)}
										</div>
									</div>
								))}
							</div>
							{rest.length > 0 && (
								<>
									<div className="px-10 pt-4 pb-2">
										<span className="font-display font-semibold text-[11px] text-white/60 uppercase tracking-[0.12em]">
											Especificações completas
										</span>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2">
										{rest.map((attr, i) => (
											<div
												className={`flex items-baseline justify-between gap-3 border-white/12 border-b px-10 py-3 ${
													i % 2 === 0 ? "sm:border-r" : ""
												}`}
												key={attr.definition.id}
											>
												<span className="text-[14.5px] text-white/72">
													{attr.definition.label}
												</span>
												<span className="font-semibold text-[15px]">
													{fmtAttr(attr)}
												</span>
											</div>
										))}
									</div>
								</>
							)}
						</>
					)}
				</div>
			</div>
		</section>
	);
}
```

- [ ] **Step 2: Deletar o componente antigo**

```bash
git rm apps/web/src/app/(shop)/product/[slug]/_components/product-tabs.tsx
```

- [ ] **Step 3: Trocar o import e o uso em `page.tsx`**

Read `page.tsx` primeiro. Trocar:
- `import { ProductTabs } from "./_components/product-tabs";` → `import { ProductSpecs } from "./_components/product-specs";`
- `<ProductTabs attributes={detail.attributes} tool={detail.tool} />` → `<ProductSpecs attributes={detail.attributes} tool={detail.tool} />`

(A reordenação completa das seções é a Task 6 — aqui só manter compilando.)

- [ ] **Step 4: check-types**

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 5: Smoke visual**

Visitar `http://localhost:3008/product/furadeira-de-impacto-650w`. Conferir: seção escura cinema; "650 W", "até 2.800 RPM" (sem `.0000`); 3 instrumentos + grid de 6 (com o seed da Task 2); coluna esquerda com descrição + 2 selos + ajuda; contador "9 specs"; sem aba "Entrega e Garantia".

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(shop)/product/[slug]/
git commit -m "feat: ficha técnica escura ProductSpecs (sem abas)"
```

---

### Task 4: Bloco de compra `ProductInfo` — desconto, selos, variantes

Edita `product-info.tsx`. Mantém toda a lógica de cart/frete/share. Fonte visual: `bloco-compra.html`, `variantes.html`.

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-info.tsx`

- [ ] **Step 1: Badge de desconto + linha de economia**

Read o arquivo. Após calcular `discounted`/`finalAmount` (linha ~102-105), adicionar:

```tsx
const baseCents = numericToCents(selected.priceAmount);
const finalCents = numericToCents(finalAmount);
const discountPct =
	discounted != null && baseCents > 0
		? Math.round((1 - finalCents / baseCents) * 100)
		: 0;
const savingsCents = baseCents - finalCents;
```

No bloco de preço (`<div className="border-border border-y py-5">`), trocar a linha do preço para incluir o badge e a economia:

```tsx
<div className="border-border border-y py-5">
	<div className="flex items-center gap-3">
		{discountPct > 0 && (
			<span className="bg-emach-red px-2 py-1 font-display font-bold text-[14px] text-white tracking-[0.04em]">
				−{discountPct}%
			</span>
		)}
		<span className="font-bold font-display text-[40px] tabular-nums">
			{fmtNumericBRL(finalAmount)}
		</span>
		{discounted != null && (
			<span className="text-[16px] text-gray-50 tabular-nums line-through">
				{fmtNumericBRL(selected.priceAmount)}
			</span>
		)}
	</div>
	{savingsCents > 0 && (
		<div className="mt-1.5 font-semibold text-[13px] text-success">
			Você economiza {fmtBRL(savingsCents)}
		</div>
	)}
	<div className="mt-1 text-[13px] text-gray-60">
		Em até <strong>12× de {fmtBRL(installmentCents)}</strong> sem juros
	</div>
</div>
```

(Confirmar que existe token `text-success`; já usado no botão de share — sim.)

- [ ] **Step 2: Label "Voltagem" + cards de variante limpos + esgotado visual**

Calcular se os preços diferem entre variantes (controla mostrar preço no card). Antes do `return`:

```tsx
const variantPricesDiffer =
	new Set(
		orderedVariants.map(
			(v) => applyDiscount(v.priceAmount, activePromotion) ?? v.priceAmount
		)
	).size > 1;
```

Trocar o bloco `orderedVariants.length > 1` inteiro por:

```tsx
{orderedVariants.length > 1 && (
	<div>
		<div className="mb-2.5 font-semibold text-md">Voltagem</div>
		<div className="flex flex-wrap gap-2">
			{orderedVariants.map((v) => {
				const variantStock = stockByVariant[v.id] ?? false;
				const isActive = v.id === selectedVariantId;
				const vPrice =
					applyDiscount(v.priceAmount, activePromotion) ?? v.priceAmount;
				return (
					<button
						className={cn(
							"flex min-w-[120px] flex-col gap-1 border-2 px-4 py-3 text-left transition-colors",
							!variantStock &&
								"cursor-not-allowed border-dashed border-gray-20 opacity-45",
							variantStock &&
								isActive &&
								"border-emach-red bg-near-black text-white",
							variantStock &&
								!isActive &&
								"border-gray-20 bg-background text-foreground hover:border-foreground"
						)}
						disabled={!variantStock}
						key={v.id}
						onClick={() => variantStock && setSelectedVariantId(v.id)}
						type="button"
					>
						<span className="flex items-center justify-between gap-2">
							<span className="font-display font-semibold text-[12px] uppercase tracking-[0.12em] opacity-75">
								{v.voltage ?? "Padrão"}
							</span>
							{!variantStock && (
								<span className="border border-emach-red/60 px-1.5 font-display text-[9px] text-emach-red uppercase tracking-[0.08em]">
									Esgotado
								</span>
							)}
						</span>
						{variantPricesDiffer && (
							<span
								className={cn(
									"font-bold text-[15px] tabular-nums",
									!variantStock && "line-through"
								)}
							>
								{fmtNumericBRL(vPrice)}
							</span>
						)}
					</button>
				);
			})}
		</div>
	</div>
)}
```

- [ ] **Step 3: Selos com borda hairline + 3º selo "Compra segura"**

Trocar o bloco final (`<div className="flex h-16 justify-between rounded-sm bg-gray-10 px-5">`) por uma faixa com borda hairline e 3 selos divididos. Importar `ShieldCheck` de `lucide-react` (adicionar ao import existente):

```tsx
<div className="flex border border-border">
	<div className="flex flex-1 items-center gap-2.5 border-border border-r px-4 py-3">
		<Truck size={16} />
		<div>
			<div className="font-semibold text-[12px]">Frete Brasil</div>
			<div className="text-[10.5px] text-gray-60">pelo seu CEP</div>
		</div>
	</div>
	<div className="flex flex-1 items-center gap-2.5 border-border border-r px-4 py-3">
		<CheckCircle size={16} />
		<div>
			<div className="font-semibold text-[12px]">Garantia 2 anos</div>
			<div className="text-[10.5px] text-gray-60">com a marca</div>
		</div>
	</div>
	<div className="flex flex-1 items-center gap-2.5 px-4 py-3">
		<ShieldCheck size={16} />
		<div>
			<div className="font-semibold text-[12px]">Compra segura</div>
			<div className="text-[10.5px] text-gray-60">nota fiscal</div>
		</div>
	</div>
</div>
```

- [ ] **Step 4: check-types**

Run: `bun check-types`
Expected: sem erros. (Conferir que `ShieldCheck` foi adicionado ao import de `lucide-react` e que `applyDiscount` está acessível no escopo do `.map`.)

- [ ] **Step 5: Smoke visual**

Em `:3008` na PDP da furadeira: badge `−15%` + "Você economiza R$ …" (a furadeira tem promoção ativa); cards de variante só com voltagem (preços iguais → sem preço no card); selos com borda visível separando do fundo; "Voltagem" como label.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(shop)/product/[slug]/_components/product-info.tsx
git commit -m "feat: bloco de compra com desconto, selos hairline e variantes limpas"
```

---

### Task 5: Comentários dark `ProductReviews` — 2 colunas + distribuição

Edita `product-reviews.tsx` para tema escuro, resumo com barras de distribuição e lista em 2 colunas. Fonte visual: `comentarios-dark-v2.html`. `ReviewList` é renderizada dentro — restilizar o container; itens individuais ficam para ajuste fino no smoke.

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-reviews.tsx`
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/review-list.tsx` (ajuste de tema, se necessário no smoke)

- [ ] **Step 1: Reescrever o markup de `ProductReviews`**

Read o arquivo. Manter `recommendPct`, props e `ReviewList`. Trocar o JSX do `return` por seção escura com resumo 2-col (média+estrelas | barras) e a lista. Adicionar render das barras a partir de `stats.distribution`:

```tsx
const total =
	stats.distribution[1] +
	stats.distribution[2] +
	stats.distribution[3] +
	stats.distribution[4] +
	stats.distribution[5];
const bars = ([5, 4, 3, 2, 1] as const).map((star) => ({
	star,
	pct: total > 0 ? Math.round((stats.distribution[star] / total) * 100) : 0,
}));

return (
	<section className="emach-bg-cinema text-white [color-scheme:dark]">
		<div className="px-20 pt-12 pb-2">
			<SectionLabel tone="accent">O que dizem os clientes</SectionLabel>
		</div>
		<div className="grid grid-cols-1 border-white/15 border-y md:grid-cols-[300px_1fr]">
			<div className="flex flex-col justify-center gap-2 border-white/15 px-20 py-6 md:border-r md:px-10">
				<div className="flex items-baseline gap-2 font-display font-medium text-[56px] leading-none tabular-nums">
					{avg.toFixed(1).replace(".", ",")}
					<span className="text-[20px] text-white/50">/ 5</span>
				</div>
				<StarRating rating={avg} size={16} />
				<div className="text-[13.5px] text-white/70">
					<strong className="text-white">{stats.count}</strong> avaliações ·{" "}
					<strong className="text-white">{recommend}%</strong> recomendam
				</div>
			</div>
			<div className="flex flex-col justify-center gap-2 px-20 py-6 md:px-10">
				{bars.map((b) => (
					<div className="flex items-center gap-3 text-[13px]" key={b.star}>
						<span className="w-9 flex-none font-semibold">{b.star} ★</span>
						<span className="h-[7px] flex-1 bg-white/10">
							<span
								className="block h-full bg-emach-red"
								style={{ width: `${b.pct}%` }}
							/>
						</span>
						<span className="w-10 text-right tabular-nums">{b.pct}%</span>
					</div>
				))}
			</div>
		</div>
		<div className="border-white/12 border-b px-20 py-3.5 md:px-10">
			<span className="font-display font-semibold text-[11px] text-white/60 uppercase tracking-[0.12em]">
				{total} avaliações
			</span>
		</div>
		<ReviewList
			currentSearchParams={currentSearchParams}
			gridCols2
			page={page}
			pageSize={pageSize}
			pathname={pathname}
			reviews={reviews}
			sort={sort}
			total={total}
		/>
	</section>
);
```

- [ ] **Step 2: Adicionar layout 2-colunas em `ReviewList`**

Read `review-list.tsx`. Adicionar prop opcional `gridCols2?: boolean`. Quando true, o container da lista usa `grid grid-cols-1 md:grid-cols-2` com divisórias (`border-white/12`, ímpar `md:border-r`). Cada item: avatar de iniciais + nome + estrelas + data + texto, em tons claros sobre escuro (`text-white`, `text-white/72`). Manter a lógica de ordenação/paginação. Se a restilização ficar grande, isolar um sub-componente de item.

- [ ] **Step 3: check-types**

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 4: Smoke visual**

Em `:3008` na furadeira (tem reviews): seção escura, média grande, barras vermelhas de distribuição, reviews em 2 colunas com divisória central, legível.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(shop)/product/[slug]/_components/product-reviews.tsx apps/web/src/app/(shop)/product/[slug]/_components/review-list.tsx
git commit -m "feat: comentários em tema dark com distribuição e 2 colunas"
```

---

### Task 6: Recompor `page.tsx` — remover breadcrumb e reordenar

Amarra tudo: tira o breadcrumb e aplica a ordem chiaroscuro.

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/page.tsx`

- [ ] **Step 1: Remover o breadcrumb e seus imports**

Read `page.tsx`. Remover o `import { Breadcrumb, ... } from "@emach/ui/components/breadcrumb"`, o `import Link` se não usado em outro lugar do arquivo, e o `<div className="border-border border-b px-20 py-4">…</div>` inteiro (linhas ~114-140). Remover variáveis que ficarem órfãs (`primaryCategoryName`/`primaryCategorySlug` ainda são usadas por `ProductInfo` — manter).

- [ ] **Step 2: Reordenar as seções**

Ajustar o JSX para a ordem: galeria+info → `ProductSpecs` → `RelatedProducts` → `ProductReviews`:

```tsx
<div className="flex flex-row justify-center py-8">
	<ProductGallery
		categorySlug={primaryCategorySlug ?? ""}
		images={detail.images}
		name={detail.tool.name}
	/>
	<ProductInfo
		activePromotion={detail.activePromotion}
		primaryCategoryName={primaryCategoryName}
		primaryCategorySlug={primaryCategorySlug}
		primaryImageUrl={primaryImageUrl}
		reviewStats={detail.reviewStats}
		stockByVariant={detail.stockByVariant}
		tool={detail.tool}
		variants={detail.variants}
	/>
</div>

<ProductSpecs attributes={detail.attributes} tool={detail.tool} />

<RelatedProducts
	categoryPath={detail.primaryCategory?.path ?? null}
	toolId={detail.tool.id}
/>

{reviewsResult.total > 0 && (
	<ProductReviews
		currentSearchParams={sp}
		page={reviewPage}
		pageSize={REVIEWS_PER_PAGE}
		pathname={pathname}
		reviews={reviewsResult.reviews}
		sort={reviewSort}
		stats={detail.reviewStats}
		total={reviewsResult.total}
	/>
)}
```

Remover o `import { ProductTabs }` antigo se ainda presente (já trocado na Task 3).

- [ ] **Step 3: Remover o `<Separator>` duplicado de `related-products.tsx`**

Read `related-products.tsx`. Como Relacionados agora fica entre duas seções (ficha escura acima, comentários escuros abaixo), o `<Separator />` do topo e o padding podem precluir o ritmo. Remover o `<Separator className="" />` e o fragmento `<>...</>`, deixando só a `<section className="px-20 pt-16 pb-20">…</section>` (superfície clara, separada por contraste das vizinhas escuras).

- [ ] **Step 4: check-types**

Run: `bun check-types`
Expected: sem erros (sem imports órfãos).

- [ ] **Step 5: Smoke visual da página inteira**

Em `:3008` na furadeira: sem breadcrumb; ordem Detalhes(claro) → Ficha(escuro) → Relacionados(claro) → Comentários(escuro); transições de cor nítidas; nenhum erro no watcher.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(shop)/product/[slug]/page.tsx apps/web/src/app/(shop)/product/[slug]/_components/related-products.tsx
git commit -m "feat: PDP sem breadcrumb e com ordem claro/escuro"
```

---

## Finalização

Após a Task 6, com `bun check-types` limpo e smoke visual OK em todas as seções:
- Invocar `superpowers:finishing-a-development-branch`.
- **Abrir PR** da branch `tela-compra` com todos os commits (pedido explícito do usuário): spec + 6 tasks. Título sugerido: `feat: redesign da página de produto (PDP) chiaroscuro`. Corpo: resumo das 4 seções + link pro spec.

## Self-Review (cobertura do spec)

- Breadcrumb removido → Task 6 ✓
- Ficha escura 2-col, escala, sem aba Entrega → Task 3 ✓
- Fix numérico PT-BR → Task 1 (+ uso na Task 3) ✓
- Ordem chiaroscuro / Relacionados sobe → Task 6 ✓
- Comentários dark + distribuição + 2 colunas → Task 5 ✓
- Bloco compra: desconto/economia + selos hairline + variantes limpas + "Voltagem" + esgotado visual → Task 4 ✓
- Seed dev de specs → Task 2 ✓
- Galeria (no-op) → coberto pelo smoke da Task 6 ✓
- PR final → Finalização ✓
