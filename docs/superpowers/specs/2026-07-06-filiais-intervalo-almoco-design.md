# Filiais: intervalo de almoço no horário de funcionamento (issue #198)

**Data:** 2026-07-06
**Issue:** [#198](https://github.com/othavi0/emach-ecommerce/issues/198)
**Status:** aprovado (layout B validado via visual companion)

## Contexto

O dashboard passou a registrar intervalo de almoço em `branch.business_hours` (jsonb). Os campos `breakStart`/`breakEnd` de `BranchBusinessHoursPeriod` já chegaram a este repo via CI sync (ADR-0009) — `packages/db/src/schema/inventory.ts` já os tem. **Nenhuma mudança de schema aqui.** As 4 filiais têm `12:00`–`13:00` em `weekdays`; sábado sem intervalo.

A única superfície do storefront que exibe horário é o `BranchCard` da página `/sobre` (`apps/web/src/app/(shop)/sobre/page.tsx`), via `formatBusinessHours` em `apps/web/src/lib/branches.ts` — que ignora o intervalo e concatena tudo numa linha só. Com dois turnos a linha passaria de ~75 caracteres e quebraria sem alinhamento (validado no mockup A).

**Fora do escopo:** mapa de filiais da home (pins não exibem horário hoje), schema, dashboard.

## Decisão visual

Layout **B — grade rotulada** (escolhido entre 3 mockups): bloco `Horário` com uma linha por período, rótulo condensed uppercase à esquerda e horários com números tabulares à direita. Segue o padrão label/valor já usado no design system; nenhum token novo.

```
Horário
SEG–SEX    08:00–12:00 · 13:00–18:00
SÁBADO     08:00–13:00
FERIADOS   Fechado
```

## Mudanças

### 1. `apps/web/src/lib/branches.ts` — formatters

**Novo `formatBusinessPeriod(period: BranchBusinessHoursPeriod | null | undefined): string`** — per-período, alinhado ao nome e contrato do dashboard (`apps/web/src/lib/format/branch.ts` de lá):

| Entrada | Saída |
|---|---|
| `isOpen: false`, ou `opensAt`/`closesAt` nulos, ou período ausente | `Fechado` |
| Aberto, `breakStart` e `breakEnd` presentes | `08:00–12:00 · 13:00–18:00` |
| Aberto, sem intervalo | `08:00–13:00` |
| Aberto, intervalo parcial (só `breakStart` ou só `breakEnd`) | turno único `08:00–18:00` (defensivo — o Zod do dashboard garante ambos-ou-nenhum, mas o jsonb não tem constraint no banco) |

Separadores: en-dash `–` entre horas, ` · ` entre turnos (formato da issue).

**`formatBusinessHours` (string única) é removida** e substituída por **`getBusinessHoursRows(hours: BranchBusinessHours | null): BusinessHoursRow[] | null`**:

- `hours` nulo → `null` (o card omite o bloco, comportamento atual preservado).
- Caso contrário → 3 linhas fixas: `{ label: "Seg–sex", value: formatBusinessPeriod(hours.weekdays) }`, idem `Sábado` e `Feriados`.
- `BusinessHoursRow = { label: string; value: string }` exportado do mesmo arquivo.

### 2. `apps/web/src/app/(shop)/sobre/page.tsx` — render

- `BranchCardData.hours: string | null` → `hoursRows: BusinessHoursRow[] | null`; `getBranches()` popula com `getBusinessHoursRows(row.businessHours)`.
- No `BranchCard`, o `<div><strong>Horário</strong>: …</div>` vira:
  - `<strong className="text-white">Horário</strong>` como cabeçalho do bloco;
  - grade `grid grid-cols-[72px_1fr] gap-x-4` com uma linha por período;
  - rótulo: `font-bold font-display text-[11px] uppercase tracking-[0.14em] text-white/45`;
  - valor: `text-white/78 tabular-nums`; quando `Fechado`, `text-white/38`.
- Só utilities existentes; cantos retos e hairlines do card intocados.

### 3. Testes — `apps/web/src/lib/branches.test.ts`

Unit-only (funções puras — não entra na lista `INTEGRATION` do `vitest.config.ts`):

- `formatBusinessPeriod`: com intervalo, sem intervalo, `isOpen: false`, horários nulos, período `undefined`, intervalo parcial (ambas as direções).
- `getBusinessHoursRows`: `null` → `null`; shape e ordem das 3 linhas com dados realistas.

## Tratamento de erro

Jsonb malformado (período ausente/nulo) degrada para `Fechado` via optional chaining — nunca lança. `businessHours` nulo omite o bloco inteiro, como hoje.

## Verificação

1. `bun check-types`
2. `bun run --filter=web test src/lib/branches.test.ts`
3. Smoke visual: `bun dev:web` + `/sobre` — as 4 filiais devem mostrar `08:00–12:00 · 13:00–18:00` em Seg–sex (dados reais já populados no banco compartilhado).
