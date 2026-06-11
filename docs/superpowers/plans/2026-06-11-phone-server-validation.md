# Validação server-side do `phone` (#100) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validar e normalizar o campo `phone` server-side no hook do Better Auth ecommerce, fechando o bypass de requests diretos a sign-up/updateUser.

**Architecture:** Adiciona `isValidPhone` ao `@emach/validators` (reusando `onlyDigits`/`allSame`). No `ecommerce.ts`, espelha o padrão tri-estado do `document` num `normalizePhoneForWrite`, e extrai um `normalizeUserForWrite` compartilhado que ambos os hooks (`create.before`/`update.before`) chamam — removendo a duplicação.

**Tech Stack:** TypeScript, Better Auth 1.6.11, Bun (`bun:test`), monorepo Turborepo.

---

### Task 1: `isValidPhone` em `@emach/validators` (TDD)

**Files:**
- Test: `packages/validators/src/cpf-cnpj.test.ts` (criar)
- Modify: `packages/validators/src/cpf-cnpj.ts` (adicionar export após `isValidCpfCnpj`, ~linha 73)

Regra BR: 10 dígitos (fixo) ou 11 (celular); DDD na faixa 11–99; no celular o 3º dígito é `9` (ANATEL); rejeita `allSame`. `index.ts` já é `export *` — não precisa editar.

- [ ] **Step 1: Escrever o teste que falha**

Criar `packages/validators/src/cpf-cnpj.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { isValidPhone } from "./cpf-cnpj";

describe("isValidPhone", () => {
	test("aceita fixo com 10 dígitos", () => {
		expect(isValidPhone("1133334444")).toBe(true);
	});

	test("aceita celular com 11 dígitos e o 9", () => {
		expect(isValidPhone("11999998888")).toBe(true);
	});

	test("aceita entrada mascarada (normaliza antes)", () => {
		expect(isValidPhone("(11) 99999-8888")).toBe(true);
	});

	test("rejeita texto sem dígitos", () => {
		expect(isValidPhone("abc")).toBe(false);
	});

	test("rejeita comprimento inválido (5 dígitos)", () => {
		expect(isValidPhone("11999")).toBe(false);
	});

	test("rejeita allSame", () => {
		expect(isValidPhone("00000000000")).toBe(false);
	});

	test("rejeita DDD fora da faixa (< 11)", () => {
		expect(isValidPhone("0199998888")).toBe(false);
	});

	test("rejeita celular (11 díg) sem o 9 no 3º dígito", () => {
		expect(isValidPhone("11899998888")).toBe(false);
	});
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd packages/validators && bun test src/cpf-cnpj.test.ts`
Expected: FAIL — `isValidPhone` não é export de `./cpf-cnpj`.

- [ ] **Step 3: Implementar `isValidPhone`**

Em `packages/validators/src/cpf-cnpj.ts`, logo após o `isValidCpfCnpj` (fim da função, ~linha 73), adicionar:

```ts
export const isValidPhone = (raw: string): boolean => {
	const d = onlyDigits(raw);
	if (d.length !== 10 && d.length !== 11) {
		return false;
	}
	if (allSame(d)) {
		return false;
	}
	const ddd = Number(d.slice(0, 2));
	if (ddd < 11 || ddd > 99) {
		return false;
	}
	// Celular (11 dígitos): 3º dígito é sempre 9 (regra ANATEL).
	if (d.length === 11 && d[2] !== "9") {
		return false;
	}
	return true;
};
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd packages/validators && bun test src/cpf-cnpj.test.ts`
Expected: PASS — 8 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/cpf-cnpj.ts packages/validators/src/cpf-cnpj.test.ts
git commit -m "feat: isValidPhone em @emach/validators (#100)"
```

---

### Task 2: Validação do `phone` no hook do Better Auth + refator

**Files:**
- Modify: `packages/auth/src/ecommerce.ts` (import linha 12; helpers ~linha 47–62; hooks ~linha 117–142)

Adiciona `normalizePhoneForWrite` (espelha `normalizeDocumentForWrite`, tri-estado) e extrai `normalizeUserForWrite` que ambos os hooks chamam.

- [ ] **Step 1: Importar `isValidPhone`**

Em `packages/auth/src/ecommerce.ts:12`, trocar:

```ts
import { isValidCpfCnpj, onlyDigits } from "@emach/validators";
```

por:

```ts
import { isValidCpfCnpj, isValidPhone, onlyDigits } from "@emach/validators";
```

- [ ] **Step 2: Adicionar `normalizePhoneForWrite` + `normalizeUserForWrite`**

Logo após a função `normalizeDocumentForWrite` (que termina ~linha 62), adicionar:

```ts
// Mesmo tri-estado do document, para o `phone` (#100). `phone` NÃO é unique no
// schema (text("phone")), então o motivo do '' → null aqui é a invariante "só
// dígitos" da coluna, não colisão de unique. Validação client-side (Zod) é só UX.
function normalizePhoneForWrite(raw: unknown): string | null | undefined {
	if (typeof raw !== "string") {
		return;
	}
	const trimmed = raw.trim();
	if (trimmed === "") {
		return null;
	}
	const phone = onlyDigits(trimmed);
	if (!isValidPhone(phone)) {
		throw new APIError("BAD_REQUEST", {
			message: "Telefone inválido.",
		});
	}
	return phone;
}

// Aplica a normalização de todos os additionalFields graváveis num único lugar,
// consumido por create.before e update.before. `undefined` = campo ausente no
// payload → não mexe; `null`/string = grava.
function normalizeUserForWrite<T>(data: T): T {
	const document = normalizeDocumentForWrite(
		(data as { document?: unknown }).document
	);
	const phone = normalizePhoneForWrite((data as { phone?: unknown }).phone);
	let out = data;
	if (document !== undefined) {
		out = { ...out, document };
	}
	if (phone !== undefined) {
		out = { ...out, phone };
	}
	return out;
}
```

- [ ] **Step 3: Refatorar os dois hooks para usar o helper**

Substituir o bloco `databaseHooks` (atual ~linha 117–143) por:

```ts
	databaseHooks: {
		user: {
			create: {
				before: async (user) => {
					return { data: normalizeUserForWrite(user) };
				},
			},
			update: {
				before: async (userData) => {
					return { data: normalizeUserForWrite(userData) };
				},
			},
		},
	},
```

- [ ] **Step 4: `check-types`**

Run: `bun check-types`
Expected: PASS — sem erros de tipo. (Se acusar `phone` não inferido no cast, o cast estrutural `(data as { phone?: unknown })` já cobre, igual ao `document`.)

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/ecommerce.ts
git commit -m "feat: validação server-side do phone no hook ecommerce (#100)"
```

---

### Task 3: Smoke real (não confiar só no check-types)

**Files:** nenhum (verificação).

`bun check-types` não pega SQL/runtime nem comportamento de UI. Verificar de fato.

- [ ] **Step 1: Subir o dev server**

Run: `bun dev:web` (ou `/dev-here <porta>` para não colidir com outros clones).

- [ ] **Step 2: Smoke da UI — cadastro**

Acessar a rota de cadastro, criar conta com telefone válido formatado (`(11) 99999-8888`). Esperado: cadastra sem erro; conferir no banco que `phone` persistiu **só dígitos** (`11999998888`).

- [ ] **Step 3: Smoke da UI — dados pessoais**

Logado, abrir dados pessoais, salvar com telefone válido. Esperado: salva; persiste normalizado. Limpar o campo e salvar. Esperado: grava NULL.

- [ ] **Step 4: Bypass via API direta (o ponto da issue)**

Request direto ao endpoint de updateUser com phone inválido (texto / 5 dígitos). Esperado: `400 BAD_REQUEST` com "Telefone inválido." — não persiste.

```bash
# exemplo (ajustar cookie de sessão e porta):
curl -s -X POST http://localhost:3000/api/auth/update-user \
  -H 'Content-Type: application/json' -H 'Cookie: <sessao>' \
  -d '{"phone":"abc"}' -i | head -20
```

- [ ] **Step 5: Confirmar P0 — dashboard intocada**

Run: `git diff main --stat`
Expected: só `packages/validators/*` e `packages/auth/src/ecommerce.ts` (+ docs). Nenhum toque em `@emach/auth/dashboard` ou schema `auth`.
