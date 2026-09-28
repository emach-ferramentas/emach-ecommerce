# Plan 002: Normalizar CPF/CNPJ antes de persistir no checkout + testar o validador

> **Status em 2026-09-28:** implementado. `inputSchema.document` usa `.transform(onlyDigits).refine(isValidCpfCnpj)` em `apps/web/src/app/checkout/_lib/place-order.ts:64`. O pacote `@emach/validators` tem o script `"test": "bun test"` e `packages/validators/src/cpf-cnpj.test.ts` cobre CPF, CNPJ e telefone.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- apps/web/src/app/checkout/_lib/place-order.ts packages/validators/src/cpf-cnpj.ts packages/validators/src/cpf-cnpj.test.ts packages/validators/package.json`
> Se algum mudou, compare os excerpts "Current state" com o código vivo antes de
> prosseguir; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (idealmente após 001 para o CI pegar os novos testes)
- **Category**: bug / security
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

O `CLAUDE.md` declara invariante P0: "CPF/CNPJ — sempre normalizar (só dígitos)
antes de persistir em `client.document`". No checkout, `inputSchema` valida o
documento com `.refine(isValidCpfCnpj, ...)` mas **não normaliza** — e
`placeOrder` grava `input.document` cru no banco. A UI normaliza via
`onlyDigits` antes de enviar, mas uma chamada direta à server action (sem passar
pela UI) persiste `"123.456.789-09"` mascarado. Isso fura o invariante e o
`UNIQUE` de `client.document`: o mesmo CPF mascarado e sem máscara não colidem,
quebrando a deduplicação. Além disso, o validador de dígito verificador
(`isValidCpf`/`isValidCnpj`) hoje não tem **nenhum** teste — lógica crítica de
fraude sem rede de segurança.

## Current state

- `apps/web/src/app/checkout/_lib/place-order.ts:54-74` — schema sem normalização:
  ```ts
  export const inputSchema = z.object({
  	name: z.string().min(2),
  	email: z.email(),
  	phone: z.string().min(10),
  	document: z.string().refine(isValidCpfCnpj, "Documento inválido"),
  	addressId: z.string().nullable(),
  	// ...
  ```
- `apps/web/src/app/checkout/_lib/place-order.ts:490-498` — write cru:

_Nota 2026-09-28: as linhas citadas neste plano derivaram. O `document` do schema está em `place-order.ts:64` e o write em `place-order.ts:613`. O campo `phone` (fora do escopo original) também passou a normalizar com `onlyDigits` e validar com `isValidPhone` (`place-order.ts:60-63`)._
  ```ts
  await tx
  	.update(client)
  	.set({
  		name: input.name,
  		phone: input.phone,
  		document: input.document,   // <- mascarado se a chamada não passou pela UI
  	})
  	.where(eq(client.id, clientId));
  ```
- O helper `onlyDigits` já existe e é o canônico do repo:
  `packages/validators/src/cpf-cnpj.ts:14` → `export const onlyDigits = (v: string): string => v.replace(RE_DIGITS, "")`.
  `isValidCpfCnpj` (linha 64) já chama `onlyDigits` internamente para validar, então
  aceita entrada mascarada — por isso o `.refine` passa sem normalizar o valor gravado.
- **Exemplar de transform+refine já usado no repo** —
  `apps/web/src/app/checkout/_actions/quote-shipping.ts:13-16`:
  ```ts
  destinationCep: z
  	.string()
  	.transform((v) => v.replace(/\D/g, ""))
  	.refine((v) => v.length === 8, "CEP inválido"),
  ```
- `place-order.ts` já importa de `@emach/validators` (confirme o topo do arquivo;
  `isValidCpfCnpj` vem de lá). Se `onlyDigits` ainda não estiver importado, adicione
  ao import existente.
- `packages/validators/src/cpf-cnpj.test.ts` — só testa `isValidPhone` (8 casos).
  Zero cobertura de `isValidCpf`, `isValidCnpj`, `isValidCpfCnpj`. Usa `bun:test`:
  `import { describe, expect, test } from "bun:test"`.
- `packages/validators/package.json` — **não tem** script `"test"`. Só
  `check-types`. Os testes em `bun:test` rodam com `bun test` (runner nativo do
  Bun, sem dependência extra).

## Commands you will need

| Purpose              | Command                                        | Expected |
|----------------------|------------------------------------------------|----------|
| Typecheck            | `bun run --filter=web check-types`             | exit 0   |
| Typecheck validators | `bun run --filter=@emach/validators check-types` | exit 0 |
| Testes do validador  | `cd packages/validators && bun test`           | todos passam |
| Lint                 | `bun check`                                    | exit 0   |

## Scope

**In scope**:
- `apps/web/src/app/checkout/_lib/place-order.ts` (só o `inputSchema`, campo `document`)
- `packages/validators/src/cpf-cnpj.test.ts` (adicionar casos)
- `packages/validators/package.json` (adicionar script `test`)

**Out of scope** (NÃO tocar):
- A normalização de `phone` no mesmo schema — o auth já normaliza telefone em
  outro caminho; mexer aqui é escopo separado. Deixe `phone` como está.
- `packages/validators/src/cpf-cnpj.ts` (a implementação está correta — só falta teste).
- Qualquer outra server action.

## Git workflow

- Branch: `advisor/002-normalizar-cpf-cnpj`
- Conventional Commits PT (`fix:`, `test:`), sujeito ≤50 chars.
- Sem push/PR salvo instrução.

## Steps

### Step 1: Escrever os testes do validador PRIMEIRO (caracterização)

Em `packages/validators/src/cpf-cnpj.test.ts`, adicione `describe`s para
`isValidCpf`, `isValidCnpj` e `isValidCpfCnpj`. Importe-os no topo
(`import { isValidCpf, isValidCnpj, isValidCpfCnpj, isValidPhone } from "./cpf-cnpj"`).
Cubra, no mínimo:

- `isValidCpf`: um CPF válido conhecido (ex.: `"52998224725"`), o mesmo
  **com máscara** (`"529.982.247-25"`) → `true`; dígito verificador errado
  (`"52998224724"`) → `false`; `allSame` (`"11111111111"`) → `false`;
  comprimento errado (`"123"`) → `false`.
- `isValidCnpj`: um CNPJ válido conhecido (ex.: `"11222333000181"`), com máscara
  (`"11.222.333/0001-81"`) → `true`; dígito errado → `false`; `allSame`
  (`"11111111111111"`) → `false`; comprimento errado → `false`.
- `isValidCpfCnpj`: aceita CPF válido (11 díg) e CNPJ válido (14 díg); rejeita
  comprimento intermediário (ex.: 12 dígitos) → `false`.

Siga o estilo do `describe("isValidPhone", ...)` já no arquivo.

**Verify**: `cd packages/validators && bun test` — os testes rodam. Eles devem
**passar** (a implementação já está correta). Se algum falhar, NÃO altere a
implementação: confira se o número de teste que você escolheu é de fato válido
(recalcule o dígito verificador) — STOP se ainda divergir.

### Step 2: Adicionar o script `test` ao package.json do validators

Em `packages/validators/package.json`, no bloco `scripts`, adicione:

```json
"test": "bun test",
```

**Verify**: `bun run --filter=@emach/validators test` → todos passam.

### Step 3: Normalizar `document` no inputSchema do checkout

Em `apps/web/src/app/checkout/_lib/place-order.ts`, troque o campo `document` do
`inputSchema` para transformar antes de validar (espelhando o padrão do
`destinationCep` em `quote-shipping.ts`):

```ts
document: z
	.string()
	.transform((v) => onlyDigits(v))
	.refine(isValidCpfCnpj, "Documento inválido"),
```

Garanta que `onlyDigits` está importado de `@emach/validators` (adicione ao
import existente de `isValidCpfCnpj` se necessário). O write em
`place-order.ts:496` (`document: input.document`) NÃO muda — `input.document` já
chega normalizado porque o `.transform` roda no parse.

**Verify**: `bun run --filter=web check-types` → exit 0.

## Test plan

- Novos testes em `packages/validators/src/cpf-cnpj.test.ts` cobrindo
  `isValidCpf`/`isValidCnpj`/`isValidCpfCnpj` (válido, mascarado, dígito errado,
  allSame, comprimento errado). Padrão estrutural: o `describe("isValidPhone")`
  já presente.
- Não há teste novo para a normalização do `inputSchema` (o caminho do checkout é
  integração contra banco, fora do CI). O teste do validador cobre a lógica;
  o `check-types` cobre o schema.
- Verificação: `bun run --filter=@emach/validators test` → todos passam, ≥10 novos casos.

## Done criteria

- [ ] `cd packages/validators && bun test` → todos passam, incluindo os novos casos de CPF/CNPJ
- [ ] `packages/validators/package.json` tem script `"test": "bun test"`
- [ ] `place-order.ts` `inputSchema.document` usa `.transform(onlyDigits).refine(isValidCpfCnpj)`
- [ ] `onlyDigits` importado de `@emach/validators` em `place-order.ts`
- [ ] `bun run --filter=web check-types` → exit 0
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- Um teste de CPF/CNPJ que você escreveu falha contra a implementação — confirme
  primeiro que o número de teste é realmente válido (dígito verificador). Se a
  implementação parecer errada, reporte; NÃO a altere neste plano.
- `place-order.ts` não importa de `@emach/validators` (estrutura divergiu do excerpt).
- O campo `document` no schema já tem `.transform` (alguém já corrigiu) — reporte.

## Maintenance notes

- Se um dia o `phone` também precisar de normalização server-side no checkout,
  aplicar o mesmo padrão `.transform(onlyDigits).refine(isValidPhone)` — fora deste plano.
- Reviewer: confirmar que `isValidCpfCnpj` continua chamando `onlyDigits`
  internamente (o `.transform` o torna redundante mas inofensivo).
