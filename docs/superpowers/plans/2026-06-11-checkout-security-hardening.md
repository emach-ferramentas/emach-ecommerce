# Hardening de Segurança do Checkout — Plano de Implementação

> **Status em 2026-09-28:** implementado (PR #102). Os arquivos da seção File Structure existem, exceto que `rls.sql` hoje é cópia sincronizada do dashboard e cobre 14 tabelas. Os checkboxes abaixo não foram marcados.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar três achados de segurança no checkout/DB (RLS ausente, IP spoofável no consentLog, actions sem rate limit) em um PR único.

**Architecture:** Helper puro de extração de IP confiável; limiter com `@upstash/ratelimit` + fallback in-memory reusando o client de `@emach/redis`; mensagens de cupom colapsadas na action (anti-enumeração); RLS deny-all aplicado via MCP Supabase e versionado em SQL.

**Tech Stack:** Next.js server actions, Drizzle, vitest, `@upstash/ratelimit`, `@emach/redis` (package do PR de auth), Supabase MCP.

---

## Dependências e ordem de execução

- **Tasks 1–2 (#95)** e **Task 7 (#90)** — executáveis **imediatamente**, sem dependência externa.
- **Tasks 3–6 (#94)** — **gated** no package `@emach/redis` e nas envs `UPSTASH_REDIS_REST_URL`/`_TOKEN`, que nascem no PR de auth (#91/#92/#96) e mergeiam **antes**. Não iniciar as Tasks 3–6 antes do `@emach/redis` estar disponível (senão `check-types` quebra no import). O usuário avisa quando o PR de auth mergear. _Nota 2026-09-28: o PR de auth (#99) mergeou antes e `@emach/redis` existe em `packages/redis`._

## File Structure

- `apps/web/src/lib/client-ip.ts` — **criar.** Helper puro: extrai IP confiável dos headers.
- `apps/web/src/lib/client-ip.test.ts` — **criar.** Testes do helper.
- `apps/web/src/app/checkout/_actions/create-order.ts` — **modificar.** Usar o helper de IP + rate limit.
- `apps/web/src/lib/rate-limit.ts` — **criar.** Limiters (cupom/pedido/frete) com fallback in-memory.
- `apps/web/src/lib/rate-limit.test.ts` — **criar.** Testes do fallback in-memory.
- `apps/web/src/lib/coupons/validate-coupon.ts` — **modificar.** Adicionar `reason` ao retorno de falha.
- `apps/web/src/lib/coupons/validate-coupon.test.ts` — **modificar.** Assertar `reason`.
- `apps/web/src/app/checkout/_actions/apply-coupon.ts` — **modificar.** Rate limit + colapso de mensagem.
- `apps/web/src/app/checkout/_actions/quote-shipping.ts` — **modificar.** Rate limit por IP.
- `packages/db/src/sql/rls.sql` — **criar.** SQL idempotente de ENABLE RLS. _Nota 2026-09-28: hoje é cópia sincronizada do `emach-dashboard`, com 14 tabelas (inclui `cart_event`)._
- `packages/db/CLAUDE.md` — **modificar.** Nota sobre o RLS.

---

## Task 1: Helper `getClientIp` (#95)

**Files:**
- Create: `apps/web/src/lib/client-ip.ts`
- Test: `apps/web/src/lib/client-ip.test.ts`

- [ ] **Step 1: (opcional) confirmar header canônico da Vercel**

Antes de fixar a ordem, confirmar via `find-docs` que na Vercel o IP confiável do cliente vem em `x-real-ip` (e que o **primeiro** elemento de `x-forwarded-for` é controlável pelo cliente). Se a doc divergir, ajustar a precedência no Step 3.

- [ ] **Step 2: Escrever o teste que falha**

```ts
// apps/web/src/lib/client-ip.test.ts
import { describe, expect, it } from "vitest";

import { getClientIp } from "./client-ip";

describe("getClientIp", () => {
	it("prefere x-real-ip quando presente", () => {
		const h = new Headers({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "1.2.3.4" });
		expect(getClientIp(h)).toBe("203.0.113.5");
	});

	it("usa o ÚLTIMO hop de x-forwarded-for (primeiro é spoofável)", () => {
		const h = new Headers({ "x-forwarded-for": "1.2.3.4, 9.9.9.9" });
		expect(getClientIp(h)).toBe("9.9.9.9");
	});

	it("um X-Forwarded-For forjado no início não altera o resultado", () => {
		const h = new Headers({ "x-forwarded-for": "66.66.66.66, 203.0.113.5" });
		expect(getClientIp(h)).toBe("203.0.113.5");
	});

	it("retorna o único elemento em dev (sem proxy)", () => {
		const h = new Headers({ "x-forwarded-for": "127.0.0.1" });
		expect(getClientIp(h)).toBe("127.0.0.1");
	});

	it("retorna null quando nenhum header está presente", () => {
		expect(getClientIp(new Headers())).toBeNull();
	});
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `cd apps/web && bunx vitest run src/lib/client-ip.test.ts`
Expected: FAIL — `getClientIp is not defined` / módulo não encontrado.

- [ ] **Step 4: Implementar o helper**

```ts
// apps/web/src/lib/client-ip.ts

/**
 * IP confiável do cliente a partir dos headers da request.
 *
 * Precedência:
 *  1. `x-real-ip` — IP real injetado pelo proxy confiável (Vercel).
 *  2. ÚLTIMO elemento de `x-forwarded-for` — o hop adicionado pelo proxy.
 *     O PRIMEIRO elemento é controlado pelo cliente (spoofável) e nunca é usado.
 *  3. `null` se nenhum header estiver presente.
 *
 * Em dev local (sem proxy) o `x-forwarded-for` costuma ter um único elemento,
 * que é retornado como está.
 */
export function getClientIp(headers: Headers): string | null {
	const realIp = headers.get("x-real-ip")?.trim();
	if (realIp) {
		return realIp;
	}

	const forwarded = headers.get("x-forwarded-for");
	if (forwarded) {
		const hops = forwarded
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		if (hops.length > 0) {
			return hops[hops.length - 1];
		}
	}

	return null;
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd apps/web && bunx vitest run src/lib/client-ip.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/client-ip.ts apps/web/src/lib/client-ip.test.ts
git commit -m "feat: helper getClientIp com IP confiável (#95)"
```

---

## Task 2: Usar `getClientIp` no `create-order` (#95)

**Files:**
- Modify: `apps/web/src/app/checkout/_actions/create-order.ts:37-39`

- [ ] **Step 1: Confirmar que não há outros pontos gravando IP**

Run: `rg -n "x-forwarded-for" apps/web/src`
Expected: o único match relevante é `create-order.ts`. Se houver outro ponto gravando IP, migrá-lo também para `getClientIp` neste mesmo task.

- [ ] **Step 2: Trocar a extração manual pelo helper**

Em `apps/web/src/app/checkout/_actions/create-order.ts`, adicionar o import e trocar as linhas 37-40.

Adicionar ao bloco de imports:

```ts
import { getClientIp } from "@/lib/client-ip";
```

Substituir:

```ts
	const reqHeaders = await headers();
	const ipAddress =
		reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
	const userAgent = reqHeaders.get("user-agent") ?? null;
```

por:

```ts
	const reqHeaders = await headers();
	const ipAddress = getClientIp(reqHeaders);
	const userAgent = reqHeaders.get("user-agent") ?? null;
```

- [ ] **Step 3: Verificar tipos**

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/checkout/_actions/create-order.ts
git commit -m "fix: gravar IP confiável no consentLog via getClientIp (#95)"
```

---

## Task 3: Limiter com fallback in-memory (#94)

> **GATED:** requer `@emach/redis` disponível (PR de auth mergeado).

**Files:**
- Create: `apps/web/src/lib/rate-limit.ts`
- Test: `apps/web/src/lib/rate-limit.test.ts`

- [ ] **Step 1: Instalar a dependência**

Run: `cd apps/web && bun add @upstash/ratelimit`
Expected: `@upstash/ratelimit` em `apps/web/package.json` (o `@upstash/redis` vem transitivamente via `@emach/redis`).

- [ ] **Step 2: Escrever o teste que falha**

```ts
// apps/web/src/lib/rate-limit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Sem Redis → o limiter cai no fallback in-memory.
vi.mock("@emach/redis", () => ({ getRedis: () => null }));

describe("rate-limit (fallback in-memory)", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("permite até o limite e bloqueia o excedente por chave", async () => {
		const { couponLimiter } = await import("./rate-limit");
		const key = "coupon:cliente-1";
		const results: boolean[] = [];
		for (let i = 0; i < 11; i++) {
			const { success } = await couponLimiter.limit(key);
			results.push(success);
		}
		// 10 permitidos (limite do cupom), o 11º bloqueado
		expect(results.slice(0, 10).every(Boolean)).toBe(true);
		expect(results[10]).toBe(false);
	});

	it("isola contadores por chave", async () => {
		const { orderLimiter } = await import("./rate-limit");
		for (let i = 0; i < 5; i++) {
			await orderLimiter.limit("order:cliente-A");
		}
		const { success } = await orderLimiter.limit("order:cliente-B");
		expect(success).toBe(true);
	});
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `cd apps/web && bunx vitest run src/lib/rate-limit.test.ts`
Expected: FAIL — módulo `./rate-limit` não existe.

- [ ] **Step 4: Implementar o limiter**

```ts
// apps/web/src/lib/rate-limit.ts
import { getRedis } from "@emach/redis";
import { Ratelimit } from "@upstash/ratelimit";

export interface Limiter {
	limit(key: string): Promise<{ success: boolean }>;
}

/** Janela de 60s para todos os limiters do checkout. */
const WINDOW_MS = 60_000;

/**
 * Fallback in-memory: BEST-EFFORT. Em serverless cada instância (lambda) tem o
 * próprio Map — o contador reseta em cold start e NÃO é compartilhado entre
 * instâncias. Serve para dev local e como degradação graciosa enquanto o
 * Upstash não está provisionado; o modo durável liga sozinho quando
 * `getRedis()` passa a devolver um client.
 */
function memoryLimiter(max: number): Limiter {
	const hits = new Map<string, number[]>();
	return {
		limit(key) {
			const now = Date.now();
			const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
			recent.push(now);
			hits.set(key, recent);
			return Promise.resolve({ success: recent.length <= max });
		},
	};
}

function createLimiter(max: number): Limiter {
	const redis = getRedis();
	if (redis) {
		return new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(max, "60 s"),
			prefix: "checkout",
		});
	}
	return memoryLimiter(max);
}

export const couponLimiter = createLimiter(10);
export const orderLimiter = createLimiter(5);
export const shippingLimiter = createLimiter(20);

export const RATE_LIMIT_MESSAGE = "Muitas tentativas, aguarde um instante";
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd apps/web && bunx vitest run src/lib/rate-limit.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/rate-limit.ts apps/web/src/lib/rate-limit.test.ts apps/web/package.json
git commit -m "feat: rate limiter do checkout (Upstash + fallback in-memory) (#94)"
```

---

## Task 4: `reason` no `validateCoupon` (#94)

**Files:**
- Modify: `apps/web/src/lib/coupons/validate-coupon.ts`
- Test: `apps/web/src/lib/coupons/validate-coupon.test.ts`

- [ ] **Step 1: Adicionar os testes de `reason` (falham)**

Adicionar dentro do `describe("validateCoupon", ...)` em `validate-coupon.test.ts`. Reusam os mesmos cupons já mockados nos testes existentes (`NOPE` inexistente, `VELHO` expirado, `CHEIO` esgotado, `MIN` pedido mínimo). Cada caso de falha deve expor o `reason` correto:

```ts
	it("classifica reason=invalid para cupom inexistente/inativo", async () => {
		const result = await validateCoupon(tx, "NOPE", [line(toolId, 10_000)]);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("invalid");
		}
	});

	it("classifica reason=expired para cupom expirado", async () => {
		const result = await validateCoupon(tx, "VELHO", [line(toolId, 10_000)]);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("expired");
		}
	});

	it("classifica reason=exhausted para cupom esgotado", async () => {
		const result = await validateCoupon(tx, "CHEIO", [line(toolId, 10_000)]);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("exhausted");
		}
	});

	it("classifica reason=min_order para pedido mínimo não atingido", async () => {
		const result = await validateCoupon(tx, "MIN", [line(toolId, 10_000)]);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("min_order");
		}
	});
```

> Nota: os mocks `NOPE`/`VELHO`/`CHEIO`/`MIN` já existem nos testes atuais (linhas 123/132/144/153). Se algum nome divergir no arquivo real, reutilizar o cupom correspondente já mockado em vez de criar outro.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/web && bunx vitest run src/lib/coupons/validate-coupon.test.ts`
Expected: FAIL — `reason` é `undefined`.

- [ ] **Step 3: Adicionar `reason` ao tipo e a cada retorno de falha**

Em `validate-coupon.ts`, substituir o tipo `CouponValidation` (linhas 17-19) por:

```ts
export type CouponFailReason =
	| "empty"
	| "invalid"
	| "expired"
	| "exhausted"
	| "not_eligible"
	| "min_order";

/** Razões que revelam EXISTÊNCIA do código → colapsar em msg genérica (anti-enumeração). */
export const ENUMERABLE_REASONS = new Set<CouponFailReason>([
	"empty",
	"invalid",
	"expired",
	"exhausted",
]);

export type CouponValidation =
	| { ok: true; discountCents: number; promotionId: string }
	| { ok: false; error: string; reason: CouponFailReason };
```

Adicionar `reason` em cada retorno de falha existente:

```ts
	// linha ~42 (code vazio)
	if (!code) {
		return { ok: false, error: "Cupom inválido", reason: "empty" };
	}
```
```ts
	// !promo?.active
	if (!promo?.active) {
		return { ok: false, error: "Cupom inválido", reason: "invalid" };
	}
	if (promo.startsAt && promo.startsAt > now) {
		return { ok: false, error: "Cupom inválido", reason: "invalid" };
	}
	if (promo.endsAt && promo.endsAt <= now) {
		return { ok: false, error: "Cupom expirado", reason: "expired" };
	}
	if (
		promo.maxRedemptions !== null &&
		promo.redemptionCount >= promo.maxRedemptions
	) {
		return { ok: false, error: "Cupom esgotado", reason: "exhausted" };
	}
```
```ts
	// eligibleSubtotalCents === 0
	if (eligibleSubtotalCents === 0) {
		return {
			ok: false,
			error: "Cupom não cobre nenhum item do carrinho",
			reason: "not_eligible",
		};
	}
```
```ts
	// pedido mínimo
	if (promo.minOrderAmount !== null) {
		const minCents = numericToCents(promo.minOrderAmount);
		if (eligibleSubtotalCents < minCents) {
			return {
				ok: false,
				error: `Pedido mínimo de ${fmtNumericBRL(promo.minOrderAmount)}`,
				reason: "min_order",
			};
		}
	}
```

- [ ] **Step 4: Rodar os testes (novos + existentes) e confirmar que passam**

Run: `cd apps/web && bunx vitest run src/lib/coupons/validate-coupon.test.ts`
Expected: PASS — testes antigos (mensagens inalteradas) + 4 novos de `reason`.

- [ ] **Step 5: Verificar que `place-order` continua compilando**

`place-order.ts:407` consome `validateCoupon`. Adicionar um campo ao retorno de falha não quebra (lê `.ok`/`.error`/`.discountCents`).

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/coupons/validate-coupon.ts apps/web/src/lib/coupons/validate-coupon.test.ts
git commit -m "feat: reason no validateCoupon para anti-enumeração (#94)"
```

---

## Task 5: Anti-enumeração no `apply-coupon` + rate limit (#94)

**Files:**
- Modify: `apps/web/src/app/checkout/_actions/apply-coupon.ts`

- [ ] **Step 1: Aplicar rate limit e colapsar a mensagem**

Adicionar imports:

```ts
import {
	type CouponLine,
	ENUMERABLE_REASONS,
	validateCoupon,
} from "@/lib/coupons/validate-coupon";
import { couponLimiter, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
```

Capturar a sessão e aplicar o limiter logo após o parse. Trocar:

```ts
	await requireCurrentClient();
	const { code, cartItems } = parsed.data;
```

por:

```ts
	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { code, cartItems } = parsed.data;

	const { success } = await couponLimiter.limit(`coupon:${clientId}`);
	if (!success) {
		return { ok: false, error: RATE_LIMIT_MESSAGE };
	}
```

Colapsar a mensagem na falha de validação. Trocar:

```ts
		const result = await validateCoupon(db, code, lines);
		if (!result.ok) {
			return { ok: false, error: result.error };
		}
```

por:

```ts
		const result = await validateCoupon(db, code, lines);
		if (!result.ok) {
			if (ENUMERABLE_REASONS.has(result.reason)) {
				// Anti-enumeração: motivo real só no evlog; usuário vê msg genérica.
				log.warn({
					action: "coupon_rejected",
					reason: result.reason,
				});
				return { ok: false, error: "Cupom inválido ou indisponível" };
			}
			return { ok: false, error: result.error };
		}
```

> Nota: o `code` foi removido do log para não registrar tentativas de enumeração em texto; o `reason` é suficiente para debug. Se `log.warn` não existir no evlog, usar `log.info`.

- [ ] **Step 2: Verificar tipos**

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/checkout/_actions/apply-coupon.ts
git commit -m "feat: rate limit + anti-enumeração no applyCouponAction (#94)"
```

---

## Task 6: Rate limit no `create-order` e `quote-shipping` (#94)

**Files:**
- Modify: `apps/web/src/app/checkout/_actions/create-order.ts`
- Modify: `apps/web/src/app/checkout/_actions/quote-shipping.ts`

- [ ] **Step 1: Rate limit por `clientId` no `create-order`**

Em `create-order.ts`, adicionar o import:

```ts
import { orderLimiter, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
```

Logo após obter `clientId` (`const clientId = session.user.id;`), adicionar:

```ts
	const { success } = await orderLimiter.limit(`order:${clientId}`);
	if (!success) {
		return { ok: false, error: RATE_LIMIT_MESSAGE };
	}
```

- [ ] **Step 2: Rate limit por IP no `quote-shipping` (action pública)**

Em `quote-shipping.ts`, adicionar os imports:

```ts
import { headers } from "next/headers";

import { getClientIp } from "@/lib/client-ip";
import { shippingLimiter, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
```

Logo após o parse de `inputSchema` (depois do `if (!parsed.success)`), adicionar:

```ts
	// Action pública (usada no freight-calculator da página de produto) → sem
	// sessão; rate limit por IP confiável. IP ausente cai no bucket "anon".
	const ip = getClientIp(await headers()) ?? "anon";
	const { success } = await shippingLimiter.limit(`shipping:${ip}`);
	if (!success) {
		return { ok: false, error: RATE_LIMIT_MESSAGE };
	}
```

- [ ] **Step 3: Verificar tipos**

Run: `bun check-types`
Expected: sem erros.

- [ ] **Step 4: Smoke real do checkout**

Run: `bun dev:web` e percorrer: página de produto (calcular frete) → carrinho → checkout (aplicar cupom válido, cotar frete, revisar pedido). Confirmar que o fluxo normal NÃO é bloqueado.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/checkout/_actions/create-order.ts apps/web/src/app/checkout/_actions/quote-shipping.ts
git commit -m "feat: rate limit em createOrder (clientId) e quoteShipping (IP) (#94)"
```

---

## Task 7: RLS deny-all nas 13 tabelas `public` (#90)

> Operação de infra executada no **main loop** com o MCP Supabase (não delegar a subagent genérico). Banco de **produção compartilhado** — a pré-checagem é um gate de segurança.

**Files:**
- Create: `packages/db/src/sql/rls.sql`
- Modify: `packages/db/CLAUDE.md`

- [ ] **Step 1: GATE — confirmar que nenhum repo usa anon key nessas tabelas**

```bash
rg -n "createClient" --glob '*.ts' --glob '*.tsx' .
rg -n "@supabase/supabase-js" --glob '*.ts' --glob '*.tsx' .
```

Repetir no repo irmão `emach-dashboard`. Confirmar que **não** há leitura/escrita via `supabase-js` com anon key nas 13 tabelas. Confirmar que o role do Drizzle (`DATABASE_URL`) é owner ou tem `BYPASSRLS` — acesso server-side não pode quebrar com RLS.

**Se aparecer qualquer uso de anon key nessas tabelas → PARAR e reportar ao usuário antes de aplicar.**

- [ ] **Step 2: Criar o SQL versionado**

```sql
-- packages/db/src/sql/rls.sql
-- RLS deny-all (sem policies) nas tabelas public expostas via PostgREST.
-- O app não usa PostgREST (acesso é server-side via Drizzle/DATABASE_URL, role
-- owner que bypassa RLS); habilitar RLS fecha a porta REST sem afetar o app.
-- Owned-by-dashboard (ADR-0009): canônico deve viver no emach-dashboard.
-- Idempotente: ENABLE ROW LEVEL SECURITY é no-op se já habilitado.
ALTER TABLE public.tool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_image ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_attribute_value ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_attribute_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_level ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_tool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review ENABLE ROW LEVEL SECURITY;
```

> Confirmar os nomes reais das 13 tabelas no banco antes de aplicar (Step 3 lista). Ajustar nomes se algum divergir do snake_case acima.

- [ ] **Step 3: Conferir os nomes reais e o estado atual**

Usar MCP `mcp__supabase__execute_sql`:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tool','tool_variant','tool_image','tool_category',
    'tool_attribute_value','tool_attribute_assignment','attribute_definition',
    'category','branch','stock_level','promotion','promotion_tool','review')
ORDER BY tablename;
```
Expected: 13 linhas, `rowsecurity = false` (estado inicial). Se algum nome não retornar, corrigir o SQL no Step 2.

- [ ] **Step 4: Aplicar o RLS via MCP**

Executar o conteúdo de `rls.sql` via `mcp__supabase__execute_sql`.
Expected: sucesso, sem erro.

- [ ] **Step 5: Verificar `pg_tables`**

Rodar a query do Step 3 de novo.
Expected: 13 linhas com `rowsecurity = true`.

- [ ] **Step 6: Rodar o advisor de segurança**

Usar `mcp__supabase__get_advisors` com `type=security`.
Expected: nenhum `rls_disabled_in_public` para as 13 tabelas.

- [ ] **Step 7: Smoke do storefront**

Run: `bun dev:web` — abrir home, página de produto, e checkout até a revisão. Catálogo e estoque devem carregar normalmente (acesso via Drizzle não é afetado).

- [ ] **Step 8: Abrir issue no dashboard**

```bash
gh issue create --repo othavioquiliao/emach-dashboard \
  --title "infra: avaliar versionar ENABLE RLS (deny-all) das 13 tabelas public em ADR/SQL canônico" \
  --body "RLS deny-all foi aplicado nas 13 tabelas public expostas via PostgREST (issue #90 do ecommerce). O SQL foi versionado em packages/db/src/sql/rls.sql no ecommerce como cópia, mas a infra DB é owned-by-dashboard (ADR-0009). Avaliar se o ENABLE RLS deve virar arquivo SQL canônico aqui (precedente: triggers.sql) e/ou ADR. Tabelas: tool, tool_variant, tool_image, tool_category, tool_attribute_value, tool_attribute_assignment, attribute_definition, category, branch, stock_level, promotion, promotion_tool, review."
```

- [ ] **Step 9: Nota no `packages/db/CLAUDE.md`**

Adicionar uma linha na seção de gotchas registrando que o RLS deny-all está aplicado e versionado em `sql/rls.sql`, owned-by-dashboard, e que pós-`db:push` em dev local não é necessário reaplicar (é uma flag de tabela, não recriada pelo push).

- [ ] **Step 10: Commit**

```bash
git add packages/db/src/sql/rls.sql packages/db/CLAUDE.md
git commit -m "feat: RLS deny-all nas 13 tabelas public expostas via PostgREST (#90)"
```

---

## Finalização

- [ ] **Rodar a suíte completa e os tipos**

Run: `bun check-types && cd apps/web && bunx vitest run`
Expected: tudo verde.

- [ ] **Abrir o PR com fechamento automático dos issues**

```bash
git push -u origin 90-95-94
gh pr create --title "sec: hardening do checkout (RLS, IP confiável, rate limit)" \
  --body "$(cat <<'EOF'
## Resumo
Três fixes de segurança no checkout/DB (spec: docs/superpowers/specs/2026-06-11-checkout-security-hardening-design.md).

- **#90** RLS deny-all nas 13 tabelas public expostas via PostgREST.
- **#95** IP confiável no consentLog via helper getClientIp (x-forwarded-for spoofável).
- **#94** Rate limit (Upstash + fallback in-memory) + anti-enumeração de cupom nas actions de checkout.

## Notas
- Rate limit reusa o client de @emach/redis (PR de auth) com fallback in-memory.
- RLS aplicado via MCP Supabase; SQL versionado em packages/db/src/sql/rls.sql (canônico avaliado no dashboard).

Closes #90
Closes #94
Closes #95
EOF
)"
```

`Closes #90/#94/#95` no corpo do PR fecha os três automaticamente quando o PR for mergeado na branch default.

---

## Self-Review

**Spec coverage:**
- #90 → Task 7 (pré-checagem, SQL, aplicação MCP, advisor, issue dashboard, doc). ✓
- #95 → Tasks 1–2 (helper + troca em create-order + varredura de outros pontos). ✓
- #94 storage → Task 3 (Upstash + fallback). ✓ / chaves clientId+IP → Tasks 5–6. ✓ / anti-enumeração → Tasks 4–5. ✓ / mensagem genérica de limite → Tasks 5–6. ✓
- Fechamento automático dos issues → Finalização. ✓

**Type consistency:** `Limiter.limit(key) → Promise<{success}>` usado consistentemente (Upstash `Ratelimit` e `memoryLimiter` expõem a mesma assinatura). `getClientIp(headers: Headers): string | null` consistente entre Tasks 1, 2 e 6. `ENUMERABLE_REASONS`/`CouponFailReason` definidos na Task 4 e consumidos na Task 5. `RATE_LIMIT_MESSAGE` definido na Task 3 e usado nas Tasks 5–6.

**Placeholders:** nenhum TBD/TODO; todo step de código tem o código.
