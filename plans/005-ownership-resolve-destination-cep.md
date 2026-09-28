# Plan 005: Checar posse do endereço em `resolveDestinationCep`

> **Status em 2026-09-28:** implementado. `resolveDestinationCep(database, input, clientId)` filtra por `clientAddress.id` e `clientAddress.clientId` em `apps/web/src/app/checkout/_lib/place-order.ts:351-372`. O único caller passa `clientId` em `apps/web/src/app/checkout/_actions/create-order.ts:74`.

> **Executor instructions**: Siga passo a passo, rode cada verificação. STOP =
> pare e reporte. Ao terminar, atualize `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- apps/web/src/app/checkout/_lib/place-order.ts apps/web/src/app/checkout/_actions/create-order.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

`resolveDestinationCep` busca um `clientAddress` **só por `id`**, sem filtrar por
`clientId`. Um cliente autenticado que envie no payload do checkout um `addressId`
de outro cliente faz o servidor re-cotar o frete contra o CEP alheio — vazamento
de informação (confirma o CEP de outro usuário). A criação do pedido em si falha
depois (`buildAddressSnapshot` no mesmo arquivo já filtra por `clientId`), mas a
cotação roda contra o endereço alheio antes disso. O fix alinha
`resolveDestinationCep` ao padrão de posse já usado no resto do arquivo.

> Nota: hoje os dados do banco são mock/pré-lançamento, então não há vazamento
> real ainda — mas o fix é trivial e fecha o buraco antes de dados reais entrarem.

## Current state

- `apps/web/src/app/checkout/_lib/place-order.ts:304-319` — sem filtro de posse:

_Nota 2026-09-28: as linhas citadas derivaram. A função está em `place-order.ts:351` e o call site em `create-order.ts:74`. Os trechos abaixo mostram o estado anterior ao fix._
  ```ts
  export async function resolveDestinationCep(
  	database: typeof db,
  	input: CreateOrderInput
  ): Promise<string | null> {
  	const raw = input.addressId
  		? (
  				await database
  					.select({ zipCode: clientAddress.zipCode })
  					.from(clientAddress)
  					.where(eq(clientAddress.id, input.addressId))   // <- só por id
  					.limit(1)
  			)[0]?.zipCode
  		: input.newAddress?.zipCode;
  	const cep = raw?.replace(/\D/g, "") ?? "";
  	return cep.length === 8 ? cep : null;
  }
  ```
- **Padrão correto no MESMO arquivo** — `buildAddressSnapshot`
  (`place-order.ts:108-118`) já filtra por posse:
  ```ts
  .where(
  	and(
  		eq(clientAddress.id, addressId),
  		eq(clientAddress.clientId, clientId)
  	)
  )
  ```
  `and` e `eq` já estão importados de `drizzle-orm` no arquivo.
- **Call site** — `apps/web/src/app/checkout/_actions/create-order.ts:69`:
  ```ts
  const destinationCep = await resolveDestinationCep(db, input);
  ```
  `clientId` já existe nesse escopo (`const clientId = session.user.id;`, linha 45).

## Commands you will need

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|----------|
| Typecheck | `bun run --filter=web check-types`   | exit 0   |
| Lint      | `bun check`                          | exit 0   |

## Scope

**In scope**:
- `apps/web/src/app/checkout/_lib/place-order.ts` (assinatura + where de `resolveDestinationCep`)
- `apps/web/src/app/checkout/_actions/create-order.ts` (call site, passar `clientId`)

**Out of scope**:
- `buildAddressSnapshot` e o resto de `place-order.ts` — já corretos.
- `place-order.test.ts` — é integração (fora do CI); não editar aqui.

## Git workflow

- Branch: `advisor/005-cep-ownership`
- Commit `fix:` PT, ≤50 chars (ex.: `fix: checa posse do endereco na cotacao`).

## Steps

### Step 1: Adicionar `clientId` à assinatura e ao where

Em `place-order.ts`, altere `resolveDestinationCep` para receber `clientId` e
filtrar por posse:

```ts
export async function resolveDestinationCep(
	database: typeof db,
	input: CreateOrderInput,
	clientId: string
): Promise<string | null> {
	const raw = input.addressId
		? (
				await database
					.select({ zipCode: clientAddress.zipCode })
					.from(clientAddress)
					.where(
						and(
							eq(clientAddress.id, input.addressId),
							eq(clientAddress.clientId, clientId)
						)
					)
					.limit(1)
			)[0]?.zipCode
		: input.newAddress?.zipCode;
	const cep = raw?.replace(/\D/g, "") ?? "";
	return cep.length === 8 ? cep : null;
}
```

**Verify**: `bun run --filter=web check-types` → vai falhar no call site (esperado,
próximo passo corrige). Confirme que o erro é só o argumento faltante em `create-order.ts`.

### Step 2: Passar `clientId` no call site

Em `create-order.ts:69`:

```ts
const destinationCep = await resolveDestinationCep(db, input, clientId);
```

**Verify**: `bun run --filter=web check-types` → exit 0.

## Test plan

- O caminho é coberto por testes de integração (`create-order.test.ts`,
  `place-order.test.ts`) que rodam localmente contra o banco. Rode-os se tiver
  `DATABASE_URL` configurado: `bun run --filter=web test src/app/checkout/_actions/create-order.test.ts`.
  Se não tiver banco, o `check-types` + revisão do diff bastam (mudança é só o where).
- Não adicione teste novo dedicado (exigiria fixture multi-cliente no banco —
  follow-up junto da suíte de integração).

## Done criteria

- [ ] `resolveDestinationCep` recebe `clientId` e filtra `eq(clientAddress.clientId, clientId)`
- [ ] Call site em `create-order.ts:69` passa `clientId`
- [ ] `bun run --filter=web check-types` → exit 0
- [ ] `bun check` → exit 0
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- `resolveDestinationCep` tiver outros callers além de `create-order.ts:69`
  (`grep -rn "resolveDestinationCep" apps/web/src`) — cada um precisa passar `clientId`.
- `and`/`eq` não estiverem importados em `place-order.ts` (improvável — `buildAddressSnapshot` os usa).

## Maintenance notes

- Reviewer: confirmar que todo lookup de `clientAddress` no checkout filtra por
  `clientId` (padrão de posse). Esta era a única exceção.
