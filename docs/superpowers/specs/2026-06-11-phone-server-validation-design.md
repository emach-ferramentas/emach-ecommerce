# Validação server-side do campo `phone` (issue #100)

> Follow-up de #92 (validação server-side de senha e CPF/CNPJ). Estende o mesmo
> hardening ao campo `phone` da instância **ecommerce** do Better Auth.

## Problema

O `phone` é `additionalField` com `input: true` em `packages/auth/src/ecommerce.ts`
(igual ao `document`), então é gravável por qualquer request direto a
`authClient.updateUser` / sign-up. Hoje o hook `databaseHooks.user.{create,update}.before`
normaliza e valida **só** o `document` — o `phone` passa sem normalização nem
validação: persiste com máscara (`(41) 99999-9999`), texto arbitrário ou
comprimento inválido. A validação de telefone existe só em Zod no cliente
(`personal-data-form.tsx`, `login-form.tsx`), que requests diretos bypassam.

## Decisões de design

1. **Rigor da `isValidPhone`** — 10 dígitos (fixo) ou 11 (celular); DDD na faixa
   plausível 11–99; no celular o 3º dígito deve ser `9` (regra ANATEL); rejeita
   `allSame` (`0000000000`). Escolhido sobre "só DDD + comprimento" (frágil:
   aceita `11 00000000`) e sobre a lista exata de DDDs da ANATEL (tabela a manter
   — YAGNI por ora).
2. **Tri-estado `'' → NULL`** — espelha o `document`: `undefined` = campo ausente
   (não toca), `null` = limpar (grava NULL, não `""`, mantendo a invariante "só
   dígitos" da coluna), `string` = telefone normalizado e válido. Nota: `phone`
   **não** é `unique` no schema (`text("phone")`), diferente do `document`
   (`.unique()`); o motivo do `''→null` aqui é a invariante "só dígitos", não
   colisão de unique.
3. **Helper compartilhado** — `create.before` e `update.before` hoje duplicam a
   lógica do `document`. Com o `phone` seriam 4 trechos. Extrair
   `normalizeUserForWrite(data)` que aplica ambos os campos e devolve o objeto
   mesclado, chamado pelos dois hooks. Remove a duplicação e centraliza a evolução.

## Componentes

### `packages/validators/src/cpf-cnpj.ts`

```ts
export const isValidPhone = (raw: string): boolean => {
  const d = onlyDigits(raw);
  if (d.length !== 10 && d.length !== 11) return false;
  if (allSame(d)) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d.length === 11 && d[2] !== "9") return false; // celular: 9º dígito (ANATEL)
  return true;
};
```

Reusa `onlyDigits` e `allSame` (já existentes). `index.ts` é `export *`, então o
novo símbolo propaga sem edição extra.

### `packages/auth/src/ecommerce.ts`

`normalizePhoneForWrite(raw)` — espelha `normalizeDocumentForWrite`, tri-estado,
lança `APIError("BAD_REQUEST", { message: "Telefone inválido." })` quando inválido.

`normalizeUserForWrite(data)` — aplica `normalizeDocumentForWrite` + `normalizePhoneForWrite`,
mescla só os campos que não vieram `undefined`, devolve o objeto. Os dois hooks
viram `return { data: normalizeUserForWrite(user) }`.

## Testes — `packages/validators/src/cpf-cnpj.test.ts` (`bun:test`, novo)

Espelha `packages/auth/src/google.test.ts` (mesmo runner). Cobre:

- **Válidos:** fixo 10 dígitos (`1133334444`), celular 11 com 9 (`11999998888`),
  entrada com máscara (`(11) 99999-8888`) → normaliza e valida.
- **Inválidos:** texto (`"abc"`), 5 dígitos, `allSame` (`00000000000`),
  DDD < 11 (`0199998888...`), celular sem o 9 no 3º dígito.

## Smoke / aceitação

- `bun check-types` passa.
- UI real (cadastro + dados pessoais) continua funcionando — verificação visual,
  não só check-types.
- Request direto à API com phone inválido (texto, 5 dígitos) → rejeitado.
- Phone persiste sempre normalizado (só dígitos); `''` grava NULL.
- Instância **dashboard** intocada (invariante P0 — este repo não importa nem
  altera `@emach/auth/dashboard` / schema `auth`).

## Fora de escopo (YAGNI)

- Lista exata de DDDs reais da ANATEL.
- Validação de `phone` fora do hook do Better Auth.
- Qualquer mudança no schema (coluna `phone` já existe; nada a migrar).
