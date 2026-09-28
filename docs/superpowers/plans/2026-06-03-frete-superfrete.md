# Cotação de frete via SuperFrete — Implementation Plan

> **Status em 2026-09-28:** substituído. O plano foi executado (#49) e o SuperFrete foi removido pelo PR #164, que o trocou pelo motor de tabelas; o PR #178 depois trocou o motor pela Frenet. Nenhum arquivo `lib/superfrete/` ou `origin-branch.ts` existe hoje. Ver `docs/superpowers/plans/2026-07-02-frenet-cotacao.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o frete hardcoded do checkout por cotação real do SuperFrete (server-side, sob demanda no CEP), exibindo serviços com preço/prazo pro cliente escolher.

**Architecture:** Módulo isolado `lib/superfrete/` (HTTP client + montagem da cotação) + helper de origem + server action fina + UI de opções no checkout + re-validação anti-fraude no place-order. Peso/dimensão vêm do DB (`tool`), origem é a filial Curitiba via `DEFAULT_BRANCH_ID`.

**Tech Stack:** Next 16 (server actions), Drizzle, Zod, evlog, Vitest, TanStack Form, Base UI.

**Spec:** `docs/superpowers/specs/2026-06-03-frete-superfrete-design.md`

---

## File Structure

- Create: `apps/web/src/lib/superfrete/types.ts` — tipos de domínio + raw API
- Create: `apps/web/src/lib/superfrete/client.ts` — `fetchSuperFreteQuote()` (HTTP)
- Create: `apps/web/src/lib/superfrete/client.test.ts`
- Create: `apps/web/src/lib/superfrete/quote.ts` — `quoteShipping()` (orquestra DB + client + normalização)
- Create: `apps/web/src/lib/superfrete/quote.test.ts`
- Create: `apps/web/src/lib/origin-branch.ts` — `getOriginBranchCep()`
- Create: `apps/web/src/lib/origin-branch.test.ts`
- Create: `apps/web/src/app/checkout/_actions/quote-shipping.ts` — server action
- Create: `apps/web/src/app/checkout/_components/shipping-options.tsx` — UI das opções
- Modify: `packages/env/src/server.ts` — 4 env vars
- Modify: `apps/web/src/app/checkout/_components/checkout-content.tsx` — integra cotação, remove hardcoded
- Modify: `apps/web/src/app/checkout/_lib/place-order.ts` — re-valida `shippingAmount`

---

## Task 1: Env vars do SuperFrete

**Files:**
- Modify: `packages/env/src/server.ts:36-37`

- [ ] **Step 1: Adicionar as 4 vars ao schema**

Em `packages/env/src/server.ts`, dentro de `server: { ... }`, após `NEXT_PUBLIC_SUPABASE_URL: z.url(),` adicione:

```ts
		SUPERFRETE_TOKEN: z.string().min(1),
		SUPERFRETE_BASE_URL: z.url(),
		SUPERFRETE_USER_AGENT: z.string().min(1),
		DEFAULT_BRANCH_ID: z.string().min(1),
```

- [ ] **Step 2: Verificar que o env carrega**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun check-types`
Expected: PASS (sem erro de env faltando — `apps/web/.env` já tem as 4 vars).

- [ ] **Step 3: Commit**

```bash
git add packages/env/src/server.ts
git commit -m "feat(env): adiciona vars do SuperFrete e DEFAULT_BRANCH_ID (#47)"
```

---

## Task 2: Tipos de domínio

**Files:**
- Create: `apps/web/src/lib/superfrete/types.ts`

- [ ] **Step 1: Criar o arquivo de tipos**

```ts
/** Resposta crua de um serviço no POST /api/v0/calculator do SuperFrete. */
export interface SuperFreteServiceRaw {
	id: number;
	name: string;
	price?: number;
	delivery_time?: number;
	error?: string;
	has_error?: boolean;
	company?: { id: number; name: string; picture?: string };
}

/** Item do carrinho enviado para cotação (server resolve peso/dim no DB). */
export interface QuoteItem {
	toolId: string;
	quantity: number;
}

/** Opção de frete já normalizada para a UI. */
export interface ShippingOption {
	serviceId: number;
	name: string;
	company: string;
	priceCents: number;
	deliveryDays: number;
}
```

- [ ] **Step 2: Verificar**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/superfrete/types.ts
git commit -m "feat(superfrete): tipos de domínio da cotação (#47)"
```

---

## Task 3: HTTP client do SuperFrete

**Files:**
- Create: `apps/web/src/lib/superfrete/client.ts`
- Test: `apps/web/src/lib/superfrete/client.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSuperFreteQuote, SuperFreteError } from "./client";

vi.mock("@emach/env/server", () => ({
	env: {
		SUPERFRETE_BASE_URL: "https://sandbox.superfrete.com",
		SUPERFRETE_TOKEN: "tok123",
		SUPERFRETE_USER_AGENT: "Emach Loja v1.0 (test@emach.com)",
	},
}));

afterEach(() => vi.restoreAllMocks());

describe("fetchSuperFreteQuote", () => {
	it("envia headers de auth e retorna o array de serviços", async () => {
		const services = [{ id: 2, name: "SEDEX", price: 35.96, delivery_time: 1 }];
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify(services), { status: 200 })
			);

		const result = await fetchSuperFreteQuote({
			from: { postal_code: "80010000" },
			to: { postal_code: "01310100" },
			services: "1,2,17,3",
			options: { insurance_value: 0, use_insurance_value: false },
			products: [{ height: 10, width: 15, length: 20, weight: 1, quantity: 1 }],
		});

		expect(result).toEqual(services);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://sandbox.superfrete.com/api/v0/calculator");
		expect((init?.headers as Record<string, string>).Authorization).toBe(
			"Bearer tok123"
		);
	});

	it("lança SuperFreteError em status não-ok", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("nope", { status: 401 })
		);
		await expect(
			fetchSuperFreteQuote({
				from: { postal_code: "80010000" },
				to: { postal_code: "01310100" },
				services: "2",
				options: { insurance_value: 0, use_insurance_value: false },
				products: [{ height: 1, width: 1, length: 1, weight: 1, quantity: 1 }],
			})
		).rejects.toBeInstanceOf(SuperFreteError);
	});
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd apps/web && bun run test src/lib/superfrete/client.test.ts`
Expected: FAIL ("Cannot find module './client'").

- [ ] **Step 3: Implementar o client**

```ts
import { env } from "@emach/env/server";

import type { SuperFreteServiceRaw } from "./types";

const QUOTE_PATH = "/api/v0/calculator";
const TIMEOUT_MS = 8000;

export class SuperFreteError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SuperFreteError";
	}
}

export interface SuperFreteQuoteBody {
	from: { postal_code: string };
	to: { postal_code: string };
	services: string;
	options: {
		insurance_value: number;
		use_insurance_value: boolean;
	};
	products: Array<{
		height: number;
		width: number;
		length: number;
		weight: number;
		quantity: number;
	}>;
}

export async function fetchSuperFreteQuote(
	body: SuperFreteQuoteBody
): Promise<SuperFreteServiceRaw[]> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(`${env.SUPERFRETE_BASE_URL}${QUOTE_PATH}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.SUPERFRETE_TOKEN}`,
				"User-Agent": env.SUPERFRETE_USER_AGENT,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		if (!res.ok) {
			throw new SuperFreteError(`SuperFrete respondeu ${res.status}`);
		}
		return (await res.json()) as SuperFreteServiceRaw[];
	} catch (err) {
		if (err instanceof SuperFreteError) {
			throw err;
		}
		throw new SuperFreteError(
			err instanceof Error ? err.message : "Falha na cotação"
		);
	} finally {
		clearTimeout(timer);
	}
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `cd apps/web && bun run test src/lib/superfrete/client.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/superfrete/client.ts apps/web/src/lib/superfrete/client.test.ts
git commit -m "feat(superfrete): HTTP client com timeout e SuperFreteError (#47)"
```

---

## Task 4: Helper de CEP de origem

**Files:**
- Create: `apps/web/src/lib/origin-branch.ts`
- Test: `apps/web/src/lib/origin-branch.test.ts`

> Substitui o `getDefaultBranchId()` fantasma citado no CLAUDE.md (que não existia). Lê `DEFAULT_BRANCH_ID` e busca o `cep` da filial via `db`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOriginBranchCep } from "./origin-branch";

const selectChain = {
	from: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
	limit: vi.fn(),
};

vi.mock("@emach/env/server", () => ({
	env: { DEFAULT_BRANCH_ID: "branch-curitiba" },
}));
vi.mock("@emach/db", () => ({
	db: { select: vi.fn(() => selectChain) },
}));

beforeEach(() => vi.clearAllMocks());

describe("getOriginBranchCep", () => {
	it("retorna o cep da filial de origem (só dígitos)", async () => {
		selectChain.limit.mockResolvedValue([{ cep: "80010-000" }]);
		await expect(getOriginBranchCep()).resolves.toBe("80010000");
	});

	it("lança se a filial não existir ou não tiver cep", async () => {
		selectChain.limit.mockResolvedValue([]);
		await expect(getOriginBranchCep()).rejects.toThrow();
	});
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd apps/web && bun run test src/lib/origin-branch.test.ts`
Expected: FAIL ("Cannot find module './origin-branch'").

- [ ] **Step 3: Implementar**

```ts
import { db } from "@emach/db";
import { branch } from "@emach/db/schema/inventory";
import { env } from "@emach/env/server";
import { eq } from "drizzle-orm";

const NON_DIGITS = /\D/g;

/** CEP (só dígitos) da filial de origem do despacho (Curitiba). */
export async function getOriginBranchCep(): Promise<string> {
	const rows = await db
		.select({ cep: branch.cep })
		.from(branch)
		.where(eq(branch.id, env.DEFAULT_BRANCH_ID))
		.limit(1);

	const cep = rows[0]?.cep?.replace(NON_DIGITS, "") ?? "";
	if (cep.length !== 8) {
		throw new Error(
			`Filial de origem ${env.DEFAULT_BRANCH_ID} sem CEP válido`
		);
	}
	return cep;
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `cd apps/web && bun run test src/lib/origin-branch.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/origin-branch.ts apps/web/src/lib/origin-branch.test.ts
git commit -m "feat(checkout): getOriginBranchCep via DEFAULT_BRANCH_ID (#47)"
```

---

## Task 5: Orquestração da cotação (`quote.ts`)

**Files:**
- Create: `apps/web/src/lib/superfrete/quote.ts`
- Test: `apps/web/src/lib/superfrete/quote.test.ts`

> Resolve origem, busca peso/dim dos `toolId`s no DB, monta `products[]`, chama o client e normaliza (só serviços com `price`).

- [ ] **Step 1: Escrever o teste falhando**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { quoteShipping } from "./quote";

const selectChain = {
	from: vi.fn().mockReturnThis(),
	where: vi.fn(),
};

vi.mock("@emach/db", () => ({ db: { select: vi.fn(() => selectChain) } }));
vi.mock("@/lib/origin-branch", () => ({
	getOriginBranchCep: vi.fn().mockResolvedValue("80010000"),
}));
vi.mock("./client", () => ({ fetchSuperFreteQuote: vi.fn() }));

import { fetchSuperFreteQuote } from "./client";

beforeEach(() => vi.clearAllMocks());

describe("quoteShipping", () => {
	it("monta products do DB e normaliza só serviços com price", async () => {
		selectChain.where.mockResolvedValue([
			{
				id: "tool-1",
				weightKg: "1.500",
				lengthCm: "20.00",
				widthCm: "15.00",
				heightCm: "10.00",
			},
		]);
		vi.mocked(fetchSuperFreteQuote).mockResolvedValue([
			{ id: 1, name: "PAC", error: "444", company: { id: 1, name: "Correios" } },
			{
				id: 2,
				name: "SEDEX",
				price: 35.96,
				delivery_time: 1,
				company: { id: 1, name: "Correios" },
			},
		]);

		const result = await quoteShipping({
			destinationCep: "01310100",
			items: [{ toolId: "tool-1", quantity: 2 }],
		});

		expect(result).toEqual([
			{
				serviceId: 2,
				name: "SEDEX",
				company: "Correios",
				priceCents: 3596,
				deliveryDays: 1,
			},
		]);
		const body = vi.mocked(fetchSuperFreteQuote).mock.calls[0][0];
		expect(body.from.postal_code).toBe("80010000");
		expect(body.products[0]).toMatchObject({
			weight: 1.5,
			height: 10,
			width: 15,
			length: 20,
			quantity: 2,
		});
	});

	it("lança se um toolId não existe no DB", async () => {
		selectChain.where.mockResolvedValue([]);
		await expect(
			quoteShipping({
				destinationCep: "01310100",
				items: [{ toolId: "missing", quantity: 1 }],
			})
		).rejects.toThrow();
	});
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd apps/web && bun run test src/lib/superfrete/quote.test.ts`
Expected: FAIL ("Cannot find module './quote'").

- [ ] **Step 3: Implementar**

```ts
import { db } from "@emach/db";
import { tool } from "@emach/db/schema/tools";
import { inArray } from "drizzle-orm";

import { getOriginBranchCep } from "@/lib/origin-branch";

import { fetchSuperFreteQuote } from "./client";
import type { QuoteItem, ShippingOption } from "./types";

const SERVICES = "1,2,17,3"; // PAC, SEDEX, Mini, Jadlog

export interface QuoteShippingInput {
	destinationCep: string;
	items: QuoteItem[];
}

export async function quoteShipping(
	input: QuoteShippingInput
): Promise<ShippingOption[]> {
	const toolIds = Array.from(new Set(input.items.map((i) => i.toolId)));
	const [originCep, toolRows] = await Promise.all([
		getOriginBranchCep(),
		db
			.select({
				id: tool.id,
				weightKg: tool.weightKg,
				lengthCm: tool.lengthCm,
				widthCm: tool.widthCm,
				heightCm: tool.heightCm,
			})
			.from(tool)
			.where(inArray(tool.id, toolIds)),
	]);

	const byId = new Map(toolRows.map((t) => [t.id, t]));
	const products = input.items.map((item) => {
		const t = byId.get(item.toolId);
		if (!t) {
			throw new Error(`Ferramenta ${item.toolId} não encontrada`);
		}
		return {
			height: Number(t.heightCm),
			width: Number(t.widthCm),
			length: Number(t.lengthCm),
			weight: Number(t.weightKg),
			quantity: item.quantity,
		};
	});

	const raw = await fetchSuperFreteQuote({
		from: { postal_code: originCep },
		to: { postal_code: input.destinationCep },
		services: SERVICES,
		options: { insurance_value: 0, use_insurance_value: false },
		products,
	});

	return raw
		.filter((s) => typeof s.price === "number" && !s.error && !s.has_error)
		.map((s) => ({
			serviceId: s.id,
			name: s.name,
			company: s.company?.name ?? "",
			priceCents: Math.round((s.price as number) * 100),
			deliveryDays: s.delivery_time ?? 0,
		}))
		.sort((a, b) => a.priceCents - b.priceCents);
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `cd apps/web && bun run test src/lib/superfrete/quote.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/superfrete/quote.ts apps/web/src/lib/superfrete/quote.test.ts
git commit -m "feat(superfrete): quoteShipping (DB + client + normalização) (#47)"
```

---

## Task 6: Server action `quote-shipping.ts`

**Files:**
- Create: `apps/web/src/app/checkout/_actions/quote-shipping.ts`

> Sem teste unitário dedicado (fina; lógica já coberta em `quote.test.ts`). Verificação por `check-types` e smoke.

- [ ] **Step 1: Implementar a action**

```ts
"use server";

import { z } from "zod";

import { log } from "@/lib/evlog";
import { quoteShipping } from "@/lib/superfrete/quote";
import type { ShippingOption } from "@/lib/superfrete/types";

const inputSchema = z.object({
	destinationCep: z
		.string()
		.transform((v) => v.replace(/\D/g, ""))
		.refine((v) => v.length === 8, "CEP inválido"),
	items: z
		.array(
			z.object({
				toolId: z.string().min(1),
				quantity: z.number().int().positive(),
			})
		)
		.min(1, "Carrinho vazio"),
});

export type QuoteShippingResult =
	| { ok: true; options: ShippingOption[] }
	| { ok: false; error: string };

export async function quoteShippingAction(
	rawInput: unknown
): Promise<QuoteShippingResult> {
	const parsed = inputSchema.safeParse(rawInput);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos para cotação" };
	}
	try {
		const options = await quoteShipping(parsed.data);
		return { ok: true, options };
	} catch (err) {
		log.error({
			action: "quote_shipping_failed",
			error: err instanceof Error ? err.message : "erro inesperado",
		});
		return { ok: false, error: "Não foi possível calcular o frete." };
	}
}
```

- [ ] **Step 2: Verificar**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/checkout/_actions/quote-shipping.ts
git commit -m "feat(checkout): server action quoteShippingAction (#47)"
```

---

## Task 7: Componente `shipping-options.tsx`

**Files:**
- Create: `apps/web/src/app/checkout/_components/shipping-options.tsx`

> UI controlada: recebe estado e callbacks do pai. Estados: loading / erro (com retry) / lista de opções (radio).

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { Button } from "@emach/ui/components/button";

import { fmtBRL } from "@/lib/format";
import type { ShippingOption } from "@/lib/superfrete/types";

export type ShippingStatus = "idle" | "loading" | "error" | "ready";

interface ShippingOptionsProps {
	status: ShippingStatus;
	options: ShippingOption[];
	selectedId: number | null;
	onSelect: (serviceId: number) => void;
	onRetry: () => void;
}

export function ShippingOptions({
	status,
	options,
	selectedId,
	onSelect,
	onRetry,
}: ShippingOptionsProps) {
	if (status === "idle") {
		return (
			<p className="text-muted-foreground text-sm">
				Informe o CEP para calcular o frete.
			</p>
		);
	}
	if (status === "loading") {
		return <p className="text-muted-foreground text-sm">Calculando frete…</p>;
	}
	if (status === "error") {
		return (
			<div className="space-y-2">
				<p className="text-destructive text-sm">
					Não foi possível calcular o frete.
				</p>
				<Button
					className="h-9 rounded-none"
					onClick={onRetry}
					type="button"
					variant="outline"
				>
					Tentar novamente
				</Button>
			</div>
		);
	}
	if (options.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Nenhuma opção de frete para este CEP.
			</p>
		);
	}
	return (
		<div className="space-y-2">
			{options.map((opt) => (
				<label
					className="flex cursor-pointer items-center justify-between border border-border p-3 text-sm"
					key={opt.serviceId}
				>
					<span className="flex items-center gap-3">
						<input
							checked={selectedId === opt.serviceId}
							name="shipping-option"
							onChange={() => onSelect(opt.serviceId)}
							type="radio"
						/>
						<span>
							<span className="font-medium">{opt.name}</span>{" "}
							<span className="text-muted-foreground">
								· {opt.company} · {opt.deliveryDays} dia(s)
							</span>
						</span>
					</span>
					<span className="font-medium">{fmtBRL(opt.priceCents)}</span>
				</label>
			))}
		</div>
	);
}
```

- [ ] **Step 2: Verificar**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/checkout/_components/shipping-options.tsx
git commit -m "feat(checkout): componente ShippingOptions (#47)"
```

---

## Task 8: Integrar cotação no `checkout-content.tsx`

**Files:**
- Modify: `apps/web/src/app/checkout/_components/checkout-content.tsx`

> Remove o frete hardcoded; dispara cotação quando o CEP efetivo (endereço salvo OU novo) é válido; estado de opções; total usa a opção selecionada; bloqueia submit sem frete.

- [ ] **Step 1: Imports + remover constantes hardcoded**

Em `checkout-content.tsx`:
- Adicione aos imports (após linha 28):
```ts
import { quoteShippingAction } from "@/app/checkout/_actions/quote-shipping";
import {
	ShippingOptions,
	type ShippingStatus,
} from "@/app/checkout/_components/shipping-options";
import type { ShippingOption } from "@/lib/superfrete/types";
```
- Remova as linhas 41-42 (`FREE_SHIPPING_CENTS` e `STANDARD_SHIPPING_CENTS`).

- [ ] **Step 2: Estado de frete + CEP efetivo + cotação com debounce**

Dentro de `CheckoutContent`, após `const submittedRef = useRef(false);` (linha 108), adicione:

```ts
	const [shippingStatus, setShippingStatus] = useState<ShippingStatus>("idle");
	const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
	const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
		null
	);
	const [destinationCep, setDestinationCep] = useState("");
	const [quoteNonce, setQuoteNonce] = useState(0);

	const selectedShippingCents =
		shippingOptions.find((o) => o.serviceId === selectedServiceId)
			?.priceCents ?? null;
```

- [ ] **Step 3: Derivar o CEP efetivo do form**

Substitua o bloco `useMemo` de `orderItems/subtotal/shipping/total` (linhas 121-134) por (subtotal/total deixam de embutir frete hardcoded):

```ts
	const { orderItems, subtotal } = useMemo(() => {
		const sub = items.reduce(
			(sum, item) => sum + numericToCents(item.priceAmount) * item.quantity,
			0
		);
		return { orderItems: items, subtotal: sub };
	}, [items]);

	const shipping = selectedShippingCents ?? 0;
	const total = subtotal + shipping;
```

- [ ] **Step 4: Observar CEP via form.Subscribe e disparar cotação (debounce)**

Logo após a criação do `form` (após linha 199), adicione um efeito que lê o CEP do estado do form. Como o CEP vem de `newAddress.zipCode` (novo) ou do endereço salvo, derive-o e guarde em `destinationCep`:

```ts
	const watchedAddressId = form.state.values.addressId;
	const watchedNewCep = form.state.values.newAddress.zipCode;
	useEffect(() => {
		const saved = addresses.find((a) => a.id === watchedAddressId);
		const cepRaw =
			watchedAddressId === NEW_ADDRESS_ID
				? watchedNewCep
				: (saved?.zipCode ?? "");
		setDestinationCep(onlyDigits(cepRaw).slice(0, 8));
	}, [watchedAddressId, watchedNewCep, addresses]);

	useEffect(() => {
		if (destinationCep.length !== 8 || items.length === 0) {
			setShippingStatus("idle");
			setShippingOptions([]);
			setSelectedServiceId(null);
			return;
		}
		let cancelled = false;
		setShippingStatus("loading");
		const handle = setTimeout(async () => {
			const result = await quoteShippingAction({
				destinationCep,
				items: items.map((i) => ({ toolId: i.toolId, quantity: i.quantity })),
			});
			if (cancelled) {
				return;
			}
			if (result.ok) {
				setShippingOptions(result.options);
				setSelectedServiceId(result.options[0]?.serviceId ?? null);
				setShippingStatus("ready");
			} else {
				setShippingOptions([]);
				setSelectedServiceId(null);
				setShippingStatus("error");
			}
		}, 600);
		return () => {
			cancelled = true;
			clearTimeout(handle);
		};
	}, [destinationCep, items, quoteNonce]);
```

> Nota: `form.state.values` é reativo no TanStack Form; ler `addressId`/`newAddress.zipCode` aqui re-renderiza quando mudam. Se o lint do React Compiler reclamar de leitura de `form.state` fora de `Subscribe`, troque os dois `watched*` por um `form.Subscribe` que seta `destinationCep`.

- [ ] **Step 5: Bloquear submit sem frete e enviar a opção escolhida**

No `onSubmit` (linha 160), logo no início do corpo adicione a guarda e troque `shippingAmount`:

```ts
		onSubmit: async ({ value }) => {
			if (selectedShippingCents === null) {
				toast.error("Selecione uma opção de frete");
				return;
			}
```
E na chamada de `createOrderAction`, substitua a linha `shippingAmount: (shipping / 100).toFixed(2),` por:
```ts
				shippingAmount: (selectedShippingCents / 100).toFixed(2),
```

- [ ] **Step 6: Renderizar as opções no resumo + corrigir exibição do frete**

No bloco "Resumo do Pedido", substitua a linha do frete (linhas 510-513) por um bloco que mostra as opções e o valor:

```tsx
							<div className="space-y-2">
								<span className="text-muted-foreground text-sm">Frete</span>
								<ShippingOptions
									onRetry={() => setQuoteNonce((n) => n + 1)}
									onSelect={setSelectedServiceId}
									options={shippingOptions}
									selectedId={selectedServiceId}
									status={shippingStatus}
								/>
							</div>
```

- [ ] **Step 7: Verificar tipos**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun check-types`
Expected: PASS.

- [ ] **Step 8: Smoke visual (obrigatório — check-types não pega fronteira RSC/client nem runtime)**

Garanta o dev server na 3009: `cd apps/web && ./node_modules/.bin/next dev -p 3009` (se não estiver no ar).
Abra `http://localhost:3009/checkout` logado com itens no carrinho. Verifique:
- CEP vazio → "Informe o CEP para calcular o frete."
- Digitar CEP válido (ex. `01310100`) → "Calculando frete…" → lista com SEDEX e preço.
- Selecionar opção → Total atualiza.
- "Confirmar pedido" sem opção → toast "Selecione uma opção de frete".

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/checkout/_components/checkout-content.tsx
git commit -m "feat(checkout): cotação SuperFrete na UI; remove frete hardcoded (#47)"
```

---

## Task 9: Anti-fraude — re-validar `shippingAmount` no place-order

**Files:**
- Modify: `apps/web/src/app/checkout/_lib/place-order.ts`

> Hoje o `shippingAmount` do client é aceito sem validação. Re-cotar no servidor e exigir que o valor enviado bata com alguma opção retornada (tolerância de 1 centavo), espelhando `PRICE_TOLERANCE_CENTS`.

- [ ] **Step 1: Escrever o teste falhando**

Test: `apps/web/src/app/checkout/_lib/place-order.shipping.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/superfrete/quote", () => ({ quoteShipping: vi.fn() }));
import { quoteShipping } from "@/lib/superfrete/quote";
import { assertShippingQuoted } from "./place-order";

describe("assertShippingQuoted", () => {
	it("aceita shipping que bate com uma opção cotada", async () => {
		vi.mocked(quoteShipping).mockResolvedValue([
			{ serviceId: 2, name: "SEDEX", company: "Correios", priceCents: 3596, deliveryDays: 1 },
		]);
		await expect(
			assertShippingQuoted({
				shippingCents: 3596,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).resolves.toBeUndefined();
	});

	it("rejeita shipping que não bate com nenhuma opção", async () => {
		vi.mocked(quoteShipping).mockResolvedValue([
			{ serviceId: 2, name: "SEDEX", company: "Correios", priceCents: 3596, deliveryDays: 1 },
		]);
		await expect(
			assertShippingQuoted({
				shippingCents: 0,
				destinationCep: "01310100",
				items: [{ toolId: "t1", quantity: 1 }],
			})
		).rejects.toThrow();
	});
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd apps/web && bun run test src/app/checkout/_lib/place-order.shipping.test.ts`
Expected: FAIL ("assertShippingQuoted is not exported").

- [ ] **Step 3: Implementar `assertShippingQuoted` e chamá-la**

Em `place-order.ts`, adicione o import no topo:
```ts
import { quoteShipping } from "@/lib/superfrete/quote";
```
Adicione a função (perto de `checkAggregateStock`):
```ts
export async function assertShippingQuoted(params: {
	shippingCents: number;
	destinationCep: string;
	items: Array<{ toolId: string; quantity: number }>;
}): Promise<void> {
	const options = await quoteShipping({
		destinationCep: params.destinationCep,
		items: params.items,
	});
	const ok = options.some(
		(o) => Math.abs(o.priceCents - params.shippingCents) <= PRICE_TOLERANCE_CENTS
	);
	if (!ok) {
		throw new OrderError("Frete inválido, refaça o checkout");
	}
}
```
Em `placeOrder`, após `await checkAggregateStock(tx, lines);` (linha 343), adicione:
```ts
	const destinationCep = (
		input.addressId
			? (
					await tx
						.select({ zipCode: clientAddress.zipCode })
						.from(clientAddress)
						.where(eq(clientAddress.id, input.addressId))
						.limit(1)
				)[0]?.zipCode
			: input.newAddress?.zipCode
	)?.replace(/\D/g, "");
	if (destinationCep && destinationCep.length === 8) {
		await assertShippingQuoted({
			shippingCents: centsFromString(input.shippingAmount),
			destinationCep,
			items: input.cartItems.map((i) => ({
				toolId: i.toolId,
				quantity: i.quantity,
			})),
		});
	}
```

- [ ] **Step 4: Rodar os testes do place-order**

Run: `cd apps/web && bun run test src/app/checkout/_lib/place-order.shipping.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Suite completa + tipos**

Run: `cd /home/othavio/Projects/emach/emach-ecommerce && bun check-types && cd apps/web && bun run test`
Expected: PASS (todos os testes do app).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/checkout/_lib/place-order.ts apps/web/src/app/checkout/_lib/place-order.shipping.test.ts
git commit -m "feat(checkout): re-valida shippingAmount contra cotação no place-order (#47)"
```

---

## Self-Review (do autor do plano)

- **Spec coverage:** módulo `lib/superfrete` (T2-T5) · origem Curitiba (T4) · server action (T6) · UI opções + remoção do hardcoded (T7-T8) · anti-fraude (T9) · env (T1) · filtro só-com-price (T5, validado no spec §5) · testes (T3/T4/T5/T9). ViaCEP/cupom/etiqueta = fora de escopo (não viram task). ✔
- **Placeholder scan:** sem TBD/TODO; todo step tem código real. ✔
- **Type consistency:** `ShippingOption{serviceId,name,company,priceCents,deliveryDays}` usado igual em types/quote/UI/place-order; `quoteShipping({destinationCep,items})` idem; `fetchSuperFreteQuote(body)` com `products[]` consistente client↔quote. ✔
- **Risco conhecido:** Task 8 Step 4 — leitura de `form.state.values` fora de `Subscribe` pode disparar aviso do React Compiler; fallback documentado no próprio step.
