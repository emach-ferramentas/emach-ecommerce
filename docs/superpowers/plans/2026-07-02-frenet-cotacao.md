# Frenet na Cotação de Frete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o motor de cotação de frete (tabelas próprias) pela API da Frenet, preservando o contrato `{negotiate, options}` do adapter, o anti-fraude do checkout e o empacotamento local, e passando a persistir o serviço escolhido no pedido.

**Architecture:** O adapter `apps/web/src/lib/shipping/quote.ts` mantém a assinatura pública e troca o miolo: carrinho → `packItems` (caixas reais do catálogo `shippingBox`) → cache Redis (TTL 30min) → `POST api.frenet.com.br/shipping/quote` → mapeamento para `ShippingOption[]`. `packages/db` não é editado. Spec aprovado: `docs/superpowers/specs/2026-07-02-frenet-cotacao-design.md`.

**Tech Stack:** Next.js 16 (server actions), Zod 4, Vitest (unit-only no CI), `@emach/redis` (Upstash REST + fallback in-memory), evlog, Biome/ultracite.

## Global Constraints

- **Nunca editar `packages/db/src/{schema,queries}`** — território do sync ADR-0009. `packItems`/`getActiveBoxes` são importados, não modificados.
- **Proibido:** `console.*` (usar `import { log } from "@/lib/evlog"`), `: any`/`as any`/`@ts-ignore`, barrel files em `apps/web/src`, `.forEach()` em hot path.
- Catch de server action: **sempre** `log.error({ action, ...context })` antes de retornar `{ ok: false }`.
- Estilo: tabs, aspas duplas, comentários em PT (Biome/ultracite — o hook de lint roda no edit).
- Commits: Conventional Commits em PT, subject ≤50 chars.
- Testes novos são **unit** (não adicionar nada à lista `INTEGRATION` de `apps/web/vitest.config.ts`).
- Rodar `bun check-types` antes de cada commit.
- Comando de teste: `bun run --filter=web test <path>` (ex.: `bun run --filter=web test src/lib/frenet/client.test.ts`).
- **Read cada arquivo antes de Edit** (`cat`/`sed`/`head` não contam pro harness); se Edit falhar com `string not found`, re-Read antes de re-tentar.
- A suíte completa (`bun run --filter=web test`) tem testes de integração flaky sob concorrência (contenção no Supabase compartilhado) — falha em `place-order.test.ts` que some ao re-rodar isolado **não** é regressão deste plano.

---

### Task 1: Envs Frenet + dummy por validador nos testes

**Files:**
- Modify: `packages/env/src/schemas.ts`
- Modify: `apps/web/vitest.setup.ts`
- Modify: `apps/web/.env.example`

**Interfaces:**
- Consumes: —
- Produces: `env.FRENET_TOKEN: string`, `env.FRENET_SELLER_CEP: string` (8 dígitos), `env.FRENET_BASE_URL: string` (default `https://api.frenet.com.br`) via `import { env } from "@emach/env/server"`. Tasks 2 e 5 dependem disto.

**Contexto:** `FRENET_SELLER_CEP` tem regex estrita (`/^\d{8}$/`). O `vitest.setup.ts` injeta UM dummy genérico (URL) em toda obrigatória ausente no CI — esse dummy falharia a regex e abortaria a suíte inteira na validação do `@emach/env`. O fix é tornar a escolha do dummy ciente do validador (tenta cada candidato com `safeParse`).

- [ ] **Step 1: Adicionar as envs Frenet ao serverSchema**

Em `packages/env/src/schemas.ts`, dentro de `serverSchema`, após o bloco `UPSTASH_*`:

```ts
	UPSTASH_REDIS_REST_URL: z.url().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
	// Frenet — cotação de frete (spec 2026-07-02-frenet-cotacao-design.md).
	// TOKEN vem do painel (painel.frenet.com.br > Dados Cadastrais); SELLER_CEP é
	// o CEP de origem do despacho (v1 fixo em env; dashboard exporá via
	// storeSettings depois). BASE_URL com default → fora das obrigatórias do
	// check:env.
	FRENET_TOKEN: z.string().min(1),
	FRENET_SELLER_CEP: z.string().regex(/^\d{8}$/, "CEP de origem: 8 dígitos"),
	FRENET_BASE_URL: z.url().default("https://api.frenet.com.br"),
} as const;
```

- [ ] **Step 2: Dummy por validador no vitest.setup.ts**

Substituir o bloco do `DUMMY` (linhas 22–33) por:

```ts
// Valores que satisfazem os validadores das obrigatórias: o genérico (URL longa)
// cobre z.url()/min(N); o numérico cobre padrões estritos (ex.: FRENET_SELLER_CEP
// /^\d{8}$/). Para cada chave, usa o primeiro candidato que o validador aceitar.
const DUMMIES = [`https://test.invalid/${"x".repeat(48)}`, "12345678"];

for (const schema of [serverSchema, clientSchema]) {
	for (const [key, validator] of Object.entries(schema)) {
		const required = !validator.safeParse(undefined).success;
		if (required && process.env[key] == null) {
			process.env[key] =
				DUMMIES.find((d) => validator.safeParse(d).success) ?? DUMMIES[0];
		}
	}
}
```

- [ ] **Step 3: Atualizar .env.example**

Read `apps/web/.env.example`; **remover** as linhas residuais do SuperFrete (`SUPERFRETE_BASE_URL=…`, ~linhas 53-54, resíduo já apontado em auditoria) e adicionar no lugar:

```bash
# Frenet — cotação de frete (token: painel.frenet.com.br > Dados Cadastrais)
FRENET_TOKEN=
# CEP de origem do despacho (8 dígitos, sem hífen)
FRENET_SELLER_CEP=00000000
# FRENET_BASE_URL=https://api.frenet.com.br  # default, só sobrescrever p/ teste
```

- [ ] **Step 4: Verificar que a suíte não quebra com as obrigatórias novas**

Run: `bun check-types`
Expected: PASS

Run: `bun run --filter=web test:ci`
Expected: PASS — o `vitest.setup.ts` roda pra toda a suíte; se o dummy não satisfizer a regex de `FRENET_SELLER_CEP`, a validação do `@emach/env` aborta os testes que o importam transitivamente

- [ ] **Step 5: Commit**

```bash
git add packages/env/src/schemas.ts apps/web/vitest.setup.ts apps/web/.env.example
git commit -m "feat: envs Frenet e dummy por validador nos testes"
```

**Nota manual (fora do commit):** o Otávio precisa adicionar `FRENET_TOKEN=<token real>` e `FRENET_SELLER_CEP=<cep da loja>` em `apps/web/.env` (ele tem o token em mãos) — e **cadastrar as duas na Vercel** (`vercel env add`) antes do push, senão o gate `check:env` do CI falha. Dev server rodando não relê `.env` (gotcha documentado): reiniciar com `set -a && . apps/web/.env && set +a` no shell novo.

---

### Task 2: Tipos + client HTTP da Frenet

**Files:**
- Create: `apps/web/src/lib/frenet/types.ts`
- Create: `apps/web/src/lib/frenet/client.ts`
- Test: `apps/web/src/lib/frenet/client.test.ts`

**Interfaces:**
- Consumes: `env.FRENET_TOKEN`, `env.FRENET_BASE_URL` (Task 1)
- Produces: `fetchFrenetQuote(body: FrenetQuoteRequest): Promise<FrenetQuoteResponse>`, `class FrenetError extends Error`, tipos `FrenetQuoteRequest`/`FrenetQuoteResponse`/`FrenetShippingService`/`FrenetShippingItem`. Tasks 3 e 5 dependem.

- [ ] **Step 1: Criar os tipos do contrato Frenet**

`apps/web/src/lib/frenet/types.ts`:

```ts
// Contrato da API Frenet (POST /shipping/quote) — espelha o frenetapi.apib.
// Atenção: a chave da resposta tem typo OFICIAL ("ShippingSevicesArray", sem o
// segundo "r") e preço/prazo chegam como STRING.

export interface FrenetShippingItem {
	Height: number;
	Length: number;
	Quantity: number;
	Weight: number;
	Width: number;
}

export interface FrenetQuoteRequest {
	RecipientCEP: string;
	RecipientCountry: "BR";
	SellerCEP: string;
	ShipmentInvoiceValue: number;
	ShippingItemArray: FrenetShippingItem[];
}

export interface FrenetShippingService {
	Carrier?: string;
	CarrierCode?: string;
	DeliveryTime?: string;
	Error?: boolean;
	Msg?: string;
	ServiceCode?: string;
	ServiceDescription?: string;
	ShippingPrice?: string;
}

export interface FrenetQuoteResponse {
	ShippingSevicesArray?: FrenetShippingService[];
	Timeout?: number;
}
```

- [ ] **Step 2: Escrever o teste do client (falhando)**

`apps/web/src/lib/frenet/client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFrenetQuote, FrenetError } from "./client";
import type { FrenetQuoteRequest } from "./types";

const BODY: FrenetQuoteRequest = {
	SellerCEP: "01310100",
	RecipientCEP: "14270000",
	ShipmentInvoiceValue: 320.68,
	RecipientCountry: "BR",
	ShippingItemArray: [
		{ Height: 20, Length: 40, Quantity: 1, Weight: 3.5, Width: 30 },
	],
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("fetchFrenetQuote", () => {
	it("faz POST /shipping/quote com header token e retorna o JSON", async () => {
		const payload = { ShippingSevicesArray: [] };
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

		await expect(fetchFrenetQuote(BODY)).resolves.toEqual(payload);

		const [url, init] = spy.mock.calls[0] ?? [];
		expect(String(url)).toMatch(/\/shipping\/quote$/);
		expect(init?.method).toBe("POST");
		const headers = init?.headers as Record<string, string>;
		expect(headers.token).toBeTruthy();
		expect(headers["Content-Type"]).toBe("application/json");
		expect(JSON.parse(String(init?.body))).toEqual(BODY);
	});

	it("HTTP não-2xx → FrenetError", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("{}", { status: 500 })
		);
		await expect(fetchFrenetQuote(BODY)).rejects.toBeInstanceOf(FrenetError);
	});

	it("abort/timeout → FrenetError (não vaza DOMException)", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(
			new DOMException("The operation was aborted", "AbortError")
		);
		await expect(fetchFrenetQuote(BODY)).rejects.toBeInstanceOf(FrenetError);
	});

	it("body não-JSON → FrenetError", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("<html>gateway error</html>", { status: 200 })
		);
		await expect(fetchFrenetQuote(BODY)).rejects.toBeInstanceOf(FrenetError);
	});
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `bun run --filter=web test src/lib/frenet/client.test.ts`
Expected: FAIL — `Cannot find module './client'` (ou equivalente)

- [ ] **Step 4: Implementar o client**

`apps/web/src/lib/frenet/client.ts`:

```ts
import { env } from "@emach/env/server";

import type { FrenetQuoteRequest, FrenetQuoteResponse } from "./types";

const TIMEOUT_MS = 10_000;

/** Erro do client Frenet — timeout, HTTP não-2xx ou body inválido. */
export class FrenetError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FrenetError";
	}
}

// Sem retry automático (v1): o fail-open do assertShippingQuoted cobre o
// server-side e a UI do checkout tem retry manual (quoteNonce).
export async function fetchFrenetQuote(
	body: FrenetQuoteRequest
): Promise<FrenetQuoteResponse> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(`${env.FRENET_BASE_URL}/shipping/quote`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				token: env.FRENET_TOKEN,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		if (!res.ok) {
			throw new FrenetError(`Frenet respondeu HTTP ${res.status}`);
		}
		return (await res.json()) as FrenetQuoteResponse;
	} catch (err) {
		if (err instanceof FrenetError) {
			throw err;
		}
		throw new FrenetError(
			err instanceof Error ? err.message : "falha na chamada à Frenet"
		);
	} finally {
		clearTimeout(timer);
	}
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `bun run --filter=web test src/lib/frenet/client.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/frenet/types.ts apps/web/src/lib/frenet/client.ts apps/web/src/lib/frenet/client.test.ts
git commit -m "feat: client HTTP da Frenet com timeout"
```

---

### Task 3: Mapeamento resposta Frenet → ShippingOption

**Files:**
- Create: `apps/web/src/lib/frenet/map.ts`
- Test: `apps/web/src/lib/frenet/map.test.ts`

**Interfaces:**
- Consumes: `FrenetQuoteResponse` (Task 2), `ShippingOption` de `@/lib/shipping/types` (existente: `{carrierId, deliveryDays, name, priceCents}`)
- Produces: `mapFrenetResponse(response: FrenetQuoteResponse): { negotiate: boolean; options: ShippingOption[] }`. Task 5 depende.

- [ ] **Step 1: Escrever o teste (falhando)**

`apps/web/src/lib/frenet/map.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { mapFrenetResponse } from "./map";

describe("mapFrenetResponse", () => {
	it("mapeia serviços válidos, converte preço string → centavos e ordena por preço", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "40010",
					ServiceDescription: "Sedex",
					ShippingPrice: "31.71",
					DeliveryTime: "2",
					Error: false,
				},
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "41106",
					ServiceDescription: "PAC",
					ShippingPrice: "18.90",
					DeliveryTime: "6",
					Error: false,
				},
			],
		});
		expect(result.negotiate).toBe(false);
		expect(result.options).toEqual([
			{
				carrierId: "COR-41106",
				name: "Correios — PAC",
				priceCents: 1890,
				deliveryDays: 6,
			},
			{
				carrierId: "COR-40010",
				name: "Correios — Sedex",
				priceCents: 3171,
				deliveryDays: 2,
			},
		]);
	});

	it("filtra serviço com Error=true sem derrubar os demais", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					CarrierCode: "TNT",
					ServiceCode: "RNC",
					Error: true,
					Msg: "CEP não atendido",
				},
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "40010",
					ServiceDescription: "Sedex",
					ShippingPrice: "31.71",
					DeliveryTime: "2",
					Error: false,
				},
			],
		});
		expect(result.options).toHaveLength(1);
		expect(result.options[0]?.carrierId).toBe("COR-40010");
	});

	it("filtra preço não-numérico; prazo não-numérico vira 0 (prazo a confirmar)", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					CarrierCode: "X",
					ServiceCode: "1",
					ShippingPrice: "indisponível",
					Error: false,
				},
				{
					Carrier: "Jadlog",
					CarrierCode: "JAD",
					ServiceCode: "3",
					ServiceDescription: ".Package",
					ShippingPrice: "25.00",
					DeliveryTime: "",
					Error: false,
				},
			],
		});
		expect(result.options).toEqual([
			{
				carrierId: "JAD-3",
				name: "Jadlog — .Package",
				priceCents: 2500,
				deliveryDays: 0,
			},
		]);
	});

	it("resposta sem serviços válidos (ou sem a chave) → negotiate", () => {
		expect(mapFrenetResponse({})).toEqual({ negotiate: true, options: [] });
		expect(
			mapFrenetResponse({
				ShippingSevicesArray: [{ Error: true, Msg: "sem cotação" }],
			})
		).toEqual({ negotiate: true, options: [] });
	});

	it("frete grátis (preço 0.00 de regra do painel) é aceito", () => {
		const result = mapFrenetResponse({
			ShippingSevicesArray: [
				{
					Carrier: "Correios",
					CarrierCode: "COR",
					ServiceCode: "41106",
					ServiceDescription: "PAC",
					ShippingPrice: "0.00",
					DeliveryTime: "6",
					Error: false,
				},
			],
		});
		expect(result.options[0]?.priceCents).toBe(0);
		expect(result.negotiate).toBe(false);
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test src/lib/frenet/map.test.ts`
Expected: FAIL — `Cannot find module './map'`

- [ ] **Step 3: Implementar o mapeamento**

`apps/web/src/lib/frenet/map.ts`:

```ts
import type { ShippingOption } from "@/lib/shipping/types";
import type { FrenetQuoteResponse } from "./types";

// Resposta Frenet → contrato da UI. Erro é POR SERVIÇO (Error/Msg): um serviço
// inválido não derruba os demais. Zero serviços válidos → negotiate (mesma
// semântica de "Frete a combinar" do motor anterior). carrierId é composto
// (CarrierCode-ServiceCode) — ServiceCode sozinho pode colidir entre
// transportadoras.
export function mapFrenetResponse(response: FrenetQuoteResponse): {
	negotiate: boolean;
	options: ShippingOption[];
} {
	const services = response.ShippingSevicesArray ?? [];
	const options: ShippingOption[] = [];
	for (const s of services) {
		if (s.Error) {
			continue;
		}
		const price = Number.parseFloat(s.ShippingPrice ?? "");
		if (!Number.isFinite(price)) {
			continue;
		}
		const days = Number.parseInt(s.DeliveryTime ?? "", 10);
		const name =
			[s.Carrier, s.ServiceDescription].filter(Boolean).join(" — ") ||
			"Transportadora";
		options.push({
			carrierId: `${s.CarrierCode ?? "NA"}-${s.ServiceCode ?? "NA"}`,
			name,
			// Mesmo arredondamento do motor anterior (Math.round(x*100)) — o
			// anti-fraude compara com tolerância de 1 centavo; divergência de
			// rounding rejeitaria cotação legítima.
			priceCents: Math.round(price * 100),
			deliveryDays: Number.isFinite(days) ? days : 0,
		});
	}
	options.sort((a, b) => a.priceCents - b.priceCents);
	return { negotiate: options.length === 0, options };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run --filter=web test src/lib/frenet/map.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/frenet/map.ts apps/web/src/lib/frenet/map.test.ts
git commit -m "feat: mapeia resposta Frenet pra ShippingOption"
```

---

### Task 4: Cache de cotação (Redis + fallback in-memory)

**Files:**
- Create: `apps/web/src/lib/frenet/cache.ts`
- Test: `apps/web/src/lib/frenet/cache.test.ts`

**Interfaces:**
- Consumes: `getRedis()` de `@emach/redis` (retorna `Redis | null`), `log` de `@/lib/evlog`, `ShippingOption`
- Produces: `buildQuoteCacheKey(parts): string`, `getCachedQuote(key): Promise<CachedQuote | null>`, `setCachedQuote(key, value): Promise<void>`, `interface CachedQuote { negotiate: boolean; options: ShippingOption[] }`. Task 5 depende.

- [ ] **Step 1: Escrever o teste (falhando)**

`apps/web/src/lib/frenet/cache.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getRedis → null força o caminho in-memory, determinístico mesmo se o .env
// local tiver Upstash configurado (nunca tocar Redis real em teste).
vi.mock("@emach/redis", () => ({ getRedis: () => null }));
vi.mock("@/lib/evlog", () => ({ log: { error: vi.fn(), warn: vi.fn() } }));

import { buildQuoteCacheKey, getCachedQuote, setCachedQuote } from "./cache";

const QUOTE = {
	negotiate: false,
	options: [
		{
			carrierId: "COR-40010",
			name: "Correios — Sedex",
			priceCents: 3171,
			deliveryDays: 2,
		},
	],
};

describe("buildQuoteCacheKey", () => {
	const base = {
		sellerCep: "01310100",
		destinationCep: "14270000",
		declaredValueCents: 32068,
	};
	const pkgA = { lengthCm: 40, widthCm: 30, heightCm: 20, weightKg: 3.5 };
	const pkgB = { lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 8 };

	it("é estável e insensível à ordem dos pacotes", () => {
		expect(buildQuoteCacheKey({ ...base, packages: [pkgA, pkgB] })).toBe(
			buildQuoteCacheKey({ ...base, packages: [pkgB, pkgA] })
		);
	});

	it("muda quando destino, valor declarado ou pacote muda", () => {
		const key = buildQuoteCacheKey({ ...base, packages: [pkgA] });
		expect(key).not.toBe(
			buildQuoteCacheKey({
				...base,
				destinationCep: "01001000",
				packages: [pkgA],
			})
		);
		expect(key).not.toBe(
			buildQuoteCacheKey({ ...base, declaredValueCents: 1, packages: [pkgA] })
		);
		expect(key).not.toBe(buildQuoteCacheKey({ ...base, packages: [pkgB] }));
	});
});

describe("cache in-memory (sem Upstash)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("roundtrip set→get, e expira após o TTL de 30min", async () => {
		const key = "frenet:quote:test-roundtrip";
		await setCachedQuote(key, QUOTE);
		await expect(getCachedQuote(key)).resolves.toEqual(QUOTE);

		vi.advanceTimersByTime(31 * 60 * 1000);
		await expect(getCachedQuote(key)).resolves.toBeNull();
	});

	it("miss retorna null", async () => {
		await expect(getCachedQuote("frenet:quote:inexistente")).resolves.toBeNull();
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test src/lib/frenet/cache.test.ts`
Expected: FAIL — `Cannot find module './cache'`

- [ ] **Step 3: Implementar o cache**

`apps/web/src/lib/frenet/cache.ts`:

```ts
import { createHash } from "node:crypto";

import { getRedis } from "@emach/redis";

import { log } from "@/lib/evlog";
import type { ShippingOption } from "@/lib/shipping/types";

export interface CachedQuote {
	negotiate: boolean;
	options: ShippingOption[];
}

// TTL curto: cobre a janela "cliente vê opções → submete → re-quote do
// assertShippingQuoted", que assim reutiliza EXATAMENTE a cotação exibida
// (anti-fraude determinístico + 1 chamada Frenet por checkout).
const TTL_SECONDS = 30 * 60;
const MEMORY_MAX_KEYS = 500;

const memory = new Map<string, { expiresAt: number; value: CachedQuote }>();

export function buildQuoteCacheKey(parts: {
	declaredValueCents: number;
	destinationCep: string;
	packages: Array<{
		heightCm: number;
		lengthCm: number;
		weightKg: number;
		widthCm: number;
	}>;
	sellerCep: string;
}): string {
	const packSig = parts.packages
		.map((p) => `${p.lengthCm}x${p.widthCm}x${p.heightCm}:${p.weightKg}`)
		.sort()
		.join("|");
	const raw = `${parts.sellerCep}|${parts.destinationCep}|${parts.declaredValueCents}|${packSig}`;
	return `frenet:quote:${createHash("sha256").update(raw).digest("hex")}`;
}

// Falha de cache NUNCA derruba a cotação — loga e degrada pra chamada direta.
export async function getCachedQuote(key: string): Promise<CachedQuote | null> {
	const redis = getRedis();
	if (redis) {
		try {
			return await redis.get<CachedQuote>(key);
		} catch (err) {
			log.error({
				action: "frenet_cache_read_failed",
				error: err instanceof Error ? err.message : "erro inesperado",
			});
			return null;
		}
	}
	const hit = memory.get(key);
	if (hit && hit.expiresAt > Date.now()) {
		return hit.value;
	}
	memory.delete(key);
	return null;
}

export async function setCachedQuote(
	key: string,
	value: CachedQuote
): Promise<void> {
	const redis = getRedis();
	if (redis) {
		try {
			await redis.set(key, value, { ex: TTL_SECONDS });
		} catch (err) {
			log.error({
				action: "frenet_cache_write_failed",
				error: err instanceof Error ? err.message : "erro inesperado",
			});
		}
		return;
	}
	// Fallback in-memory (dev/local — mesmo espírito do rate-limit): poda
	// preguiçosa das expiradas só quando o Map cresce, sem varredura por request.
	if (memory.size >= MEMORY_MAX_KEYS) {
		const now = Date.now();
		for (const [k, v] of memory) {
			if (v.expiresAt <= now) {
				memory.delete(k);
			}
		}
	}
	memory.set(key, { expiresAt: Date.now() + TTL_SECONDS * 1000, value });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run --filter=web test src/lib/frenet/cache.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/frenet/cache.ts apps/web/src/lib/frenet/cache.test.ts
git commit -m "feat: cache de cotação Frenet (Redis/memória)"
```

---

### Task 5: Adapter quote.ts passa a cotar via Frenet

**Files:**
- Modify: `apps/web/src/lib/shipping/quote.ts` (reescrever o miolo, assinatura preservada)
- Delete: `apps/web/src/lib/shipping/map.ts` e `apps/web/src/lib/shipping/map.test.ts` (morrem junto com o motor de zonas — `quote.ts` era o único consumidor)
- Test: `apps/web/src/lib/shipping/quote.test.ts` (novo)

**Interfaces:**
- Consumes: `fetchFrenetQuote`/`FrenetError` (Task 2), `mapFrenetResponse` (Task 3), `buildQuoteCacheKey`/`getCachedQuote`/`setCachedQuote` (Task 4), `packItems` e `getActiveBoxes` de `@emach/db` (existentes, NÃO editar), `buildQuoteItems` (existente)
- Produces: `quoteShipping(input: QuoteShippingInput): Promise<{ negotiate: boolean; options: ShippingOption[] }>` — **assinatura idêntica à atual** (`QuoteShippingInput = {declaredValueCents?, destinationCep, items: {toolId, quantity}[]}`). Consumidores (`quote-shipping.ts`, `place-order.ts`) não mudam nesta task.

- [ ] **Step 1: Escrever o teste do adapter (falhando)**

`apps/web/src/lib/shipping/quote.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectWhere } = vi.hoisted(() => ({ selectWhere: vi.fn() }));

vi.mock("@emach/db", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({ where: selectWhere })),
		})),
	},
}));
vi.mock("@emach/db/queries/shipping", () => ({ getActiveBoxes: vi.fn() }));
vi.mock("@/lib/frenet/client", () => ({ fetchFrenetQuote: vi.fn() }));
vi.mock("@/lib/frenet/cache", () => ({
	buildQuoteCacheKey: vi.fn(() => "cache-key"),
	getCachedQuote: vi.fn(),
	setCachedQuote: vi.fn(),
}));

import { getActiveBoxes } from "@emach/db/queries/shipping";
import { env } from "@emach/env/server";
import { getCachedQuote, setCachedQuote } from "@/lib/frenet/cache";
import { fetchFrenetQuote } from "@/lib/frenet/client";
import { quoteShipping } from "./quote";

// Ferramenta 30×20×10cm, 1.2kg + 0.3kg embalagem, empilhável.
const TOOL_ROW = {
	id: "t1",
	weightKg: "1.200",
	lengthCm: "30.00",
	widthCm: "20.00",
	heightCm: "10.00",
	packagingWeightKg: "0.300",
	stackable: true,
	shipsInOwnBox: false,
};

// Caixa 40×30×20cm interna, 20kg máx, 0.5kg de tara.
const BOX = {
	id: "box-m",
	internalLengthCm: 40,
	internalWidthCm: 30,
	internalHeightCm: 20,
	maxWeightKg: 20,
	tareWeightKg: 0.5,
};

const FRENET_OK = {
	ShippingSevicesArray: [
		{
			Carrier: "Correios",
			CarrierCode: "COR",
			ServiceCode: "40010",
			ServiceDescription: "Sedex",
			ShippingPrice: "31.71",
			DeliveryTime: "5",
			Error: false,
		},
	],
};

beforeEach(() => {
	vi.mocked(getActiveBoxes).mockResolvedValue([BOX]);
	selectWhere.mockResolvedValue([TOOL_ROW]);
	vi.mocked(getCachedQuote).mockResolvedValue(null);
	vi.mocked(setCachedQuote).mockResolvedValue(undefined);
	vi.mocked(fetchFrenetQuote).mockReset();
});

describe("quoteShipping (adapter Frenet)", () => {
	it("empacota o carrinho e envia as CAIXAS como ShippingItemArray", async () => {
		vi.mocked(fetchFrenetQuote).mockResolvedValue(FRENET_OK);

		const result = await quoteShipping({
			destinationCep: "14270-000",
			items: [{ toolId: "t1", quantity: 2 }],
			declaredValueCents: 32068,
		});

		expect(result.negotiate).toBe(false);
		expect(result.options).toEqual([
			{
				carrierId: "COR-40010",
				name: "Correios — Sedex",
				priceCents: 3171,
				deliveryDays: 5,
			},
		]);

		const body = vi.mocked(fetchFrenetQuote).mock.calls[0]?.[0];
		expect(body?.SellerCEP).toBe(env.FRENET_SELLER_CEP);
		expect(body?.RecipientCEP).toBe("14270000"); // normalizado (só dígitos)
		expect(body?.ShipmentInvoiceValue).toBeCloseTo(320.68);
		// 2 unidades consolidadas em UMA caixa real pelo packItems:
		// peso = 2×(1.2+0.3) + 0.5 tara = 3.5kg; dims = internas da caixa.
		expect(body?.ShippingItemArray).toEqual([
			{ Weight: 3.5, Length: 40, Height: 20, Width: 30, Quantity: 1 },
		]);
		expect(setCachedQuote).toHaveBeenCalledWith("cache-key", result);
	});

	it("item sem caixa no catálogo → negotiate SEM gastar chamada Frenet", async () => {
		vi.mocked(getActiveBoxes).mockResolvedValue([]);

		const result = await quoteShipping({
			destinationCep: "14270000",
			items: [{ toolId: "t1", quantity: 1 }],
		});

		expect(result).toEqual({ negotiate: true, options: [] });
		expect(fetchFrenetQuote).not.toHaveBeenCalled();
	});

	it("cache hit → retorna a cotação cacheada sem chamar a Frenet", async () => {
		const cached = {
			negotiate: false,
			options: [
				{
					carrierId: "COR-40010",
					name: "Correios — Sedex",
					priceCents: 3171,
					deliveryDays: 5,
				},
			],
		};
		vi.mocked(getCachedQuote).mockResolvedValue(cached);

		const result = await quoteShipping({
			destinationCep: "14270000",
			items: [{ toolId: "t1", quantity: 1 }],
			declaredValueCents: 1000,
		});

		expect(result).toEqual(cached);
		expect(fetchFrenetQuote).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test src/lib/shipping/quote.test.ts`
Expected: FAIL — o adapter atual chama `getActiveCarriersWithTables` (não mockado) e não chama a Frenet

- [ ] **Step 3: Reescrever o adapter**

Substituir o conteúdo completo de `apps/web/src/lib/shipping/quote.ts` por:

```ts
import { db } from "@emach/db";
import { getActiveBoxes } from "@emach/db/queries/shipping";
import { packItems } from "@emach/db/queries/shipping-quote";
import { tool } from "@emach/db/schema/tools";
import { env } from "@emach/env/server";
import { inArray } from "drizzle-orm";

import {
	buildQuoteCacheKey,
	getCachedQuote,
	setCachedQuote,
} from "@/lib/frenet/cache";
import { fetchFrenetQuote } from "@/lib/frenet/client";
import { mapFrenetResponse } from "@/lib/frenet/map";
import { buildQuoteItems } from "./build-items";
import type { ShippingOption } from "./types";

export interface QuoteShippingInput {
	declaredValueCents?: number;
	destinationCep: string;
	items: { toolId: string; quantity: number }[];
}

// Cotação via Frenet (substitui o motor de tabelas próprias — spec
// 2026-07-02). O carrinho ainda é consolidado em caixas reais (packItems +
// shippingBox): cada caixa vira uma linha do ShippingItemArray; item sem caixa
// → negotiate ("a combinar") SEM gastar chamada. Cache Redis 30min faz o
// re-quote do assertShippingQuoted reutilizar a cotação exibida ao cliente.
export async function quoteShipping(
	input: QuoteShippingInput
): Promise<{ negotiate: boolean; options: ShippingOption[] }> {
	const toolIds = Array.from(new Set(input.items.map((i) => i.toolId)));
	const [boxes, toolRows] = await Promise.all([
		getActiveBoxes(db),
		db
			.select({
				id: tool.id,
				weightKg: tool.weightKg,
				lengthCm: tool.lengthCm,
				widthCm: tool.widthCm,
				heightCm: tool.heightCm,
				packagingWeightKg: tool.packagingWeightKg,
				stackable: tool.stackable,
				shipsInOwnBox: tool.shipsInOwnBox,
			})
			.from(tool)
			.where(inArray(tool.id, toolIds)),
	]);

	const items = buildQuoteItems(toolRows, input.items);
	const packages = packItems(items, boxes);
	if (packages.some((p) => p.outOfCatalog)) {
		return { negotiate: true, options: [] };
	}

	const destinationCep = input.destinationCep.replace(/\D/g, "");
	const declaredValueCents = input.declaredValueCents ?? 0;
	const cacheKey = buildQuoteCacheKey({
		sellerCep: env.FRENET_SELLER_CEP,
		destinationCep,
		declaredValueCents,
		packages,
	});
	const cached = await getCachedQuote(cacheKey);
	if (cached) {
		return cached;
	}

	const response = await fetchFrenetQuote({
		SellerCEP: env.FRENET_SELLER_CEP,
		RecipientCEP: destinationCep,
		ShipmentInvoiceValue: declaredValueCents / 100,
		RecipientCountry: "BR",
		ShippingItemArray: packages.map((p) => ({
			Weight: p.weightKg,
			Length: p.lengthCm,
			Height: p.heightCm,
			Width: p.widthCm,
			Quantity: 1,
		})),
	});
	const result = mapFrenetResponse(response);
	await setCachedQuote(cacheKey, result);
	return result;
}
```

- [ ] **Step 4: Deletar o mapeador morto do motor antigo**

```bash
git rm apps/web/src/lib/shipping/map.ts apps/web/src/lib/shipping/map.test.ts
```

(`quote.ts` era o único consumidor de `mapQuoteResult` — conferir com `rg -l "mapQuoteResult" apps/web/src` antes: deve retornar vazio após o Step 3.)

- [ ] **Step 5: Rodar testes e types**

Run: `bun run --filter=web test src/lib/shipping/quote.test.ts`
Expected: PASS (3 testes)

Run: `bun run --filter=web test src/lib/shipping src/lib/frenet src/app/checkout/_lib/place-order.shipping.test.ts`
Expected: PASS — em particular `place-order.shipping.test.ts` continua verde sem edição (mocka o boundary `@/lib/shipping/quote`, preservado)

Run: `bun check-types`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/lib/shipping
git commit -m "feat: cotação de frete via Frenet no adapter"
```

---

### Task 6: Persistir o serviço escolhido (anti-fraude valida o par)

**Files:**
- Modify: `apps/web/src/app/checkout/_lib/place-order.ts` (inputSchema, `assertShippingQuoted`, `placeOrder`)
- Modify: `apps/web/src/app/checkout/_actions/create-order.ts` (threading)
- Modify: `apps/web/src/app/checkout/_lib/place-order.shipping.test.ts` (novo shape + casos do par)
- Modify: `apps/web/src/app/checkout/_actions/create-order.test.ts` (mock shape)

**Interfaces:**
- Consumes: `quoteShipping` (Task 5, mockado nos testes), coluna existente `order.shippingMethod: text("shipping_method")` nullable (`packages/db/src/schema/orders.ts:136` — NÃO editar schema)
- Produces: `inputSchema` ganha `shippingServiceCode: z.string().min(1).optional()`; `assertShippingQuoted(params & { shippingServiceCode?: string })` passa a retornar `{ shippingUnverified: boolean; shippingMethod: string | null }`; `placeOrder` aceita `shippingMethod?: string | null` e grava em `order.shippingMethod`. Task 7 depende do campo no input.

- [ ] **Step 1: Atualizar os testes de assertShippingQuoted (falhando)**

Substituir o conteúdo completo de `apps/web/src/app/checkout/_lib/place-order.shipping.test.ts` por:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shipping/quote", () => ({ quoteShipping: vi.fn() }));

import { quoteShipping } from "@/lib/shipping/quote";
import { assertShippingQuoted } from "./place-order";

const OPTIONS = [
	{
		carrierId: "COR-40010",
		name: "Correios — Sedex",
		priceCents: 3596,
		deliveryDays: 1,
	},
	{
		carrierId: "COR-41106",
		name: "Correios — PAC",
		priceCents: 1890,
		deliveryDays: 6,
	},
];

describe("assertShippingQuoted", () => {
	it("aceita shipping que bate com uma opção cotada e devolve o método", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: false,
			options: OPTIONS,
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 3596,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).resolves.toEqual({
			shippingUnverified: false,
			shippingMethod: "Correios — Sedex",
		});
	});

	it("valida o PAR serviço+preço quando shippingServiceCode vem", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: false,
			options: OPTIONS,
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 1890,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
				shippingServiceCode: "COR-41106",
			})
		).resolves.toEqual({
			shippingUnverified: false,
			shippingMethod: "Correios — PAC",
		});
	});

	it("rejeita preço válido de OUTRO serviço que não o selecionado", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: false,
			options: OPTIONS,
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 1890, // preço do PAC…
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
				shippingServiceCode: "COR-40010", // …mas serviço Sedex
			})
		).rejects.toThrow(/frete inválido/i);
	});

	it("fail-open: API indisponível não bloqueia, marca shippingUnverified (#97)", async () => {
		vi.mocked(quoteShipping).mockRejectedValue(new Error("Frenet 503"));
		await expect(
			assertShippingQuoted({
				shippingCents: 9999,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).resolves.toEqual({ shippingUnverified: true, shippingMethod: null });
	});

	it("rejeita shipping que não bate com nenhuma opção", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: false,
			options: OPTIONS,
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 0,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).rejects.toThrow();
	});

	it("rejeita quando o frete é a combinar (sem serviço válido)", async () => {
		vi.mocked(quoteShipping).mockResolvedValue({
			negotiate: true,
			options: [],
		});
		await expect(
			assertShippingQuoted({
				shippingCents: 1000,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).rejects.toThrow();
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run --filter=web test src/app/checkout/_lib/place-order.shipping.test.ts`
Expected: FAIL — retorno atual não tem `shippingMethod` e não existe validação do par

- [ ] **Step 3: Implementar em place-order.ts**

3a. No `inputSchema`, após a linha `shippingAmount: z.string().regex(/^\d+\.\d{2}$/),`:

```ts
	shippingAmount: z.string().regex(/^\d+\.\d{2}$/),
	// carrierId composto ("COR-40010") da opção Frenet escolhida na UI. Opcional
	// p/ compat na janela de deploy — sem ele o match cai pro preço apenas.
	shippingServiceCode: z.string().min(1).optional(),
```

3b. Substituir `assertShippingQuoted` (o doc-comment atual + a função) por:

```ts
/**
 * Anti-fraude: re-cota o frete no servidor (via cache Frenet — reutiliza a
 * cotação que a UI exibiu) e exige que o `shippingCents` enviado pelo cliente
 * bata com uma opção (tolerância de 1 centavo). Com `shippingServiceCode`
 * presente, valida o PAR serviço+preço — não basta o preço existir em outra
 * opção. Devolve `shippingMethod` (label da opção casada) p/ persistir no
 * pedido.
 *
 * Falha de infra na cotação (Frenet fora/timeout, cache e DB indisponíveis)
 * **não** bloqueia a venda (fail-open), mas retorna `shippingUnverified: true`
 * — o pedido é marcado para revisão do staff no dashboard antes de faturar
 * (#97 / dashboard#143). Só valor adulterado (mismatch) ou frete a combinar
 * lança `OrderError`.
 *
 * Deve rodar **fora** da transação do pedido — a cotação faz chamada externa
 * e não pode segurar a transação aberta durante essa latência.
 */
export async function assertShippingQuoted(params: {
	shippingCents: number;
	destinationCep: string;
	items: Array<{ toolId: string; quantity: number }>;
	declaredValueCents?: number;
	shippingServiceCode?: string;
}): Promise<{ shippingUnverified: boolean; shippingMethod: string | null }> {
	let quote: Awaited<ReturnType<typeof quoteShipping>>;
	try {
		quote = await quoteShipping({
			destinationCep: params.destinationCep,
			items: params.items,
			declaredValueCents: params.declaredValueCents,
		});
	} catch (err) {
		// Fail-open consciente: falha de infra na cotação (Frenet fora do ar,
		// timeout) NÃO bloqueia a venda — não punir o cliente por instabilidade
		// de terceiro. Em vez de aceitar o frete às cegas, sinalizamos
		// `shippingUnverified` — o pedido grava a flag e o staff revisa no
		// dashboard antes de faturar (limpa via markShippingReviewed). Fecha o
		// vetor "derruba a cotação → frete grátis".
		log.error({
			action: "shipping_revalidation_skipped",
			destinationCep: params.destinationCep,
			shippingCents: params.shippingCents,
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return { shippingUnverified: true, shippingMethod: null };
	}
	// Nenhum serviço cotável p/ o CEP/pacote → frete a combinar; sem opção a casar.
	if (quote.negotiate) {
		throw new OrderError("Frete a combinar — entre em contato para concluir");
	}
	const candidates = params.shippingServiceCode
		? quote.options.filter((o) => o.carrierId === params.shippingServiceCode)
		: quote.options;
	const match = candidates.find(
		(o) => Math.abs(o.priceCents - params.shippingCents) <= PRICE_TOLERANCE_CENTS
	);
	if (!match) {
		throw new OrderError("Frete inválido, refaça o checkout");
	}
	return { shippingUnverified: false, shippingMethod: match.name };
}
```

3c. Em `placeOrder`: adicionar o param e gravar a coluna. No objeto `params` da assinatura, após `shippingUnverified?: boolean;`:

```ts
		shippingUnverified?: boolean;
		// Label do serviço validado pelo assertShippingQuoted (ex.: "Correios —
		// Sedex"). null quando o frete não pôde ser verificado (fail-open).
		shippingMethod?: string | null;
```

No destructuring: `shippingUnverified = false,` → adicionar `shippingMethod = null,`. No `tx.insert(order).values({...})`, após `shippingAmount: input.shippingAmount,`:

```ts
			shippingAmount: input.shippingAmount,
			shippingMethod,
```

- [ ] **Step 4: Threading em create-order.ts**

4a. Trocar `let shippingUnverified = true;` por:

```ts
		let shippingUnverified = true;
		let shippingMethod: string | null = null;
```

4b. Na chamada de `assertShippingQuoted`, adicionar o campo e capturar o método:

```ts
			const shippingCheck = await assertShippingQuoted({
				shippingCents: numericToCents(input.shippingAmount),
				destinationCep,
				items: input.cartItems.map((i) => ({
					toolId: i.toolId,
					quantity: i.quantity,
				})),
				declaredValueCents,
				shippingServiceCode: input.shippingServiceCode,
			});
			shippingUnverified = shippingCheck.shippingUnverified;
			shippingMethod = shippingCheck.shippingMethod;
```

4c. Na chamada de `placeOrder`, após `shippingUnverified,`:

```ts
				shippingUnverified,
				shippingMethod,
```

- [ ] **Step 5: Atualizar o mock em create-order.test.ts**

Linha 89, trocar:

```ts
		assertShippingQuoted.mockResolvedValue({ shippingUnverified: false });
```

por:

```ts
		assertShippingQuoted.mockResolvedValue({
			shippingUnverified: false,
			shippingMethod: null,
		});
```

- [ ] **Step 6: Rodar testes e types**

Run: `bun run --filter=web test src/app/checkout/_lib/place-order.shipping.test.ts src/app/checkout/_actions/create-order.test.ts`
Expected: PASS (8 testes no total)

Run: `bun check-types`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/checkout/_lib/place-order.ts apps/web/src/app/checkout/_lib/place-order.shipping.test.ts apps/web/src/app/checkout/_actions/create-order.ts apps/web/src/app/checkout/_actions/create-order.test.ts
git commit -m "feat: persiste serviço de frete escolhido"
```

---

### Task 7: Checkout envia o serviço selecionado

**Files:**
- Modify: `apps/web/src/app/checkout/_components/checkout-content.tsx`

**Interfaces:**
- Consumes: `CreateOrderInput.shippingServiceCode?: string` (Task 6); estado `selectedCarrierId: string | null` (já existe na linha ~113)
- Produces: submit do checkout serializa o serviço escolhido. Nenhum consumidor posterior.

- [ ] **Step 1: Serializar o serviço no submit**

Em `checkout-content.tsx`, no `onSubmit` do `useForm`, o objeto passado a `createOrderAction` ganha uma linha após `shippingAmount`:

```ts
				shippingAmount: (selectedShippingCents / 100).toFixed(2),
				shippingServiceCode: selectedCarrierId ?? undefined,
				couponCode: coupon?.code,
```

(O guard `if (selectedShippingCents === null)` no topo do onSubmit garante que, na prática, `selectedCarrierId` não é null aqui — o `?? undefined` só satisfaz o tipo.)

- [ ] **Step 2: Types + unit da pasta**

Run: `bun check-types`
Expected: PASS

Run: `bun run --filter=web test:ci`
Expected: PASS (suíte unit completa, mesma do CI)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/checkout/_components/checkout-content.tsx
git commit -m "feat: envia serviço de frete no submit do checkout"
```

---

### Task 8: Docs, envs na Vercel e gate final

**Files:**
- Modify: `CLAUDE.md` (raiz — bullet de frete nos Gotchas)
- Manual: `apps/web/.env` (token real), Vercel envs, smoke no dev server

- [ ] **Step 1: Atualizar o bullet de frete no CLAUDE.md**

Substituir o bullet que começa com `- **Frete = motor de tabelas próprias**` (nos Gotchas) por:

```markdown
- **Frete = Frenet** (`POST api.frenet.com.br/shipping/quote`, spec `docs/superpowers/specs/2026-07-02-frenet-cotacao-design.md`) via adapter `lib/shipping/quote.ts` — contrato `{negotiate, options: ShippingOption[]}` preservado (testes mockam esse boundary). `packItems` + `shippingBox` continuam consolidando o carrinho em caixas reais ANTES da chamada (item sem caixa → `negotiate` = "Frete a combinar"; tabelas `carrier`/`carrierZone`/`carrierRate` aposentadas — drop físico pendente via dashboard/sync). Cache Redis 30min (`lib/frenet/cache.ts`) faz o re-quote do `assertShippingQuoted` reutilizar a cotação exibida → 1 chamada Frenet por checkout e anti-fraude determinístico; o anti-fraude valida o PAR serviço+preço e grava `order.shippingMethod`. **Fail-open (#97) voltou a cobrir API externa:** Frenet fora/timeout → pedido criado com `shippingUnverified` p/ revisão staff. Contrato Frenet tem pegadinhas absorvidas em `lib/frenet/map.ts`: chave com typo oficial `ShippingSevicesArray`, preço/prazo string, erro POR serviço. Envs `FRENET_TOKEN` + `FRENET_SELLER_CEP` obrigatórias (cadastrar na Vercel; `FRENET_SELLER_CEP` tem regex → o dummy dos testes é escolhido POR VALIDADOR em `vitest.setup.ts`). Gotcha P0 do registro manual de `shippingBox` no `schema` de `packages/db/src/index.ts` continua valendo.
```

- [ ] **Step 2: Envs reais (manual — Otávio)**

- `apps/web/.env`: `FRENET_TOKEN=<token do painel>` + `FRENET_SELLER_CEP=<CEP de origem, 8 dígitos>`.
- Vercel (obrigatório antes do push, senão `check:env` quebra o CI):

```bash
vercel env add FRENET_TOKEN production
vercel env add FRENET_SELLER_CEP production
# repetir p/ preview se o projeto usa preview deployments
```

- [ ] **Step 3: Gate integrado**

Run: `bun check-types`
Expected: PASS

Run: `bun run --filter=web test:ci`
Expected: PASS (unit completa)

Run: `bun run --filter=web test`
Expected: PASS (se 1-3 testes de integração de place-order falharem, re-rodar isolado antes de suspeitar do plano — flaky conhecido de contenção no Supabase)

- [ ] **Step 4: Smoke run-time com token real**

Reiniciar o dev server com env fresca (dev server NÃO relê `.env` — gotcha):

```bash
fuser -k 3000/tcp; set -a && . apps/web/.env && set +a && cd apps/web && TZ=UTC ./node_modules/.bin/next dev -p 3000 > /tmp/dev-up-3000.log 2>&1 &
```

Verificar no browser (ou via curl na server action):
1. PDP de um produto → calculadora de frete com CEP válido → opções reais da Frenet (Sedex/PAC/etc) com preço e prazo.
2. `/checkout` com item no carrinho → CEP → radio de opções → escolher uma → confirmar pedido (conta de teste) → pedido criado; conferir no banco que `order.shipping_method` foi gravado (ex.: `"Correios — Sedex"`).
3. Log limpo de `FrenetError`/`quote_shipping_failed` no fluxo feliz.

- [ ] **Step 5: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: atualiza gotchas de frete pós-Frenet"
```

---

## Fora do plano (follow-ups já mapeados no spec)

- Dashboard: config de CEP de origem (`storeSettings.shippingOriginBranchId`), validação `> 0` de peso/dims no form de produto, aposentar UI de transportadoras/zonas, coluna futura `order.shippingServiceCode` p/ tracking.
- Drop físico das tabelas `carrier*` (mudança de schema começa no dashboard, ADR-0009).
- Rastreamento (`/tracking/trackinginfo`) — junto com a integração de pagamento (roadmap #4).
